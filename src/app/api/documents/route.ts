import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type')
  const month = searchParams.get('month')
  const status = searchParams.get('status')
  const needsReview = searchParams.get('needsReview')

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
    query = query.in('type', [
      'incoming_invoice', 'credit_card_statement', 'government_fee',
      'loan_statement', 'receipt', 'other'
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

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  return NextResponse.json(documents)
}
