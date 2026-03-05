import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fiscal_years')
    .select('*')
    .order('year', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { year_id } = await request.json()

  // Deactivate all
  await supabase.from('fiscal_years').update({ is_active: false }).neq('id', 0)
  // Activate selected
  const { error } = await supabase.from('fiscal_years').update({ is_active: true }).eq('id', year_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
