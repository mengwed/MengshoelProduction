import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()

    const { data: doc } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', id)
      .single()

    if (!doc) {
      return apiError('Document not found', 404)
    }

    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600)

    if (!data) {
      return apiError('Could not generate URL', 500)
    }

    return apiSuccess({ url: data.signedUrl })
  } catch (e) {
    return handleApiError(e)
  }
}
