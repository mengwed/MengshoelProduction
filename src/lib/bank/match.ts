import { createClient } from '@/lib/supabase/server'
import type { ParsedTransaction } from './parse-swedbank'

interface MatchResult {
  transaction: ParsedTransaction
  matched_document_id: string | null
}

export async function matchTransactions(
  transactions: ParsedTransaction[],
  fiscalYearId: number
): Promise<MatchResult[]> {
  const supabase = await createClient()

  // Load all documents for matching
  const { data: documents } = await supabase
    .from('documents')
    .select('id, invoice_number, total, amount, invoice_date, type, suppliers(name), customers(name)')
    .eq('fiscal_year_id', fiscalYearId)

  if (!documents) {
    return transactions.map(t => ({ transaction: t, matched_document_id: null }))
  }

  return transactions.map((tx) => {
    let matchedId: string | null = null

    // 1. Exact reference match on invoice number
    if (tx.reference) {
      const refClean = tx.reference.replace(/\D/g, '')
      for (const doc of documents) {
        if (doc.invoice_number && doc.invoice_number === refClean) {
          matchedId = doc.id
          break
        }
        // Also check if reference contains the invoice number
        if (doc.invoice_number && tx.reference.includes(doc.invoice_number)) {
          matchedId = doc.id
          break
        }
      }
    }

    // 2. Amount + date proximity
    if (!matchedId) {
      const txAmount = Math.abs(tx.amount)
      const txDate = new Date(tx.booking_date)

      for (const doc of documents) {
        const docTotal = Math.abs(doc.total ?? doc.amount ?? 0)
        if (Math.abs(txAmount - docTotal) < 0.01 && doc.invoice_date) {
          const docDate = new Date(doc.invoice_date)
          const daysDiff = Math.abs((txDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24))
          if (daysDiff <= 30) {
            matchedId = doc.id
            break
          }
        }
      }
    }

    // 3. Supplier/customer name in reference
    if (!matchedId && tx.reference) {
      const refLower = tx.reference.toLowerCase()
      for (const doc of documents) {
        const name = (doc.customers as unknown as Record<string, string> | null)?.name
          || (doc.suppliers as unknown as Record<string, string> | null)?.name
        if (name && refLower.includes(name.toLowerCase().slice(0, 8))) {
          matchedId = doc.id
          break
        }
      }
    }

    return { transaction: tx, matched_document_id: matchedId }
  })
}
