import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()

  const { data: fiscalYear } = await supabase
    .from('fiscal_years')
    .select('id, year')
    .eq('is_active', true)
    .single()

  if (!fiscalYear) {
    return NextResponse.json({ error: 'No active fiscal year' }, { status: 400 })
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('type, amount, vat, total, ai_needs_review, invoice_date, supplier_id, customer_id, suppliers(name), customers(name)')
    .eq('fiscal_year_id', fiscalYear.id)

  if (!documents) {
    return NextResponse.json({
      income: 0, income_vat: 0, expenses: 0, expenses_vat: 0,
      result: 0, vat_to_pay: 0, document_count: 0, needs_review_count: 0,
      anomalies: [], missing_recurring: [], monthly_breakdown: [],
    })
  }

  let income = 0, incomeVat = 0, expenses = 0, expensesVat = 0, needsReviewCount = 0

  // Group by supplier for anomaly + recurring detection
  const supplierHistory: Record<number, { name: string; amounts: number[]; months: Set<string> }> = {}
  const monthlyData: Record<string, { income: number; expenses: number }> = {}

  for (const doc of documents) {
    const amt = doc.amount ?? 0
    const vatAmt = doc.vat ?? 0

    if (doc.type === 'outgoing_invoice') {
      income += amt
      incomeVat += vatAmt
    } else {
      expenses += amt
      expensesVat += vatAmt
    }
    if (doc.ai_needs_review) needsReviewCount++

    // Monthly breakdown
    if (doc.invoice_date) {
      const month = doc.invoice_date.slice(0, 7) // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0 }
      if (doc.type === 'outgoing_invoice') {
        monthlyData[month].income += doc.total ?? amt
      } else {
        monthlyData[month].expenses += doc.total ?? amt
      }
    }

    // Supplier history
    const suppId = doc.supplier_id
    if (suppId && doc.type !== 'outgoing_invoice') {
      if (!supplierHistory[suppId]) {
        const name = (doc.suppliers as unknown as { name: string } | null)?.name || 'Okänd'
        supplierHistory[suppId] = { name, amounts: [], months: new Set() }
      }
      supplierHistory[suppId].amounts.push(doc.total ?? amt)
      if (doc.invoice_date) {
        supplierHistory[suppId].months.add(doc.invoice_date.slice(0, 7))
      }
    }
  }

  // Anomaly detection: flag invoices that deviate >100% from supplier average
  const anomalies: { supplier: string; amount: number; average: number; message: string }[] = []
  for (const [, hist] of Object.entries(supplierHistory)) {
    if (hist.amounts.length < 2) continue
    const avg = hist.amounts.reduce((a, b) => a + b, 0) / hist.amounts.length
    for (const amt of hist.amounts) {
      if (avg > 0 && amt > avg * 2.5) {
        anomalies.push({
          supplier: hist.name,
          amount: amt,
          average: Math.round(avg),
          message: `${hist.name}: ${Math.round(amt)} kr är ovanligt högt (snitt ${Math.round(avg)} kr)`,
        })
      }
    }
  }

  // Missing recurring invoices: suppliers with 3+ invoices that are missing recent months
  const missing: { supplier: string; lastSeen: string; message: string }[] = []
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

  for (const [, hist] of Object.entries(supplierHistory)) {
    if (hist.amounts.length >= 3 && hist.months.size >= 3) {
      // This looks recurring — check if recent months are missing
      const sortedMonths = [...hist.months].sort()
      const latest = sortedMonths[sortedMonths.length - 1]
      if (latest < lastMonthStr) {
        missing.push({
          supplier: hist.name,
          lastSeen: latest,
          message: `${hist.name}: senaste faktura ${latest}, förväntas varje månad`,
        })
      }
    }
  }

  // Monthly breakdown sorted
  const monthly = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }))

  return NextResponse.json({
    income,
    income_vat: incomeVat,
    expenses,
    expenses_vat: expensesVat,
    result: income - expenses,
    vat_to_pay: incomeVat - expensesVat,
    document_count: documents.length,
    needs_review_count: needsReviewCount,
    anomalies,
    missing_recurring: missing,
    monthly_breakdown: monthly,
  })
}
