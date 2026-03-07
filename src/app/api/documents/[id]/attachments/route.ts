import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

const MAX_ATTACHMENTS = 5
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('document_attachments')
      .select('*')
      .eq('document_id', id)
      .order('created_at', { ascending: true })

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()

    // Check document exists
    const { data: doc } = await supabase
      .from('documents')
      .select('fiscal_year_id, fiscal_years(year)')
      .eq('id', id)
      .single()

    if (!doc) return apiError('Document not found', 404)

    // Check attachment count
    const { count } = await supabase
      .from('document_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', id)

    if ((count ?? 0) >= MAX_ATTACHMENTS) {
      return apiError(`Max ${MAX_ATTACHMENTS} bilagor per dokument`, 400)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return apiError('No file provided', 400)

    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError('Filtypen stöds inte. Tillåtna: PDF, Word, Excel', 400)
    }

    const fiscalYears = doc.fiscal_years as unknown as { year: number } | null
    const fiscalYear = fiscalYears?.year ?? 'unknown'
    const uuid = crypto.randomUUID()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${fiscalYear}/attachments/${id}/${uuid}-${sanitizedName}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) return apiError(uploadError.message, 500)

    const { data: attachment, error: insertError } = await supabase
      .from('document_attachments')
      .insert({
        document_id: id,
        file_path: storagePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      })
      .select()
      .single()

    if (insertError) return apiError(insertError.message, 500)
    return apiSuccess(attachment)
  } catch (e) {
    return handleApiError(e)
  }
}
