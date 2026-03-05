import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const supabase = createServiceClient()
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')

    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('id, year')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiError('No active fiscal year', 400)
    }

    let query = supabase
      .from('documents')
      .select('*, customers(name), suppliers(name), categories(name)')
      .eq('fiscal_year_id', fiscalYear.id)
      .order('invoice_date', { ascending: true })

    if (type === 'outgoing') {
      query = query.eq('type', 'outgoing_invoice')
    } else if (type === 'incoming') {
      query = query.in('type', [
        'incoming_invoice', 'credit_card_statement', 'government_fee',
        'loan_statement', 'receipt', 'other'
      ])
    }

    const { data: documents, error } = await query

    if (error) {
      return apiError(error.message, 500)
    }

    const rows = (documents ?? []).map((doc: Record<string, unknown>) => ({
      Datum: doc.invoice_date || '',
      Fakturanummer: doc.invoice_number || '',
      Kund: (doc.customers as Record<string, string> | null)?.name || '',
      Leverantor: (doc.suppliers as Record<string, string> | null)?.name || '',
      Kategori: (doc.categories as Record<string, string> | null)?.name || '',
      'Belopp (exkl moms)': doc.amount ?? '',
      Moms: doc.vat ?? '',
      'Momssats (%)': doc.vat_rate ?? '',
      'Totalt (inkl moms)': doc.total ?? '',
      Forfallodag: doc.due_date || '',
      Betalningsdatum: doc.payment_date || '',
      Status: doc.status || '',
      Filnamn: doc.file_name || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    const sheetName = type === 'outgoing' ? 'Kundfakturor' : type === 'incoming' ? 'Leverantorsfakturor' : 'Dokument'
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const filename = `${sheetName}_${fiscalYear.year}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    return handleApiError(e)
  }
}
