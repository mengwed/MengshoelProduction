import { createServiceClient } from '@/lib/supabase/server'

export const CONFIDENCE_THRESHOLD = 0.70

interface TransactionInput {
  reference: string | null
  amount: number
  booking_date: string
}

interface DocumentMatch {
  id: string
  invoice_number: string | null
  total: number | null
  amount: number | null
  invoice_date: string | null
  type: string
  suppliers: { name: string } | null
  customers: { name: string } | null
}

export interface MatchResult {
  matched_document_id: string | null
  match_confidence: number | null
  suggested_document_id?: string
  suggested_confidence?: number
}

export function scoreMatch(tx: TransactionInput, doc: DocumentMatch): number {
  // 1. Exact reference match
  if (tx.reference && doc.invoice_number) {
    if (tx.reference.trim() === doc.invoice_number) return 0.95
    if (tx.reference.includes(doc.invoice_number)) return 0.80
  }

  const txAmount = Math.abs(tx.amount)
  const docTotal = Math.abs(doc.total ?? doc.amount ?? 0)
  const amountMatch = docTotal > 0 && Math.abs(txAmount - docTotal) < 0.01

  // 2. Amount + date proximity
  if (amountMatch && doc.invoice_date) {
    const txDate = new Date(tx.booking_date)
    const docDate = new Date(doc.invoice_date)
    const daysDiff = Math.abs((txDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff <= 7) return 0.75
    if (daysDiff <= 30) return 0.60
  }

  // 3. Supplier/customer name in reference
  if (tx.reference) {
    const refLower = tx.reference.toLowerCase()
    const name = doc.suppliers?.name || doc.customers?.name
    if (name && refLower.includes(name.toLowerCase().slice(0, 8))) {
      return amountMatch ? 0.70 : 0.40
    }
  }

  return 0
}

export async function matchTransactions(
  transactions: Array<{ booking_date: string; transaction_date: string | null; transaction_type: string | null; reference: string | null; amount: number; balance: number | null }>,
  fiscalYearId: number
): Promise<Array<{ transaction: typeof transactions[number]; matched_document_id: string | null; match_confidence: number | null }>> {
  const supabase = createServiceClient()

  const { data: documents } = await supabase
    .from('documents')
    .select('id, invoice_number, total, amount, invoice_date, type, suppliers(name), customers(name)')
    .eq('fiscal_year_id', fiscalYearId)

  if (!documents) {
    return transactions.map(t => ({ transaction: t, matched_document_id: null, match_confidence: null }))
  }

  return transactions.map((tx) => {
    let bestId: string | null = null
    let bestScore = 0

    for (const doc of documents) {
      const score = scoreMatch(
        { reference: tx.reference, amount: tx.amount, booking_date: tx.booking_date },
        doc as unknown as DocumentMatch
      )
      if (score > bestScore) {
        bestScore = score
        bestId = doc.id
      }
    }

    if (bestScore >= CONFIDENCE_THRESHOLD) {
      return { transaction: tx, matched_document_id: bestId, match_confidence: bestScore }
    }

    return { transaction: tx, matched_document_id: null, match_confidence: null }
  })
}
