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

    if ('matched_document_id' in body) {
      update.matched_document_id = body.matched_document_id
      update.match_confidence = body.matched_document_id ? 1.0 : null
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
