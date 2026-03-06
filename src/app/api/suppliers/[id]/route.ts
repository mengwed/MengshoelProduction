import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { supplierSchema, validateBody } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()

    const validated = validateBody(supplierSchema, body)
    if ('error' in validated) return validated.error

    const { data, error } = await supabase
      .from('suppliers')
      .update(validated.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    // Update category on all linked documents when supplier category changes
    if ('category_id' in validated.data) {
      await supabase
        .from('documents')
        .update({ category_id: validated.data.category_id })
        .eq('supplier_id', id)
    }

    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()

    const { error } = await supabase.from('suppliers').delete().eq('id', id)

    if (error) return apiError(error.message, 500)
    return apiSuccess({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
