import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { categorySchema, validateBody } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()

    const validated = validateBody(categorySchema, body)
    if ('error' in validated) return validated.error

    const { data, error } = await supabase
      .from('categories')
      .update(validated.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return apiError(error.message, 500)
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

    // Remove category references first
    await supabase.from('suppliers').update({ category_id: null }).eq('category_id', id)
    await supabase.from('documents').update({ category_id: null }).eq('category_id', id)

    const { error } = await supabase.from('categories').delete().eq('id', id)

    if (error) return apiError(error.message, 500)
    return apiSuccess({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
