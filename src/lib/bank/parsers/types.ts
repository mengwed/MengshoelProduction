import type * as XLSX from 'xlsx'

export interface ParsedTransaction {
  booking_date: string
  transaction_date: string | null
  transaction_type: string | null
  reference: string | null
  amount: number
  balance: number | null
}

export interface BankParser {
  name: string
  detect(workbook: XLSX.WorkBook): boolean
  parse(workbook: XLSX.WorkBook): ParsedTransaction[]
}
