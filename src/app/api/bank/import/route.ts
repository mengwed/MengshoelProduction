import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { uploadLimiter } from '@/lib/rate-limit-instances'
import { createServiceClient } from '@/lib/supabase/server'
import { parseBank } from '@/lib/bank/parsers'
import { matchTransactions } from '@/lib/bank/match'

export async function POST(request: Request) {
  try {
    await requireAuth()

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateCheck = uploadLimiter.check(ip)
    if (!rateCheck.allowed) {
      return apiError('Too many requests', 429)
    }

    const supabase = createServiceClient()

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return apiError('No file provided', 400)
    }

    // Get active fiscal year
    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('*')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiError('No active fiscal year', 400)
    }

    // Parse Excel
    const buffer = await file.arrayBuffer()
    const { transactions } = parseBank(buffer)

    if (transactions.length === 0) {
      return apiError('Inga transaktioner hittades i filen', 400)
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
      match_confidence: m.match_confidence,
      import_batch_id: batchId,
    }))

    const { error } = await supabase.from('bank_transactions').insert(rows)

    if (error) {
      return apiError(error.message, 500)
    }

    const matchedCount = matched.filter(m => m.matched_document_id).length

    return apiSuccess({
      imported: transactions.length,
      matched: matchedCount,
      unmatched: transactions.length - matchedCount,
      batch_id: batchId,
    })
  } catch (e) {
    return handleApiError(e)
  }
}
