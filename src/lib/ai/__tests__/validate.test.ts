import { describe, it, expect } from 'vitest'
import { validateExtractionResult } from '../validate'

describe('validateExtractionResult', () => {
  const base = {
    type: 'incoming_invoice' as const,
    invoice_number: '123',
    invoice_date: '2025-01-01',
    due_date: '2025-02-01',
    amount: 1000,
    vat: 250,
    vat_rate: 25,
    total: 1250,
    counterpart_name: 'Test AB',
    counterpart_org_number: null,
    confidence: 90,
    needs_review: false,
    review_reasons: [],
    lines: null,
  }

  it('should pass valid result unchanged', () => {
    const result = validateExtractionResult(base)
    expect(result.needs_review).toBe(false)
    expect(result.review_reasons).toEqual([])
  })

  it('should flag amount over 100M SEK', () => {
    const result = validateExtractionResult({ ...base, total: 200_000_000 })
    expect(result.needs_review).toBe(true)
    expect(result.review_reasons).toContain('Unusually high amount')
  })

  it('should flag negative amount on invoice', () => {
    const result = validateExtractionResult({ ...base, amount: -500 })
    expect(result.needs_review).toBe(true)
    expect(result.review_reasons).toContain('Negative amount on invoice')
  })

  it('should flag total less than amount + vat', () => {
    const result = validateExtractionResult({ ...base, amount: 1000, vat: 250, total: 1100 })
    expect(result.needs_review).toBe(true)
    expect(result.review_reasons).toContain('Total is less than amount + VAT')
  })

  it('should not flag when vat is null', () => {
    const result = validateExtractionResult({ ...base, vat: null, vat_rate: null, total: 1000 })
    expect(result.needs_review).toBe(false)
  })
})
