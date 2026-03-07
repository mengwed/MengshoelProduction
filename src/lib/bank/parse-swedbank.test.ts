import { describe, it, expect } from 'vitest'
import { parseBank } from './parsers'
import * as XLSX from 'xlsx'

function makeExcel(rows: (string | number | null)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return out
}

describe('swedbankParser (via parseBank)', () => {
  it('parses format without Clnr column', () => {
    const buffer = makeExcel([
      ['Bokforingsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfort saldo'],
      ['2025-01-15', '2025-01-14', 'Kortkop', 'ICA Maxi', -523.50, 10000],
      ['2025-01-16', '2025-01-15', 'Insattning', 'Lon', 25000, 35000],
    ])

    const { parser, transactions } = parseBank(buffer)

    expect(parser).toBe('Swedbank')
    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toEqual({
      booking_date: '2025-01-15',
      transaction_date: '2025-01-14',
      transaction_type: 'Kortkop',
      reference: 'ICA Maxi',
      amount: -523.50,
      balance: 10000,
    })
    expect(transactions[1].amount).toBe(25000)
  })

  it('parses format with Clnr column', () => {
    const buffer = makeExcel([
      ['Clnr', 'Bokforingsdag', 'Transaktionsdag', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfort saldo'],
      ['12345', '2025-02-01', '2025-01-31', 'Betalning', 'Faktura 1001', -1500, 8500],
    ])

    const { transactions } = parseBank(buffer)

    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toEqual({
      booking_date: '2025-02-01',
      transaction_date: '2025-01-31',
      transaction_type: 'Betalning',
      reference: 'Faktura 1001',
      amount: -1500,
      balance: 8500,
    })
  })

  it('skips rows with missing date or amount', () => {
    const buffer = makeExcel([
      ['Bokforingsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfort saldo'],
      [null, '2025-01-14', 'Kortkop', 'Test', -100, 5000],
      ['2025-01-15', null, 'Kortkop', 'Test', null, 5000],
      ['2025-01-16', '2025-01-15', 'Insattning', 'OK', 500, 5500],
    ])

    const { transactions } = parseBank(buffer)

    // Only the last row has both date and amount
    expect(transactions).toHaveLength(1)
    expect(transactions[0].booking_date).toBe('2025-01-16')
  })

  it('handles empty spreadsheet', () => {
    const buffer = makeExcel([
      ['Bokforingsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfort saldo'],
    ])

    const { transactions } = parseBank(buffer)
    expect(transactions).toHaveLength(0)
  })

  it('handles amounts with comma decimal separator as strings', () => {
    const buffer = makeExcel([
      ['Bokforingsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfort saldo'],
      ['2025-01-15', '2025-01-14', 'Kortkop', 'Test', '-1 523,50', '10 000,00'],
    ])

    const { transactions } = parseBank(buffer)

    expect(transactions).toHaveLength(1)
    expect(transactions[0].amount).toBe(-1523.50)
    expect(transactions[0].balance).toBe(10000)
  })

  it('handles EU date format (DD/MM/YYYY)', () => {
    const buffer = makeExcel([
      ['Bokforingsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfort saldo'],
      ['15/01/2025', '14/01/2025', 'Kortkop', 'Test', -100, 5000],
    ])

    const { transactions } = parseBank(buffer)

    expect(transactions).toHaveLength(1)
    expect(transactions[0].booking_date).toBe('2025-01-15')
    expect(transactions[0].transaction_date).toBe('2025-01-14')
  })

  it('detects headers with Swedish characters (Bokföringsdatum)', () => {
    const buffer = makeExcel([
      ['Transaktioner Foretagskonto'],
      [], [], [], [], [], [],
      ['Radnummer', 'Bokföringsdatum', 'Transaktionsdatum', 'Valutadatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfört saldo'],
      ['1', '2025-12-30', '2025-12-30', '2026-01-02', 'Bankgiro inbetalning', '57744724', 62500, 89623.28],
    ])

    const { parser, transactions } = parseBank(buffer)
    expect(parser).toBe('Swedbank')
    expect(transactions).toHaveLength(1)
  })

  it('parses 8-column format with Radnummer and Valutadatum correctly', () => {
    const buffer = makeExcel([
      ['Transaktioner Foretagskonto'],
      [], [], [], [], [], [],
      ['Radnummer', 'Bokföringsdatum', 'Transaktionsdatum', 'Valutadatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfört saldo'],
      ['1', '2025-12-30', '2025-12-30', '2026-01-02', 'Bankgiro inbetalning', '57744724', 62500, 89623.28],
      ['2', '2025-12-19', '2025-12-19', '2025-12-19', 'Bankgiro', 'BET 44556', -3500, 86123.28],
    ])

    const { transactions } = parseBank(buffer)

    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toEqual({
      booking_date: '2025-12-30',
      transaction_date: '2025-12-30',
      transaction_type: 'Bankgiro inbetalning',
      reference: '57744724',
      amount: 62500,
      balance: 89623.28,
    })
    expect(transactions[1]).toEqual({
      booking_date: '2025-12-19',
      transaction_date: '2025-12-19',
      transaction_type: 'Bankgiro',
      reference: 'BET 44556',
      amount: -3500,
      balance: 86123.28,
    })
  })
})
