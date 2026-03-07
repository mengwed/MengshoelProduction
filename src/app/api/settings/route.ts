import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const body = await request.json()

    // Get existing settings
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .single()

    if (existing) {
      const { data, error } = await supabase
        .from('company_settings')
        .update({
          company_name: body.company_name,
          organization_type: body.organization_type,
          owner_name: body.owner_name ?? null,
          industry: body.industry ?? null,
          notes: body.notes ?? null,
          show_reparse_button: body.show_reparse_button ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return apiError(error.message, 500)
      return apiSuccess(data)
    } else {
      const { data, error } = await supabase
        .from('company_settings')
        .insert({
          company_name: body.company_name,
          organization_type: body.organization_type,
          owner_name: body.owner_name ?? null,
          industry: body.industry ?? null,
          notes: body.notes ?? null,
          show_reparse_button: body.show_reparse_button ?? false,
        })
        .select()
        .single()

      if (error) return apiError(error.message, 500)
      return apiSuccess(data, 201)
    }
  } catch (e) {
    return handleApiError(e)
  }
}
