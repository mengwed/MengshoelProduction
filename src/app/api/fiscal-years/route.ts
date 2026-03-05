import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('fiscal_years')
    .select('*')
    .order('year', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const { year } = await request.json()

  if (!year || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Ogiltigt år' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('fiscal_years')
    .insert({ year, is_active: false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const supabase = createServiceClient()
  const { year_id } = await request.json()

  // Deactivate all
  await supabase.from('fiscal_years').update({ is_active: false }).neq('id', 0)
  // Activate selected
  const { error } = await supabase.from('fiscal_years').update({ is_active: true }).eq('id', year_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
