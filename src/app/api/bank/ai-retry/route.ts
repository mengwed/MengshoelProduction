import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'
import { aiMatchTransactions } from '@/lib/bank/ai-match'
import type { DocumentSummary } from '@/lib/bank/ai-match'

export async function POST() {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiError('No active fiscal year', 400)
    }

    // Load unmatched transactions
    const { data: unmatchedTxs } = await supabase
      .from('bank_transactions')
      .select('id, booking_date, transaction_type, reference, amount')
      .eq('fiscal_year_id', fiscalYear.id)
      .is('matched_document_id', null)
      .or('match_status.is.null,match_status.eq.rejected')

    if (!unmatchedTxs || unmatchedTxs.length === 0) {
      return apiSuccess({ ai_matched: 0, message: 'Inga omatchade transaktioner att köra AI på' })
    }

    // Load documents
    const { data: docs } = await supabase
      .from('documents')
      .select('id, type, invoice_number, invoice_date, amount, vat, total, suppliers(name), customers(name)')
      .eq('fiscal_year_id', fiscalYear.id)

    const documentSummaries: DocumentSummary[] = (docs ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      type: d.type as string,
      invoice_number: d.invoice_number as string | null,
      invoice_date: d.invoice_date as string | null,
      amount: d.amount as number | null,
      vat: d.vat as number | null,
      total: d.total as number | null,
      supplier_name: (d.suppliers as Record<string, string> | null)?.name ?? null,
      customer_name: (d.customers as Record<string, string> | null)?.name ?? null,
    }))

    const txsForAI = unmatchedTxs.map((tx, i) => ({
      index: i,
      booking_date: tx.booking_date,
      transaction_type: tx.transaction_type,
      reference: tx.reference,
      amount: tx.amount,
    }))

    const result = await aiMatchTransactions(txsForAI, documentSummaries)

    if (result.error) {
      return apiError(result.error, 500)
    }

    let aiMatchCount = 0

    for (const suggestion of result.suggestions) {
      const tx = unmatchedTxs[suggestion.transactionIndex]
      if (!tx) continue

      const update: Record<string, unknown> = {
        ai_explanation: suggestion.explanation,
      }

      if (suggestion.documentId && suggestion.confidence > 0) {
        update.ai_suggestion_id = suggestion.documentId
        update.ai_confidence = suggestion.confidence
        update.match_status = 'pending'
        aiMatchCount++
      }

      await supabase
        .from('bank_transactions')
        .update(update)
        .eq('id', tx.id)
    }

    return apiSuccess({ ai_matched: aiMatchCount })
  } catch (e) {
    return handleApiError(e)
  }
}
