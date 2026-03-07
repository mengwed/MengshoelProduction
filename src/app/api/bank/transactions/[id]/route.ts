import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()

    const update: Record<string, unknown> = {}

    if ('action' in body) {
      switch (body.action) {
        case 'approve': {
          // First get the transaction to copy ai_suggestion_id
          const { data: tx } = await supabase
            .from('bank_transactions')
            .select('ai_suggestion_id, ai_confidence')
            .eq('id', id)
            .single()

          if (tx?.ai_suggestion_id) {
            update.matched_document_id = tx.ai_suggestion_id
            update.match_confidence = tx.ai_confidence
          }
          update.match_status = 'approved'
          break
        }
        case 'reject':
          update.matched_document_id = null
          update.match_confidence = null
          update.match_status = 'rejected'
          break
        case 'manual':
          if (!body.document_id) {
            return apiError('document_id required for manual match', 400)
          }
          update.matched_document_id = body.document_id
          update.match_confidence = 1.0
          update.match_status = 'manual'
          break
        case 'unlink':
          update.matched_document_id = null
          update.match_confidence = null
          update.match_status = null
          break
        default:
          return apiError(`Unknown action: ${body.action}`, 400)
      }
    } else if ('matched_document_id' in body) {
      // Backward compatibility
      update.matched_document_id = body.matched_document_id
      update.match_confidence = body.matched_document_id ? 1.0 : null
      update.match_status = body.matched_document_id ? 'manual' : null
    }

    const { data, error } = await supabase
      .from('bank_transactions')
      .update(update)
      .eq('id', id)
      .select('*, documents(file_name, type, invoice_number, total)')
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}
