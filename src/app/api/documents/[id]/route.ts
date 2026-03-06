import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { documentUpdateSchema, validateBody } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()

    const validated = validateBody(documentUpdateSchema, body)
    if ('error' in validated) return validated.error

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
      if (validated.data.type && validated.data.type !== current.type) {
        corrections.push({
          field_name: 'type',
          ai_value: current.type,
          corrected_value: validated.data.type,
          counterpart_name: counterpart,
        })
      }

      // Track category changes
      if (validated.data.category_id !== undefined && validated.data.category_id !== current.category_id) {
        corrections.push({
          field_name: 'category_id',
          ai_value: current.category_id?.toString() || null,
          corrected_value: validated.data.category_id?.toString() || 'null',
          counterpart_name: counterpart,
        })
      }

      // Track supplier/customer reassignment
      if (validated.data.supplier_id !== undefined && validated.data.supplier_id !== current.supplier_id) {
        corrections.push({
          field_name: 'supplier_id',
          ai_value: current.supplier_id?.toString() || null,
          corrected_value: validated.data.supplier_id?.toString() || 'null',
          counterpart_name: counterpart,
        })
      }

      if (validated.data.customer_id !== undefined && validated.data.customer_id !== current.customer_id) {
        corrections.push({
          field_name: 'customer_id',
          ai_value: current.customer_id?.toString() || null,
          corrected_value: validated.data.customer_id?.toString() || 'null',
          counterpart_name: counterpart,
        })
      }

      if (corrections.length > 0) {
        await supabase.from('ai_corrections').insert(
          corrections.map(c => ({ ...c, document_id: id }))
        )
      }

      // If user sets a category and doc has a supplier/customer, propagate to all their documents
      if (validated.data.category_id !== undefined && current.supplier_id) {
        await supabase
          .from('suppliers')
          .update({ category_id: validated.data.category_id })
          .eq('id', current.supplier_id)
        // Update all documents from this supplier that don't have a category yet (or update all)
        await supabase
          .from('documents')
          .update({ category_id: validated.data.category_id })
          .eq('supplier_id', current.supplier_id)
      }
      if (validated.data.category_id !== undefined && current.customer_id) {
        await supabase
          .from('documents')
          .update({ category_id: validated.data.category_id })
          .eq('customer_id', current.customer_id)
      }
    }

    const { data, error } = await supabase
      .from('documents')
      .update(validated.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return apiError(error.message, 500)
    return apiSuccess(data)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()

    // Delete file from storage
    const { data: doc } = await supabase.from('documents').select('file_path').eq('id', id).single()
    if (doc) {
      await supabase.storage.from('documents').remove([doc.file_path])
    }

    const { error } = await supabase.from('documents').delete().eq('id', id)

    if (error) return apiError(error.message, 500)
    return apiSuccess({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
