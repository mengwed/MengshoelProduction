import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const month = searchParams.get('month')
    const status = searchParams.get('status')
    const needsReview = searchParams.get('needsReview')
    const supplierId = searchParams.get('supplier_id')
    const customerId = searchParams.get('customer_id')
    const categoryId = searchParams.get('category_id')
    const search = searchParams.get('search')

    let query = supabase
      .from('documents')
      .select(`
        *,
        customers(name),
        suppliers(name),
        categories(name, emoji)
      `)
      .order('invoice_date', { ascending: false })

    if (type === 'outgoing') {
      query = query.eq('type', 'outgoing_invoice')
    } else if (type === 'incoming') {
      query = query.eq('type', 'incoming_invoice')
    } else if (type === 'other') {
      query = query.in('type', [
        'credit_card_statement', 'loan_statement',
        'government_fee', 'receipt', 'payment_received', 'other'
      ])
    }

    if (month) {
      query = query.gte('invoice_date', `${month}-01`).lte('invoice_date', `${month}-31`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (needsReview === 'true') {
      query = query.eq('ai_needs_review', true)
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId)
    }

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (search) {
      const term = `%${search}%`
      query = query.or(
        `file_name.ilike.${term},invoice_number.ilike.${term},suppliers.name.ilike.${term},customers.name.ilike.${term}`
      )
    }

    const { data, error } = await query

    if (error) return apiError(error.message, 500)

    // Flatten joined fields
    const documents = data?.map((doc: Record<string, unknown>) => ({
      ...doc,
      customer_name: (doc.customers as Record<string, string> | null)?.name,
      supplier_name: (doc.suppliers as Record<string, string> | null)?.name,
      category_name: (doc.categories as Record<string, string> | null)?.name,
      category_emoji: (doc.categories as Record<string, string> | null)?.emoji,
      customers: undefined,
      suppliers: undefined,
      categories: undefined,
    }))

    return apiSuccess(documents)
  } catch (e) {
    return handleApiError(e)
  }
}
