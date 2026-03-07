import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    // Look up active fiscal year to filter documents
    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('id')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiError('No active fiscal year', 400)
    }

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
      .eq('fiscal_year_id', fiscalYear.id)

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

      // Find matching supplier/customer IDs first
      const [{ data: matchingSuppliers }, { data: matchingCustomers }] = await Promise.all([
        supabase.from('suppliers').select('id').ilike('name', term),
        supabase.from('customers').select('id').ilike('name', term),
      ])

      const orFilters = [`file_name.ilike.${term}`, `invoice_number.ilike.${term}`]

      // Allow searching by amount (exact or close match)
      const numericSearch = parseFloat(search.replace(/\s/g, '').replace(/,/g, '.'))
      if (!isNaN(numericSearch)) {
        orFilters.push(`total.eq.${numericSearch}`)
        orFilters.push(`total.eq.${-numericSearch}`)
        orFilters.push(`amount.eq.${numericSearch}`)
        orFilters.push(`amount.eq.${-numericSearch}`)
      }
      if (matchingSuppliers?.length) {
        orFilters.push(`supplier_id.in.(${matchingSuppliers.map(s => s.id).join(',')})`)
      }
      if (matchingCustomers?.length) {
        orFilters.push(`customer_id.in.(${matchingCustomers.map(c => c.id).join(',')})`)
      }

      query = query.or(orFilters.join(','))
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
