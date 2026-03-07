export type DocumentType =
  | 'outgoing_invoice'
  | 'incoming_invoice'
  | 'payment_received'
  | 'credit_card_statement'
  | 'government_fee'
  | 'loan_statement'
  | 'receipt'
  | 'other'

export type DocumentStatus = 'imported' | 'reviewed' | 'paid'

export interface FiscalYear {
  id: number
  year: number
  is_active: boolean
  created_at: string
}

export interface Category {
  id: number
  name: string
  description: string | null
  emoji: string | null
  created_at: string
}

export interface Customer {
  id: number
  name: string
  org_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  email: string | null
  phone: string | null
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  org_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  email: string | null
  phone: string | null
  category_id: number | null
  is_active: boolean
  category_name?: string
  category_emoji?: string
  created_at: string
}

export interface Document {
  id: string
  type: DocumentType
  fiscal_year_id: number
  customer_id: number | null
  supplier_id: number | null
  linked_document_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  amount: number | null
  vat: number | null
  vat_rate: number | null
  total: number | null
  payment_date: string | null
  category_id: number | null
  file_path: string
  file_name: string
  ai_extracted_data: Record<string, unknown> | null
  ai_confidence: number | null
  ai_needs_review: boolean
  vat_paid: boolean
  status: DocumentStatus
  created_at: string
  // Joined fields
  customer_name?: string
  supplier_name?: string
  category_name?: string
  category_emoji?: string
}

export interface DocumentLine {
  id: string
  document_id: string
  date: string | null
  description: string | null
  amount: number | null
  category_id: number | null
  created_at: string
}

export interface BankTransaction {
  id: string
  fiscal_year_id: number
  booking_date: string
  transaction_date: string | null
  transaction_type: string | null
  reference: string | null
  amount: number
  balance: number | null
  matched_document_id: string | null
  match_confidence: number | null
  ai_suggestion_id: string | null
  ai_confidence: number | null
  ai_explanation: string | null
  match_status: 'pending' | 'approved' | 'rejected' | 'manual' | null
  import_batch_id: string
  created_at: string
  // Joined fields
  documents?: {
    file_name: string
    type: string
    invoice_number: string | null
    total: number | null
  } | null
  ai_suggestion?: {
    file_name: string
    type: string
    invoice_number: string | null
    total: number | null
  } | null
}

export interface DashboardStats {
  income: number
  income_vat: number
  expenses: number
  expenses_vat: number
  result: number
  vat_to_pay: number
  document_count: number
  needs_review_count: number
}

export interface CustomerInput {
  name: string
  org_number?: string
  address?: string
  postal_code?: string
  city?: string
  email?: string
  phone?: string
}

export interface SupplierInput {
  name: string
  org_number?: string
  address?: string
  postal_code?: string
  city?: string
  email?: string
  phone?: string
  category_id?: number | null
}

export interface CategoryInput {
  name: string
  description?: string
  emoji?: string
}

export interface CompanySettings {
  id: number
  company_name: string
  organization_type: string
  owner_name: string | null
  industry: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CompanySettingsInput {
  company_name: string
  organization_type: string
  owner_name?: string | null
  industry?: string | null
  notes?: string | null
}

export interface AILog {
  id: number
  document_id: string | null
  model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  duration_ms: number | null
  raw_response: Record<string, unknown> | null
  error: string | null
  created_at: string
}

export interface AIExtractionResult {
  type: DocumentType
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  amount: number | null
  vat: number | null
  vat_rate: number | null
  total: number | null
  counterpart_name: string | null
  counterpart_org_number: string | null
  confidence: number
  needs_review: boolean
  review_reasons: string[]
  lines: Array<{
    date: string | null
    description: string | null
    amount: number | null
  }> | null
}
