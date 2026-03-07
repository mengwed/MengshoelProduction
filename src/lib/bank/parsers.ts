import * as XLSX from 'xlsx'

interface BankTransactionRow {
  booking_date: string
  transaction_date: string | null
  transaction_type: string | null
  reference: string | null
  amount: number
  balance: number | null
}

interface ParseResult {
  parser: string
  transactions: BankTransactionRow[]
}

function parseNumber(val: unknown): number | null {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    // Handle Swedish number format: "1 523,50" or "-1 523,50"
    const cleaned = val.replace(/\s/g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
  return null
}

function parseDate(val: unknown): string | null {
  if (val == null) return null
  const str = String(val).trim()
  if (!str) return null

  // Already ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // EU format (DD/MM/YYYY)
  const euMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (euMatch) return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`

  // Excel serial date number
  if (/^\d+$/.test(str)) {
    const serial = parseInt(str, 10)
    if (serial > 30000 && serial < 60000) {
      const date = new Date((serial - 25569) * 86400 * 1000)
      return date.toISOString().slice(0, 10)
    }
  }

  return null
}

function findColumn(keys: string[], ...patterns: string[]): string | null {
  for (const pattern of patterns) {
    const found = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()))
    if (found) return found
  }
  return null
}

function parseSwedbankSheet(sheet: XLSX.WorkSheet): BankTransactionRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  if (rows.length === 0) return []

  // Collect all keys across all rows (since null columns may be missing from individual rows)
  const allKeys = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) allKeys.add(key)
  }
  const keys = [...allKeys]

  // Map column names
  const bookingCol = findColumn(keys, 'bokforingsda', 'bokföringsd')
  const transCol = findColumn(keys, 'transaktionsda', 'transaktionsd')
  const typeCol = findColumn(keys, 'transaktionstyp')
  const refCol = findColumn(keys, 'referens')
  const amountCol = findColumn(keys, 'belopp')
  const balanceCol = findColumn(keys, 'saldo')

  if (!bookingCol || !amountCol) return []

  const transactions: BankTransactionRow[] = []

  for (const row of rows) {
    const bookingDate = parseDate(row[bookingCol])
    const amount = parseNumber(row[amountCol!])

    if (!bookingDate || amount === null) continue

    transactions.push({
      booking_date: bookingDate,
      transaction_date: transCol ? parseDate(row[transCol]) : null,
      transaction_type: typeCol && row[typeCol] != null ? String(row[typeCol]) : null,
      reference: refCol && row[refCol] != null ? String(row[refCol]) : null,
      amount,
      balance: balanceCol ? parseNumber(row[balanceCol]) : null,
    })
  }

  return transactions
}

export function parseBank(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // First try default parsing (header on row 0)
  let transactions = parseSwedbankSheet(sheet)

  // If no results, scan for the header row (files may have metadata rows at the top)
  if (transactions.length === 0) {
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
      const row = allRows[i]
      if (!Array.isArray(row)) continue
      const cells = row.map(c => String(c ?? '').toLowerCase())
      const hasBooking = cells.some(c => c.includes('bokföringsda') || c.includes('bokforingsda'))
      const hasAmount = cells.some(c => c.includes('belopp'))
      if (hasBooking && hasAmount) {
        // Re-parse with this row as header
        const newSheet = XLSX.utils.aoa_to_sheet(allRows.slice(i) as unknown[][])
        transactions = parseSwedbankSheet(newSheet)
        break
      }
    }
  }

  return {
    parser: 'Swedbank',
    transactions,
  }
}
