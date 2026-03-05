import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiSuccess([])
    }

    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*, documents(file_name, type, invoice_number, total)')
      .eq('fiscal_year_id', fiscalYear.id)
      .order('booking_date', { ascending: false })

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}
