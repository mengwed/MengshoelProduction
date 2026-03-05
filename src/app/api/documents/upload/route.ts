import { requireAuth } from '@/lib/auth'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response'
import { uploadLimiter } from '@/lib/rate-limit-instances'
import { sanitizeObject } from '@/lib/sanitize'
import { createServiceClient } from '@/lib/supabase/server'
import { extractFromPDF } from '@/lib/ai/extract'
import { findMatchingCustomer, findMatchingSupplier, findMatchingInvoice } from '@/lib/matching'

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function POST(request: Request) {
  try {
    await requireAuth()

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateCheck = uploadLimiter.check(ip)
    if (!rateCheck.allowed) {
      return apiError('Too many requests', 429)
    }

    const supabase = createServiceClient()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const typeHint = formData.get('typeHint') as string | null

    if (!file) {
      return apiError('No file provided', 400)
    }

    // Get active fiscal year
    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('*')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiError('No active fiscal year', 400)
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('documents')
      .select('id, file_name')
      .eq('file_name', file.name)
      .limit(1)

    if (existing && existing.length > 0) {
      return apiError(`En fil med namnet "${file.name}" finns redan`, 409)
    }

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const safeName = sanitizeFileName(file.name)
    const filePath = `${fiscalYear.year}/${crypto.randomUUID()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, fileBuffer, { contentType: file.type })

    if (uploadError) {
      return apiError(uploadError.message, 500)
    }

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

    // AI extraction
    let aiResult
    try {
      const base64 = Buffer.from(fileBuffer).toString('base64')
      aiResult = await extractFromPDF(base64, file.name, context)
      // Sanitize AI output to prevent XSS
      aiResult = sanitizeObject(aiResult)
    } catch (err) {
      console.error('AI extraction error:', err)
      // Clean up uploaded file
      await supabase.storage.from('documents').remove([filePath])
      return apiError('AI extraction failed. Please try again later.', 503)
    }

    // Override type if user uploaded from a specific page
    if (typeHint === 'outgoing' && aiResult.confidence < 90) {
      aiResult.type = 'outgoing_invoice'
    } else if (typeHint === 'incoming' && aiResult.confidence < 90) {
      aiResult.type = 'incoming_invoice'
    }

    // Match or create customer/supplier
    let customerId: number | null = null
    let supplierId: number | null = null
    let linkedDocumentId: string | null = null

    if (aiResult.counterpart_name) {
      const isCustomerType = aiResult.type === 'outgoing_invoice' || aiResult.type === 'payment_received'

      if (isCustomerType) {
        const customer = await findMatchingCustomer(aiResult.counterpart_name)
        if (customer) {
          customerId = customer.id
        } else {
          // Auto-create customer
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

        if (aiResult.type === 'payment_received' && aiResult.invoice_number) {
          const invoice = await findMatchingInvoice(aiResult.invoice_number)
          linkedDocumentId = invoice?.id ?? null
        }
      } else if (aiResult.type !== 'credit_card_statement') {
        const supplier = await findMatchingSupplier(aiResult.counterpart_name)
        if (supplier) {
          supplierId = supplier.id
        } else {
          // Auto-create supplier
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

    // Smart duplicate detection: same amount + same supplier/customer + close date
    if (aiResult.total && (supplierId || customerId)) {
      let dupQuery = supabase
        .from('documents')
        .select('id, file_name, invoice_date')
        .eq('fiscal_year_id', fiscalYear.id)
        .eq('total', aiResult.total)

      if (supplierId) dupQuery = dupQuery.eq('supplier_id', supplierId)
      if (customerId) dupQuery = dupQuery.eq('customer_id', customerId)

      const { data: possibleDups } = await dupQuery

      if (possibleDups && possibleDups.length > 0 && aiResult.invoice_date) {
        const uploadDate = new Date(aiResult.invoice_date).getTime()
        const closeDup = possibleDups.find(d => {
          if (!d.invoice_date) return false
          const daysDiff = Math.abs(uploadDate - new Date(d.invoice_date).getTime()) / (1000 * 60 * 60 * 24)
          return daysDiff < 3
        })

        if (closeDup) {
          return apiError(
            `Möjlig dubblett: samma belopp (${aiResult.total} kr) och leverantör, nära datum som "${closeDup.file_name}"`,
            409
          )
        }
      }
    }

    // Auto-assign category from supplier if available
    let categoryId: number | null = null
    if (supplierId) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('category_id')
        .eq('id', supplierId)
        .single()
      if (supplierData?.category_id) categoryId = supplierData.category_id
    }

    // Insert document
    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        type: aiResult.type,
        fiscal_year_id: fiscalYear.id,
        customer_id: customerId,
        supplier_id: supplierId,
        linked_document_id: linkedDocumentId,
        invoice_number: aiResult.invoice_number,
        invoice_date: aiResult.invoice_date,
        due_date: aiResult.due_date,
        amount: aiResult.amount,
        vat: aiResult.vat,
        vat_rate: aiResult.vat_rate,
        total: aiResult.total,
        category_id: categoryId,
        file_path: filePath,
        file_name: file.name,
        ai_extracted_data: aiResult,
        ai_confidence: aiResult.confidence,
        ai_needs_review: aiResult.needs_review,
        status: 'imported',
      })
      .select()
      .single()

    if (insertError) {
      return apiError(insertError.message, 500)
    }

    // Insert document lines for credit card statements
    if (aiResult.type === 'credit_card_statement' && aiResult.lines) {
      const lines = aiResult.lines.map((line: { date: string; description: string; amount: number }) => ({
        document_id: doc.id,
        date: line.date,
        description: line.description,
        amount: line.amount,
      }))
      await supabase.from('document_lines').insert(lines)
    }

    return apiSuccess(doc, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
