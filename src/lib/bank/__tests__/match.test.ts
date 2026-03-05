import { describe, it, expect } from 'vitest'
import { scoreMatch, CONFIDENCE_THRESHOLD } from '../match'

describe('scoreMatch', () => {
  const baseDoc = {
    id: '1',
    invoice_number: '12345',
    total: 1500,
    amount: 1200,
    invoice_date: '2025-06-15',
    type: 'incoming_invoice',
    suppliers: { name: 'Fortnox AB' },
    customers: null,
  }

  it('should return 0.95 for exact reference match', () => {
    const score = scoreMatch(
      { reference: '12345', amount: -1500, booking_date: '2025-06-20' },
      baseDoc
    )
    expect(score).toBe(0.95)
  })

  it('should return 0.80 for reference containing invoice number', () => {
    const score = scoreMatch(
      { reference: 'BET 12345 REF', amount: -1500, booking_date: '2025-06-20' },
      baseDoc
    )
    expect(score).toBe(0.80)
  })

  it('should return 0.75 for amount + date within 7 days', () => {
    const score = scoreMatch(
      { reference: null, amount: -1500, booking_date: '2025-06-18' },
      baseDoc
    )
    expect(score).toBe(0.75)
  })

  it('should return 0.60 for amount + date within 30 days', () => {
    const score = scoreMatch(
      { reference: null, amount: -1500, booking_date: '2025-07-10' },
      baseDoc
    )
    expect(score).toBe(0.60)
  })

  it('should return 0.70 for supplier name in reference + amount match', () => {
    const score = scoreMatch(
      { reference: 'Fortnox faktura', amount: -1500, booking_date: '2025-08-01' },
      baseDoc
    )
    expect(score).toBe(0.70)
  })

  it('should return 0.40 for supplier name in reference without amount', () => {
    const score = scoreMatch(
      { reference: 'Fortnox faktura', amount: -999, booking_date: '2025-08-01' },
      baseDoc
    )
    expect(score).toBe(0.40)
  })

  it('should return 0 for no match', () => {
    const score = scoreMatch(
      { reference: 'random', amount: -999, booking_date: '2025-12-01' },
      baseDoc
    )
    expect(score).toBe(0)
  })

  it('CONFIDENCE_THRESHOLD should be 0.70', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.70)
  })
})
