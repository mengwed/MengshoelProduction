import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    await requireAuth()
    const { id, attachmentId } = await params
    const supabase = createServiceClient()

    const { data: attachment } = await supabase
      .from('document_attachments')
      .select('file_path')
      .eq('id', attachmentId)
      .eq('document_id', id)
      .single()

    if (!attachment) return apiError('Attachment not found', 404)

    await supabase.storage.from('documents').remove([attachment.file_path])

    const { error } = await supabase
      .from('document_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) return apiError(error.message, 500)
    return apiSuccess({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
