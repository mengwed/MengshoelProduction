import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    await requireAuth()
    const { id, attachmentId } = await params
    const supabase = createServiceClient()

    const { data: attachment } = await supabase
      .from('document_attachments')
      .select('file_path, file_type, file_name')
      .eq('id', attachmentId)
      .eq('document_id', id)
      .single()

    if (!attachment) return apiError('Attachment not found', 404)

    const isPdf = attachment.file_type === 'application/pdf'

    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(attachment.file_path, 3600, {
        download: !isPdf ? attachment.file_name : undefined,
      })

    if (!data) return apiError('Could not generate URL', 500)
    return apiSuccess({ url: data.signedUrl, file_type: attachment.file_type })
  } catch (e) {
    return handleApiError(e)
  }
}
