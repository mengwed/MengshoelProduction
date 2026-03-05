import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { customerSchema, validateBody } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('customers').select('*').order('name')

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const body = await request.json()

    const validated = validateBody(customerSchema, body)
    if ('error' in validated) return validated.error

    const { data, error } = await supabase
      .from('customers')
      .insert(validated.data)
      .select()
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
