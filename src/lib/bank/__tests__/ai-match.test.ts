import { describe, it, expect } from 'vitest'
import { buildMatchPrompt, parseMatchResponse } from '../ai-match'

const sampleTransactions = [
  { index: 0, booking_date: '2025-12-30', transaction_type: 'Bankgiro inbetalning', reference: '57744724', amount: 62500 },
  { index: 1, booking_date: '2025-12-19', transaction_type: 'Bankgiro', reference: 'BET 44556', amount: -3500 },
]

const sampleDocuments = [
  {
    id: 'doc-1',
    type: 'outgoing_invoice',
    invoice_number: 'F2025-042',
    invoice_date: '2025-12-28',
    amount: 50000,
    vat: 12500,
    total: 62500,
    supplier_name: null,
    customer_name: 'Acme AB',
  },
  {
    id: 'doc-2',
    type: 'incoming_invoice',
    invoice_number: '44556',
    invoice_date: '2025-12-15',
    amount: 2800,
    vat: 700,
    total: 3500,
    supplier_name: 'Telia',
    customer_name: null,
  },
]

describe('buildMatchPrompt', () => {
  it('returns a string containing transaction and document data', () => {
    const prompt = buildMatchPrompt(sampleTransactions, sampleDocuments)

    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('62500')
    expect(prompt).toContain('57744724')
    expect(prompt).toContain('doc-1')
    expect(prompt).toContain('Acme AB')
    expect(prompt).toContain('JSON')
  })

  it('includes all transactions and documents', () => {
    const prompt = buildMatchPrompt(sampleTransactions, sampleDocuments)

    expect(prompt).toContain('BET 44556')
    expect(prompt).toContain('Telia')
    expect(prompt).toContain('doc-2')
  })
})

describe('parseMatchResponse', () => {
  it('parses a valid JSON response into suggestions', () => {
    const responseText = JSON.stringify([
      { transactionIndex: 0, documentId: 'doc-1', confidence: 0.95, explanation: 'Belopp matchar exakt' },
      { transactionIndex: 1, documentId: 'doc-2', confidence: 0.85, explanation: 'Fakturanummer i referens' },
    ])

    const suggestions = parseMatchResponse(responseText, sampleTransactions)

    expect(suggestions).toHaveLength(2)
    expect(suggestions[0]).toEqual({
      transactionIndex: 0,
      documentId: 'doc-1',
      confidence: 0.95,
      explanation: 'Belopp matchar exakt',
    })
    expect(suggestions[1].documentId).toBe('doc-2')
  })

  it('handles "no match" entries', () => {
    const responseText = JSON.stringify([
      { transactionIndex: 0, documentId: null, confidence: 0, explanation: 'Inget matchande dokument hittades' },
    ])

    const suggestions = parseMatchResponse(responseText, sampleTransactions)

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].documentId).toBeNull()
    expect(suggestions[0].confidence).toBe(0)
    expect(suggestions[0].explanation).toContain('Inget matchande')
  })

  it('handles response wrapped in markdown code block', () => {
    const responseText = '```json\n' + JSON.stringify([
      { transactionIndex: 0, documentId: 'doc-1', confidence: 0.9, explanation: 'Match' },
    ]) + '\n```'

    const suggestions = parseMatchResponse(responseText, sampleTransactions)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].documentId).toBe('doc-1')
  })

  it('returns empty array for invalid JSON', () => {
    const suggestions = parseMatchResponse('not valid json', sampleTransactions)
    expect(suggestions).toEqual([])
  })
})
