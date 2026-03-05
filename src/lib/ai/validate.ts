import type { AIExtractionResult } from '@/types'

const MAX_AMOUNT_SEK = 100_000_000

export function validateExtractionResult(result: AIExtractionResult): AIExtractionResult {
  const issues: string[] = [...result.review_reasons]

  // Check for unreasonably high amounts
  const amounts = [result.amount, result.vat, result.total].filter((a): a is number => a !== null)
  if (amounts.some(a => Math.abs(a) > MAX_AMOUNT_SEK)) {
    issues.push('Unusually high amount')
  }

  // Check for negative amounts on invoices
  if (result.amount !== null && result.amount < 0 &&
      (result.type === 'incoming_invoice' || result.type === 'outgoing_invoice')) {
    issues.push('Negative amount on invoice')
  }

  // Check total = amount + vat
  if (result.amount !== null && result.vat !== null && result.total !== null) {
    const expectedTotal = result.amount + result.vat
    if (Math.abs(result.total - expectedTotal) > 1) {
      issues.push('Total does not match amount + VAT')
    }
  }

  return {
    ...result,
    needs_review: result.needs_review || issues.length > result.review_reasons.length,
    review_reasons: issues,
  }
}
