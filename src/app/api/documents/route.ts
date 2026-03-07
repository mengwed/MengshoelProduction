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
    const allYears = searchParams.get('all_years')

    let query = supabase
      .from('documents')
      .select(`
        *,
        customers(name),
        suppliers(name),
        categories(name, emoji),
        document_attachments(id),
        bank_transactions!matched_document_id(id)
      `)
      .order('invoice_date', { ascending: false })

    if (allYears !== 'true') {
      query = query.eq('fiscal_year_id', fiscalYear.id)
    }

    if (type === 'outgoing') {
      query = query.eq('type', 'outgoing_invoice')
    } else if (type === 'incoming') {
      query = query.eq('type', 'incoming_invoice')
    } else if (type === 'other') {
      query = query.not('type', 'in', '("outgoing_invoice","incoming_invoice")')
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
      // Normalize to NFC to handle macOS NFD file names vs composed search input
      const normalized = search.normalize('NFC')
      const term = `%${normalized}%`

      // Also create an ASCII-folded version (ä→a, ö→o, å→a) for fallback matching
      const asciiTerm = `%${normalized.replace(/[åÅ]/g, m => m === 'å' ? 'a' : 'A').replace(/[äÄ]/g, m => m === 'ä' ? 'a' : 'A').replace(/[öÖ]/g, m => m === 'ö' ? 'o' : 'O')}%`
      // And the NFD version in case the DB has decomposed characters
      const nfdTerm = `%${search.normalize('NFD')}%`

      // Find matching supplier/customer IDs first
      const [{ data: matchingSuppliers }, { data: matchingCustomers }] = await Promise.all([
        supabase.from('suppliers').select('id').or(`name.ilike.${term},name.ilike.${asciiTerm},name.ilike.${nfdTerm}`),
        supabase.from('customers').select('id').or(`name.ilike.${term},name.ilike.${asciiTerm},name.ilike.${nfdTerm}`),
      ])

      const orFilters = [
        `file_name.ilike.${term}`,
        `file_name.ilike.${nfdTerm}`,
        `invoice_number.ilike.${term}`,
      ]
      // Add ASCII fallback if it differs from the original
      if (asciiTerm !== term) {
        orFilters.push(`file_name.ilike.${asciiTerm}`)
      }

      // Allow searching by amount, total, and vat (range ±10 for rounding)
      const numericSearch = parseFloat(search.replace(/\s/g, '').replace(/,/g, '.'))
      if (!isNaN(numericSearch)) {
        const lo = numericSearch - 10
        const hi = numericSearch + 10
        const nlo = -numericSearch - 10
        const nhi = -numericSearch + 10
        orFilters.push(`and(amount.gte.${lo},amount.lte.${hi})`)
        orFilters.push(`and(amount.gte.${nlo},amount.lte.${nhi})`)
        orFilters.push(`and(total.gte.${lo},total.lte.${hi})`)
        orFilters.push(`and(total.gte.${nlo},total.lte.${nhi})`)
        orFilters.push(`and(vat.gte.${lo},vat.lte.${hi})`)
        orFilters.push(`and(vat.gte.${nlo},vat.lte.${nhi})`)
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
      attachment_count: Array.isArray(doc.document_attachments) ? doc.document_attachments.length : 0,
      has_bank_match: Array.isArray(doc.bank_transactions) && doc.bank_transactions.length > 0,
      customers: undefined,
      suppliers: undefined,
      categories: undefined,
      document_attachments: undefined,
      bank_transactions: undefined,
    }))

    return apiSuccess(documents)
  } catch (e) {
    return handleApiError(e)
  }
}
