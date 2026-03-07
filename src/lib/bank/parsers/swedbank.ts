import * as XLSX from 'xlsx'
import type { BankParser, ParsedTransaction } from './types'

function parseDate(value: unknown): string | null {
  if (!value) return null
  const str = String(value).trim()

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }
  }

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return str

  const euMatch = str.match(/^(\d{2})[./](\d{2})[./](\d{4})$/)
  if (euMatch) return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`

  return null
}

function parseAmount(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value

  const str = String(value).trim()
    .replace(/\s/g, '')
    .replace(/,/g, '.')

  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

export const swedbankParser: BankParser = {
  name: 'Swedbank',

  detect(workbook) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) return false
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    return rows.some(row =>
      row?.some(cell =>
        typeof cell === 'string' &&
        (cell.includes('Bokforingsdatum') || cell.includes('Bokföringsdatum') || cell.includes('Bokforingsdag') || cell.includes('Clnr') || cell.includes('Radnummer'))
      )
    )
  },

  parse(workbook) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

    let headerIndex = -1
    let hasRadnummer = false
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row?.some((cell: string) =>
        typeof cell === 'string' &&
        (cell.includes('Bokforingsdatum') || cell.includes('Bokföringsdatum') || cell.includes('Bokforingsdag') || cell.includes('Clnr') || cell.includes('Radnummer'))
      )) {
        headerIndex = i
        hasRadnummer = row.some((cell: string) => typeof cell === 'string' && cell.includes('Radnummer'))
        break
      }
    }

    const transactions: ParsedTransaction[] = []
    const startRow = headerIndex + 1

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length < 5) continue

      const firstCell = String(row[0] ?? '')
      const hasClnr = /^\d+$/.test(firstCell.trim())

      let bookingDate: string | null
      let transactionDate: string | null
      let transactionType: string | null
      let reference: string | null
      let amount: number | null
      let balance: number | null

      if (hasRadnummer) {
        // 8-column format: Radnummer | Bokföringsdatum | Transaktionsdatum | Valutadatum | Transaktionstyp | Referens | Belopp | Bokfört saldo
        bookingDate = parseDate(row[1])
        transactionDate = parseDate(row[2])
        // row[3] = Valutadatum (skip)
        transactionType = row[4] ? String(row[4]) : null
        reference = row[5] ? String(row[5]) : null
        amount = parseAmount(row[6])
        balance = parseAmount(row[7])
      } else if (hasClnr) {
        bookingDate = parseDate(row[1])
        transactionDate = parseDate(row[2])
        transactionType = row[3] ? String(row[3]) : null
        reference = row[4] ? String(row[4]) : null
        amount = parseAmount(row[5])
        balance = parseAmount(row[6])
      } else {
        bookingDate = parseDate(row[0])
        transactionDate = parseDate(row[1])
        transactionType = row[2] ? String(row[2]) : null
        reference = row[3] ? String(row[3]) : null
        amount = parseAmount(row[4])
        balance = parseAmount(row[5])
      }

      if (bookingDate && amount !== null) {
        transactions.push({
          booking_date: bookingDate,
          transaction_date: transactionDate,
          transaction_type: transactionType,
          reference,
          amount,
          balance,
        })
      }
    }

    return transactions
  },
}
