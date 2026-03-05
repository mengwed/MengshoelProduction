import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Get active fiscal year
  const { data: fiscalYear } = await supabase
    .from('fiscal_years')
    .select('id')
    .eq('is_active', true)
    .single()

  if (!fiscalYear) {
    return NextResponse.json({ error: 'No active fiscal year' }, { status: 400 })
  }

  // Get all documents for this fiscal year
  const { data: documents } = await supabase
    .from('documents')
    .select('type, amount, vat, ai_needs_review')
    .eq('fiscal_year_id', fiscalYear.id)

  if (!documents) {
    return NextResponse.json({
      income: 0, income_vat: 0, expenses: 0, expenses_vat: 0,
      result: 0, vat_to_pay: 0, document_count: 0, needs_review_count: 0,
    })
  }

  let income = 0
  let incomeVat = 0
  let expenses = 0
  let expensesVat = 0
  let needsReviewCount = 0

  for (const doc of documents) {
    if (doc.type === 'outgoing_invoice') {
      income += doc.amount ?? 0
      incomeVat += doc.vat ?? 0
    } else {
      expenses += doc.amount ?? 0
      expensesVat += doc.vat ?? 0
    }
    if (doc.ai_needs_review) needsReviewCount++
  }

  return NextResponse.json({
    income,
    income_vat: incomeVat,
    expenses,
    expenses_vat: expensesVat,
    result: income - expenses,
    vat_to_pay: incomeVat - expensesVat,
    document_count: documents.length,
    needs_review_count: needsReviewCount,
  })
}
