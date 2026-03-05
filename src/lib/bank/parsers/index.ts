import * as XLSX from 'xlsx'
import type { BankParser, ParsedTransaction } from './types'
import { swedbankParser } from './swedbank'

const parsers: BankParser[] = [
  swedbankParser,
]

export function parseBank(buffer: ArrayBuffer): { parser: string; transactions: ParsedTransaction[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })

  for (const parser of parsers) {
    if (parser.detect(workbook)) {
      return {
        parser: parser.name,
        transactions: parser.parse(workbook),
      }
    }
  }

  throw new Error('Okant bankformat. Stodda format: ' + parsers.map(p => p.name).join(', '))
}

export type { ParsedTransaction, BankParser }
