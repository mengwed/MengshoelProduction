import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseSwedbank } from '@/lib/bank/parse-swedbank'
import { matchTransactions } from '@/lib/bank/match'

export async function POST(request: Request) {
  const supabase = await createClient()

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Get active fiscal year
  const { data: fiscalYear } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!fiscalYear) {
    return NextResponse.json({ error: 'No active fiscal year' }, { status: 400 })
  }

  // Parse Excel
  const buffer = await file.arrayBuffer()
  const transactions = parseSwedbank(buffer)

  if (transactions.length === 0) {
    return NextResponse.json({ error: 'Inga transaktioner hittades i filen' }, { status: 400 })
  }

  // Match against documents
  const matched = await matchTransactions(transactions, fiscalYear.id)

  // Insert into bank_transactions
  const batchId = crypto.randomUUID()
  const rows = matched.map((m) => ({
    fiscal_year_id: fiscalYear.id,
    booking_date: m.transaction.booking_date,
    transaction_date: m.transaction.transaction_date,
    transaction_type: m.transaction.transaction_type,
    reference: m.transaction.reference,
    amount: m.transaction.amount,
    balance: m.transaction.balance,
    matched_document_id: m.matched_document_id,
    import_batch_id: batchId,
  }))

  const { error } = await supabase.from('bank_transactions').insert(rows)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const matchedCount = matched.filter(m => m.matched_document_id).length

  return NextResponse.json({
    imported: transactions.length,
    matched: matchedCount,
    unmatched: transactions.length - matchedCount,
    batch_id: batchId,
  })
}
