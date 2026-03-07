import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { uploadLimiter } from '@/lib/rate-limit-instances'
import { createServiceClient } from '@/lib/supabase/server'
import { parseBank } from '@/lib/bank/parsers'
import { matchTransactions } from '@/lib/bank/match'
import { aiMatchTransactions } from '@/lib/bank/ai-match'
import type { DocumentSummary } from '@/lib/bank/ai-match'

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

    // Balance verification
    let balanceWarning: string | null = null
    for (let i = 1; i < transactions.length; i++) {
      const prev = transactions[i - 1]
      const curr = transactions[i]
      if (prev.balance !== null && curr.balance !== null) {
        const expectedBalance = prev.balance + curr.amount
        if (Math.abs(expectedBalance - curr.balance) > 0.01) {
          balanceWarning = `Saldoavvikelse på rad ${i + 1}: förväntade ${expectedBalance.toFixed(2)}, fick ${curr.balance.toFixed(2)}`
          break
        }
      }
    }

    // Duplicate detection: check existing transactions
    const { data: existingTx } = await supabase
      .from('bank_transactions')
      .select('booking_date, amount, reference')
      .eq('fiscal_year_id', fiscalYear.id)

    const existingSet = new Set(
      existingTx?.map(t => `${t.booking_date}|${t.amount}|${t.reference || ''}`) || []
    )

    const uniqueTransactions = transactions.filter(t => {
      const key = `${t.booking_date}|${t.amount}|${t.reference || ''}`
      return !existingSet.has(key)
    })

    const duplicateCount = transactions.length - uniqueTransactions.length

    if (uniqueTransactions.length === 0) {
      return apiSuccess({
        imported: 0,
        rule_matched: 0,
        ai_matched: 0,
        unmatched: 0,
        duplicates: duplicateCount,
        balance_warning: balanceWarning,
      })
    }

    // Rule-based matching
    const ruleMatched = await matchTransactions(uniqueTransactions, fiscalYear.id)

    // Collect unmatched for AI
    const unmatchedForAI = ruleMatched
      .map((m, i) => ({ ...m, originalIndex: i }))
      .filter(m => !m.matched_document_id)

    let aiError: string | undefined
    let aiMatchCount = 0
    const aiSuggestionMap = new Map<number, { documentId: string; confidence: number; explanation: string }>()

    if (unmatchedForAI.length > 0) {
      // Load documents for AI matching
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

      const unmatchedTxs = unmatchedForAI.map((m, i) => ({
        index: i,
        booking_date: m.transaction.booking_date,
        transaction_type: m.transaction.transaction_type,
        reference: m.transaction.reference,
        amount: m.transaction.amount,
      }))

      try {
        const aiResult = await aiMatchTransactions(unmatchedTxs, documentSummaries)
        if (aiResult.error) {
          aiError = aiResult.error
        }
        for (const suggestion of aiResult.suggestions) {
          if (suggestion.documentId && suggestion.confidence > 0) {
            const originalIdx = unmatchedForAI[suggestion.transactionIndex]?.originalIndex
            if (originalIdx !== undefined) {
              aiSuggestionMap.set(originalIdx, {
                documentId: suggestion.documentId,
                confidence: suggestion.confidence,
                explanation: suggestion.explanation,
              })
              aiMatchCount++
            }
          }
        }
        // Also store explanations for unmatched
        for (const suggestion of aiResult.suggestions) {
          if (!suggestion.documentId) {
            const originalIdx = unmatchedForAI[suggestion.transactionIndex]?.originalIndex
            if (originalIdx !== undefined && !aiSuggestionMap.has(originalIdx)) {
              aiSuggestionMap.set(originalIdx, {
                documentId: '',
                confidence: 0,
                explanation: suggestion.explanation,
              })
            }
          }
        }
      } catch {
        aiError = 'AI-matchning misslyckades'
      }
    }

    // Insert into bank_transactions
    const batchId = crypto.randomUUID()
    const rows = ruleMatched.map((m, i) => {
      const aiSuggestion = aiSuggestionMap.get(i)
      const isRuleMatched = !!m.matched_document_id

      return {
        fiscal_year_id: fiscalYear.id,
        booking_date: m.transaction.booking_date,
        transaction_date: m.transaction.transaction_date,
        transaction_type: m.transaction.transaction_type,
        reference: m.transaction.reference,
        amount: m.transaction.amount,
        balance: m.transaction.balance,
        matched_document_id: m.matched_document_id,
        match_confidence: m.match_confidence,
        ai_suggestion_id: aiSuggestion?.documentId || null,
        ai_confidence: aiSuggestion?.confidence ?? null,
        ai_explanation: aiSuggestion?.explanation ?? null,
        match_status: isRuleMatched ? 'pending' : (aiSuggestion?.documentId ? 'pending' : null),
        import_batch_id: batchId,
      }
    })

    const { error } = await supabase.from('bank_transactions').insert(rows)

    if (error) {
      return apiError(error.message, 500)
    }

    const ruleMatchedCount = ruleMatched.filter(m => m.matched_document_id).length

    return apiSuccess({
      imported: uniqueTransactions.length,
      rule_matched: ruleMatchedCount,
      ai_matched: aiMatchCount,
      unmatched: uniqueTransactions.length - ruleMatchedCount - aiMatchCount,
      duplicates: duplicateCount,
      balance_warning: balanceWarning,
      ...(aiError ? { ai_error: aiError } : {}),
    })
  } catch (e) {
    return handleApiError(e)
  }
}
