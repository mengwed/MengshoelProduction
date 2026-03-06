import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { sanitizeObject } from '@/lib/sanitize'
import { createServiceClient } from '@/lib/supabase/server'
import { extractFromPDF } from '@/lib/ai/extract'
import { validateExtractionResult } from '@/lib/ai/validate'
import { findMatchingCustomer, findMatchingSupplier } from '@/lib/matching'

export const maxDuration = 300 // Allow up to 5 minutes for bulk reparse

export async function POST() {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    // Find documents that need reparsing: 0 confidence or missing critical data
    const { data: documents, error: queryError } = await supabase
      .from('documents')
      .select('*')
      .or('ai_confidence.eq.0,ai_confidence.is.null,invoice_date.is.null')
      .order('created_at', { ascending: false })

    if (queryError) return apiError(queryError.message, 500)
    if (!documents || documents.length === 0) {
      return apiSuccess({ reparsed: 0, total: 0, results: [] })
    }

    // Load context once for all documents
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

    const results: { id: string; file_name: string; success: boolean; error?: string }[] = []

    // Process documents sequentially to avoid rate limits
    for (const doc of documents) {
      try {
        // Download PDF
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(doc.file_path)

        if (downloadError || !fileData) {
          results.push({ id: doc.id, file_name: doc.file_name, success: false, error: 'Could not download PDF' })
          continue
        }

        const buffer = await fileData.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')

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
                .insert({ name: aiResult.counterpart_name, org_number: aiResult.counterpart_org_number || null })
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
                .insert({ name: aiResult.counterpart_name, org_number: aiResult.counterpart_org_number || null })
                .select('id')
                .single()
              if (newSupplier) supplierId = newSupplier.id
            }
          }
        }

        // Update document
        await supabase
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
            ai_extracted_data: aiResult as unknown as Record<string, unknown>,
            ai_confidence: aiResult.confidence,
            ai_needs_review: aiResult.needs_review,
          })
          .eq('id', doc.id)

        results.push({ id: doc.id, file_name: doc.file_name, success: true })

        // Small delay between calls to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ id: doc.id, file_name: doc.file_name, success: false, error: msg })
      }
    }

    const succeeded = results.filter(r => r.success).length
    return apiSuccess({ reparsed: succeeded, total: documents.length, results })
  } catch (e) {
    return handleApiError(e)
  }
}
