import { requireAuth } from '@/lib/auth'
import { apiSuccess, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()

    const { data } = await supabase
      .from('bank_transactions')
      .select('id, booking_date, transaction_type, reference, amount')
      .eq('matched_document_id', id)
      .order('booking_date', { ascending: false })

    return apiSuccess(data ?? [])
  } catch (e) {
    return handleApiError(e)
  }
}
