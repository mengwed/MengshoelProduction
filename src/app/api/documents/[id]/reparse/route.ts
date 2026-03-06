import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { sanitizeObject } from '@/lib/sanitize'
import { createServiceClient } from '@/lib/supabase/server'
import { extractFromPDF } from '@/lib/ai/extract'
import { validateExtractionResult } from '@/lib/ai/validate'
import { findMatchingCustomer, findMatchingSupplier } from '@/lib/matching'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = createServiceClient()

    // Load the document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (docError || !doc) return apiError('Document not found', 404)

    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.file_path)

    if (downloadError || !fileData) return apiError('Could not download PDF', 500)

    const buffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // Load context for AI
    const [
      { data: existingSuppliers },
      { data: existingCustomers },
      { data: existingCategories },
      { data: recentCorrections },
    ] = await Promise.all([
      supabase.from('suppliers').select('name').order('name'),
      supabase.from('customers').select('name').order('name'),
      supabase.from('categories').select('name, emoji'),
      supabase.from('ai_corrections').select('*').order('created_at', { ascending: false }).limit(20),
    ])

    const context = {
      suppliers: existingSuppliers?.map(s => s.name) || [],
      customers: existingCustomers?.map(c => c.name) || [],
      categories: existingCategories?.map(c => `${c.emoji || ''} ${c.name}`.trim()) || [],
      corrections: recentCorrections?.map(c => {
        if (c.field_name === 'type') {
          return `- "${c.counterpart_name || 'okänd'}": AI sa ${c.ai_value}, användaren ändrade till ${c.corrected_value}`
        }
        if (c.field_name === 'category_id') {
          return `- "${c.counterpart_name || 'okänd'}": kategori ändrad från ${c.ai_value || 'ingen'} till ${c.corrected_value}`
        }
        return null
      }).filter(Boolean) as string[] || [],
    }

    // Run AI extraction
    let aiResult = await extractFromPDF(base64, doc.file_name, context)
    aiResult = sanitizeObject(aiResult)
    aiResult = validateExtractionResult(aiResult)

    // Match or create customer/supplier
    let customerId: number | null = doc.customer_id
    let supplierId: number | null = doc.supplier_id

    if (aiResult.counterpart_name) {
      const isCustomerType = aiResult.type === 'outgoing_invoice' || aiResult.type === 'payment_received'

      if (isCustomerType) {
        const customer = await findMatchingCustomer(aiResult.counterpart_name)
        if (customer) {
          customerId = customer.id
        } else {
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              name: aiResult.counterpart_name,
              org_number: aiResult.counterpart_org_number || null,
            })
            .select('id')
            .single()
          if (newCustomer) customerId = newCustomer.id
        }
      } else if (aiResult.type !== 'credit_card_statement') {
        const supplier = await findMatchingSupplier(aiResult.counterpart_name)
        if (supplier) {
          supplierId = supplier.id
        } else {
          const { data: newSupplier } = await supabase
            .from('suppliers')
            .insert({
              name: aiResult.counterpart_name,
              org_number: aiResult.counterpart_org_number || null,
            })
            .select('id')
            .single()
          if (newSupplier) supplierId = newSupplier.id
        }
      }
    }

    // Auto-assign category from supplier if available
    let categoryId: number | null = doc.category_id
    if (supplierId && !categoryId) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('category_id')
        .eq('id', supplierId)
        .single()
      if (supplierData?.category_id) {
        categoryId = supplierData.category_id
      }
    }

    // Update document with new AI results
    const { data: updated, error: updateError } = await supabase
      .from('documents')
      .update({
        type: aiResult.type,
        invoice_number: aiResult.invoice_number,
        invoice_date: aiResult.invoice_date,
        due_date: aiResult.due_date,
        amount: aiResult.amount,
        vat: aiResult.vat,
        vat_rate: aiResult.vat_rate,
        total: aiResult.total,
        customer_id: customerId,
        supplier_id: supplierId,
        category_id: categoryId,
        ai_extracted_data: aiResult as unknown as Record<string, unknown>,
        ai_confidence: aiResult.confidence,
        ai_needs_review: aiResult.needs_review,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) return apiError(updateError.message, 500)

    return apiSuccess(updated)
  } catch (e) {
    return handleApiError(e)
  }
}
