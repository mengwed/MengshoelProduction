import * as XLSX from 'xlsx'

export interface ParsedTransaction {
  booking_date: string
  transaction_date: string | null
  transaction_type: string | null
  reference: string | null
  amount: number
  balance: number | null
}

export function parseSwedbank(buffer: ArrayBuffer): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

  // Find the header row (contains "Bokföringsdatum" or "Bokforingsdag")
  let headerIndex = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row && row.some((cell: string) =>
      typeof cell === 'string' &&
      (cell.includes('Bokföringsdatum') || cell.includes('Bokforingsdag') || cell.includes('Clnr'))
    )) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    // Try treating first row as data if it looks like dates
    headerIndex = -1
  }

  const transactions: ParsedTransaction[] = []
  const startRow = headerIndex + 1

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 5) continue

    // Swedbank format: Clnr, Bokföringsdag, Transaktionsdag, Transaktionstyp, Referens, Belopp, Bokfört saldo
    // or: Bokföringsdatum, Transaktionsdatum, Transaktionstyp, Referens, Belopp, Bokfört saldo
    let bookingDate: string | null = null
    let transactionDate: string | null = null
    let transactionType: string | null = null
    let reference: string | null = null
    let amount: number | null = null
    let balance: number | null = null

    // Detect format by checking if first column is a number (Clnr) or date
    const firstCell = String(row[0] ?? '')
    const hasClnr = /^\d+$/.test(firstCell.trim())

    if (hasClnr) {
      // Format with Clnr column
      bookingDate = parseDate(row[1])
      transactionDate = parseDate(row[2])
      transactionType = row[3] ? String(row[3]) : null
      reference = row[4] ? String(row[4]) : null
      amount = parseAmount(row[5])
      balance = parseAmount(row[6])
    } else {
      // Format without Clnr
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
}

function parseDate(value: unknown): string | null {
  if (!value) return null
  const str = String(value).trim()

  // Excel serial date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return str

  // DD/MM/YYYY or DD.MM.YYYY
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
