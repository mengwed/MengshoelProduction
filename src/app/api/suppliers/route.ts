import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('*, categories(name, emoji)')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const suppliers = data?.map((s: Record<string, unknown>) => ({
    ...s,
    category_name: (s.categories as Record<string, string> | null)?.name,
    category_emoji: (s.categories as Record<string, string> | null)?.emoji,
    categories: undefined,
  }))

  return NextResponse.json(suppliers)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('suppliers')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
