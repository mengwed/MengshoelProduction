import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { supplierSchema, validateBody } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter')

    let query = supabase
      .from('suppliers')
      .select('*, categories(name, emoji)')
      .order('name')

    if (filter === 'inactive') {
      query = query.eq('is_active', false)
    } else {
      query = query.neq('is_active', false)
    }

    const { data, error } = await query

    if (error) return apiError(error.message, 500)

    const suppliers = data?.map((s: Record<string, unknown>) => ({
      ...s,
      category_name: (s.categories as Record<string, string> | null)?.name,
      category_emoji: (s.categories as Record<string, string> | null)?.emoji,
      categories: undefined,
    }))

    return apiSuccess(suppliers)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const body = await request.json()

    const validated = validateBody(supplierSchema, body)
    if ('error' in validated) return validated.error

    const { data, error } = await supabase
      .from('suppliers')
      .insert(validated.data)
      .select()
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
