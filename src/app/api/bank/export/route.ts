import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { apiError, handleApiError } from '@/lib/api-response'
import { createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

function statusLabel(status: string | null): string {
  switch (status) {
    case 'approved': return 'Godkänd'
    case 'rejected': return 'Avslagen'
    case 'manual': return 'Manuell'
    case 'pending': return 'Väntande'
    default: return 'Ej matchad'
  }
}

export async function GET() {
  try {
    await requireAuth()
    const supabase = createServiceClient()

    const { data: fiscalYear } = await supabase
      .from('fiscal_years')
      .select('id, year')
      .eq('is_active', true)
      .single()

    if (!fiscalYear) {
      return apiError('No active fiscal year', 400)
    }

    const { data: transactions, error } = await supabase
      .from('bank_transactions')
      .select('*, documents(file_name)')
      .eq('fiscal_year_id', fiscalYear.id)
      .order('booking_date', { ascending: true })

    if (error) {
      return apiError(error.message, 500)
    }

    const rows = (transactions ?? []).map((tx: Record<string, unknown>) => ({
      Datum: tx.booking_date || '',
      Typ: tx.transaction_type || '',
      Referens: tx.reference || '',
      Belopp: tx.amount ?? '',
      Saldo: tx.balance ?? '',
      Status: statusLabel(tx.match_status as string | null),
      'Matchat dokument': (tx.documents as Record<string, string> | null)?.file_name || 'Ej matchad',
      'AI-förklaring': tx.ai_explanation || '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bankavstämning')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `Bankavstamning_${fiscalYear.year}.xlsx`

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
