import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: fiscalYear } = await supabase
    .from('fiscal_years')
    .select('id')
    .eq('is_active', true)
    .single()

  if (!fiscalYear) {
    return NextResponse.json([])
  }

  const { data, error } = await supabase
    .from('bank_transactions')
    .select('*, documents(file_name, type, invoice_number, total)')
    .eq('fiscal_year_id', fiscalYear.id)
    .order('booking_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
