import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('id, year')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiError('No active fiscal year', 400)
    }

    const { data: documents } = await supabase
      .from('documents')
      .select('id, type, amount, vat, vat_paid, total, ai_needs_review, invoice_date, invoice_number, supplier_id, customer_id, category_id, suppliers(name), customers(name), categories(name)')
      .eq('fiscal_year_id', fiscalYear.id)

    if (!documents) {
      return apiSuccess({
        income: 0, income_vat: 0, expenses: 0, expenses_vat: 0,
        result: 0, vat_to_pay: 0, vat_payments: 0, vat_paid_marked: 0,
        document_count: 0, needs_review_count: 0,
        anomalies: [], missing_recurring: [], invoice_warnings: [], monthly_breakdown: [],
      })
    }

    let income = 0, incomeVat = 0, expenses = 0, expensesVat = 0, needsReviewCount = 0
    let vatPayments = 0, vatPaidMarked = 0

    // Group by supplier for anomaly + recurring detection
    const supplierHistory: Record<number, { name: string; entries: { amount: number; documentId: string; docType: string }[]; months: Set<string>; latestDocId: string | null; latestDocType: string | null }> = {}
    const monthlyData: Record<string, { income: number; expenses: number }> = {}

    for (const doc of documents) {
      const amt = doc.amount ?? 0
      const vatAmt = doc.vat ?? 0

      // Skip VAT payments (e.g. momsbetalning to Skatteverket) — these are not business expenses
      const categoryName = (doc.categories as unknown as { name: string } | null)?.name?.toLowerCase() ?? ''
      const isVatPayment = categoryName === 'moms'

      // Skip bank/credit card statements from all summaries — they are informational only
      const isStatement = doc.type === 'credit_card_statement'

      if (doc.type === 'outgoing_invoice') {
        income += amt
        incomeVat += vatAmt
        if (doc.vat_paid) vatPaidMarked += vatAmt
      } else if (isVatPayment) {
        vatPayments += doc.total ?? amt
      } else if (!isStatement) {
        expenses += amt
        expensesVat += vatAmt
      }
      if (doc.ai_needs_review) needsReviewCount++

      // Monthly breakdown (only include months within the fiscal year)
      if (doc.invoice_date) {
        const month = doc.invoice_date.slice(0, 7) // YYYY-MM
        const docYear = parseInt(month.slice(0, 4), 10)
        if (docYear === fiscalYear.year) {
          if (!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0 }
          if (doc.type === 'outgoing_invoice') {
            monthlyData[month].income += doc.total ?? amt
          } else if (!isVatPayment && !isStatement) {
            monthlyData[month].expenses += doc.total ?? amt
          }
        }
      }

      // Supplier history
      const suppId = doc.supplier_id
      if (suppId && doc.type !== 'outgoing_invoice' && !isStatement) {
        if (!supplierHistory[suppId]) {
          const name = (doc.suppliers as unknown as { name: string } | null)?.name || 'Okänd'
          supplierHistory[suppId] = { name, entries: [], months: new Set(), latestDocId: null, latestDocType: null }
        }
        supplierHistory[suppId].entries.push({ amount: doc.total ?? amt, documentId: doc.id, docType: doc.type })
        if (doc.invoice_date) {
          supplierHistory[suppId].months.add(doc.invoice_date.slice(0, 7))
        }
        supplierHistory[suppId].latestDocId = doc.id
        supplierHistory[suppId].latestDocType = doc.type
      }
    }

    // Anomaly detection: flag invoices that deviate >100% from supplier average
    const anomalies: { supplier: string; amount: number; average: number; message: string; document_id: string; doc_type: string }[] = []
    for (const [, hist] of Object.entries(supplierHistory)) {
      if (hist.entries.length < 2) continue
      const avg = hist.entries.reduce((a, b) => a + b.amount, 0) / hist.entries.length
      for (const entry of hist.entries) {
        if (avg > 0 && entry.amount > avg * 2.5) {
          anomalies.push({
            supplier: hist.name,
            amount: entry.amount,
            average: Math.round(avg),
            message: `${hist.name}: ${Math.round(entry.amount)} kr är ovanligt högt (snitt ${Math.round(avg)} kr)`,
            document_id: entry.documentId,
            doc_type: entry.docType,
          })
        }
      }
    }

    // Missing recurring invoices: suppliers with 3+ invoices that are missing recent months
    const missing: { supplier: string; lastSeen: string; message: string; document_id: string | null; doc_type: string | null }[] = []
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

    for (const [, hist] of Object.entries(supplierHistory)) {
      if (hist.entries.length >= 3 && hist.months.size >= 3) {
        // This looks recurring — check if recent months are missing
        const sortedMonths = [...hist.months].sort()
        const latest = sortedMonths[sortedMonths.length - 1]
        if (latest < lastMonthStr) {
          missing.push({
            supplier: hist.name,
            lastSeen: latest,
            message: `${hist.name}: senaste faktura ${latest}, förväntas varje månad`,
            document_id: hist.latestDocId,
            doc_type: hist.latestDocType,
          })
        }
      }
    }

    // Detect issues in outgoing invoice number sequences
    const invoiceWarnings: { type: 'gap' | 'duplicate'; message: string }[] = []
    const outgoingInvoices = documents
      .filter(d => d.type === 'outgoing_invoice' && d.invoice_number)
    const outgoingNumberStrings = outgoingInvoices.map(d => d.invoice_number!)
    const outgoingNumbers = outgoingNumberStrings
      .filter(n => /^\d+$/.test(n))
      .map(n => parseInt(n, 10))
      .sort((a, b) => a - b)

    // Detect duplicates
    const countMap: Record<string, number> = {}
    for (const num of outgoingNumberStrings) {
      countMap[num] = (countMap[num] || 0) + 1
    }
    const duplicates = Object.entries(countMap)
      .filter(([, count]) => count > 1)
      .map(([num, count]) => `${num} (${count} st)`)
    if (duplicates.length > 0) {
      invoiceWarnings.push({
        type: 'duplicate',
        message: `Kundfakturanummer ${duplicates.join(', ')} finns flera gånger — kontrollera att det stämmer!`,
      })
    }

    // Detect gaps
    if (outgoingNumbers.length >= 2) {
      const unique = [...new Set(outgoingNumbers)]
      const missingNumbers: number[] = []
      for (let i = 1; i < unique.length; i++) {
        const prev = unique[i - 1]
        const curr = unique[i]
        if (curr - prev > 1 && curr - prev <= 10) {
          for (let n = prev + 1; n < curr; n++) {
            missingNumbers.push(n)
          }
        }
      }
      if (missingNumbers.length > 0) {
        invoiceWarnings.push({
          type: 'gap',
          message: `Kundfaktura ${missingNumbers.join(', ')} saknas i nummerserien — har dessa skickats till revisorn?`,
        })
      }
    }

    // Monthly breakdown sorted
    const monthly = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }))

    return apiSuccess({
      income,
      income_vat: incomeVat,
      expenses,
      expenses_vat: expensesVat,
      result: income - expenses,
      vat_to_pay: incomeVat,
      vat_payments: vatPayments,
      vat_paid_marked: vatPaidMarked,
      document_count: documents.length,
      needs_review_count: needsReviewCount,
      anomalies,
      missing_recurring: missing,
      invoice_warnings: invoiceWarnings,
      monthly_breakdown: monthly,
    })
  } catch (e) {
    return handleApiError(e)
  }
}
