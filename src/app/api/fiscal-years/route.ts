import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('fiscal_years')
      .select('*')
      .order('year', { ascending: false })

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const { year } = await request.json()

    if (!year || year < 2000 || year > 2100) {
      return apiError('Ogiltigt år', 400)
    }

    const { data, error } = await supabase
      .from('fiscal_years')
      .insert({ year, is_active: false })
      .select()
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data, 201)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const { year_id } = await request.json()

    // Deactivate all
    await supabase.from('fiscal_years').update({ is_active: false }).neq('id', 0)
    // Activate selected
    const { error } = await supabase.from('fiscal_years').update({ is_active: true }).eq('id', year_id)

    if (error) return apiError(error.message, 500)
    return apiSuccess({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
