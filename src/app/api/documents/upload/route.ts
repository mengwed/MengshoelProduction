import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractFromPDF } from '@/lib/ai/extract'
import { findMatchingCustomer, findMatchingSupplier, findMatchingInvoice } from '@/lib/matching'

export async function POST(request: Request) {
  const supabase = await createClient()

  const formData = await request.formData()
  const file = formData.get('file') as File
  const typeHint = formData.get('typeHint') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Get active fiscal year
  const { data: fiscalYear } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!fiscalYear) {
    return NextResponse.json({ error: 'No active fiscal year' }, { status: 400 })
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('documents')
    .select('id, file_name')
    .eq('file_name', file.name)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({
      error: 'duplicate',
      existing: existing[0],
      message: `En fil med namnet "${file.name}" finns redan`,
    }, { status: 409 })
  }

  // Upload to Supabase Storage
  const fileBuffer = await file.arrayBuffer()
  const filePath = `${fiscalYear.year}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, fileBuffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // AI extraction
  const base64 = Buffer.from(fileBuffer).toString('base64')
  const aiResult = await extractFromPDF(base64, file.name)

  // Override type if user uploaded from a specific page
  if (typeHint === 'outgoing' && aiResult.confidence < 90) {
    aiResult.type = 'outgoing_invoice'
  } else if (typeHint === 'incoming' && aiResult.confidence < 90) {
    aiResult.type = 'incoming_invoice'
  }

  // Match customer/supplier
  let customerId: number | null = null
  let supplierId: number | null = null
  let linkedDocumentId: string | null = null

  if (aiResult.counterpart_name) {
    if (aiResult.type === 'outgoing_invoice') {
      const customer = await findMatchingCustomer(aiResult.counterpart_name)
      customerId = customer?.id ?? null
    } else if (aiResult.type === 'payment_received') {
      const customer = await findMatchingCustomer(aiResult.counterpart_name)
      customerId = customer?.id ?? null
      // Try to match payment to invoice
      if (aiResult.invoice_number) {
        const invoice = await findMatchingInvoice(aiResult.invoice_number)
        linkedDocumentId = invoice?.id ?? null
      }
    } else {
      const supplier = await findMatchingSupplier(aiResult.counterpart_name)
      supplierId = supplier?.id ?? null
    }
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
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Insert document lines for credit card statements
  if (aiResult.type === 'credit_card_statement' && aiResult.lines) {
    const lines = aiResult.lines.map((line) => ({
      document_id: doc.id,
      date: line.date,
      description: line.description,
      amount: line.amount,
    }))
    await supabase.from('document_lines').insert(lines)
  }

  return NextResponse.json(doc)
}
