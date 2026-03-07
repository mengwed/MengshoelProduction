import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiSuccess([])
    }

    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*, documents!matched_document_id(file_name, type, invoice_number, total)')
      .eq('fiscal_year_id', fiscalYear.id)
      .order('booking_date', { ascending: false })

    if (error) return apiError(error.message, 500)

    // Fetch AI suggestion documents separately for transactions that have one
    const txsWithAiSuggestion = (data ?? []).filter((t: Record<string, unknown>) => t.ai_suggestion_id)
    const aiDocIds = [...new Set(txsWithAiSuggestion.map((t: Record<string, unknown>) => t.ai_suggestion_id as string))]

    let aiDocsMap: Record<string, { file_name: string; type: string; invoice_number: string | null; total: number | null }> = {}
    if (aiDocIds.length > 0) {
      const { data: aiDocs } = await supabase
        .from('documents')
        .select('id, file_name, type, invoice_number, total')
        .in('id', aiDocIds)

      if (aiDocs) {
        aiDocsMap = Object.fromEntries(aiDocs.map(d => [d.id, { file_name: d.file_name, type: d.type, invoice_number: d.invoice_number, total: d.total }]))
      }
    }

    const result = (data ?? []).map((tx: Record<string, unknown>) => ({
      ...tx,
      ai_suggestion: tx.ai_suggestion_id ? aiDocsMap[tx.ai_suggestion_id as string] ?? null : null,
    }))

    return apiSuccess(result)
  } catch (e) {
    return handleApiError(e)
  }
}
