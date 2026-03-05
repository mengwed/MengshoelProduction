import { describe, it, expect } from 'vitest'
import { parseSwedbank } from './parse-swedbank'
import * as XLSX from 'xlsx'

function makeExcel(rows: (string | number | null)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return out
}

describe('parseSwedbank', () => {
  it('parses format without Clnr column', () => {
    const buffer = makeExcel([
      ['Bokföringsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfört saldo'],
      ['2025-01-15', '2025-01-14', 'Kortköp', 'ICA Maxi', -523.50, 10000],
      ['2025-01-16', '2025-01-15', 'Insättning', 'Lön', 25000, 35000],
    ])

    const result = parseSwedbank(buffer)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      booking_date: '2025-01-15',
      transaction_date: '2025-01-14',
      transaction_type: 'Kortköp',
      reference: 'ICA Maxi',
      amount: -523.50,
      balance: 10000,
    })
    expect(result[1].amount).toBe(25000)
  })

  it('parses format with Clnr column', () => {
    const buffer = makeExcel([
      ['Clnr', 'Bokforingsdag', 'Transaktionsdag', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfört saldo'],
      ['12345', '2025-02-01', '2025-01-31', 'Betalning', 'Faktura 1001', -1500, 8500],
    ])

    const result = parseSwedbank(buffer)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
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
      ['Bokföringsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfört saldo'],
      [null, '2025-01-14', 'Kortköp', 'Test', -100, 5000],
      ['2025-01-15', null, 'Kortköp', 'Test', null, 5000],
      ['2025-01-16', '2025-01-15', 'Insättning', 'OK', 500, 5500],
    ])

    const result = parseSwedbank(buffer)

    // Only the last row has both date and amount
    expect(result).toHaveLength(1)
    expect(result[0].booking_date).toBe('2025-01-16')
  })

  it('handles empty spreadsheet', () => {
    const buffer = makeExcel([
      ['Bokföringsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfört saldo'],
    ])

    const result = parseSwedbank(buffer)
    expect(result).toHaveLength(0)
  })

  it('handles amounts with comma decimal separator as strings', () => {
    const buffer = makeExcel([
      ['Bokföringsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfört saldo'],
      ['2025-01-15', '2025-01-14', 'Kortköp', 'Test', '-1 523,50', '10 000,00'],
    ])

    const result = parseSwedbank(buffer)

    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(-1523.50)
    expect(result[0].balance).toBe(10000)
  })

  it('handles EU date format (DD/MM/YYYY)', () => {
    const buffer = makeExcel([
      ['Bokföringsdatum', 'Transaktionsdatum', 'Transaktionstyp', 'Referens', 'Belopp', 'Bokfört saldo'],
      ['15/01/2025', '14/01/2025', 'Kortköp', 'Test', -100, 5000],
    ])

    const result = parseSwedbank(buffer)

    expect(result).toHaveLength(1)
    expect(result[0].booking_date).toBe('2025-01-15')
    expect(result[0].transaction_date).toBe('2025-01-14')
  })
})
