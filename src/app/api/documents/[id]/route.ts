import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  // Load current document to detect corrections
  const { data: current } = await supabase
    .from('documents')
    .select('*, customers(name), suppliers(name)')
    .eq('id', id)
    .single()

  if (current) {
    const corrections: { field_name: string; ai_value: string | null; corrected_value: string; counterpart_name: string | null }[] = []
    const counterpart = (current.customers as { name: string } | null)?.name
      || (current.suppliers as { name: string } | null)?.name
      || null

    // Track type changes
    if (body.type && body.type !== current.type) {
      corrections.push({
        field_name: 'type',
        ai_value: current.type,
        corrected_value: body.type,
        counterpart_name: counterpart,
      })
    }

    // Track category changes
    if (body.category_id !== undefined && body.category_id !== current.category_id) {
      corrections.push({
        field_name: 'category_id',
        ai_value: current.category_id?.toString() || null,
        corrected_value: body.category_id?.toString() || 'null',
        counterpart_name: counterpart,
      })
    }

    // Track supplier/customer reassignment
    if (body.supplier_id !== undefined && body.supplier_id !== current.supplier_id) {
      corrections.push({
        field_name: 'supplier_id',
        ai_value: current.supplier_id?.toString() || null,
        corrected_value: body.supplier_id?.toString() || 'null',
        counterpart_name: counterpart,
      })
    }

    if (body.customer_id !== undefined && body.customer_id !== current.customer_id) {
      corrections.push({
        field_name: 'customer_id',
        ai_value: current.customer_id?.toString() || null,
        corrected_value: body.customer_id?.toString() || 'null',
        counterpart_name: counterpart,
      })
    }

    if (corrections.length > 0) {
      await supabase.from('ai_corrections').insert(
        corrections.map(c => ({ ...c, document_id: id }))
      )
    }

    // If user sets a category and doc has a supplier, save the mapping for future auto-categorization
    if (body.category_id && current.supplier_id) {
      await supabase
        .from('suppliers')
        .update({ category_id: body.category_id })
        .eq('id', current.supplier_id)
    }
  }

  const { data, error } = await supabase
    .from('documents')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  // Delete file from storage
  const { data: doc } = await supabase.from('documents').select('file_path').eq('id', id).single()
  if (doc) {
    await supabase.storage.from('documents').remove([doc.file_path])
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
