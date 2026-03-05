-- Fiscal years
CREATE TABLE fiscal_years (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suppliers
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  email TEXT,
  phone TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document type enum
CREATE TYPE document_type AS ENUM (
  'outgoing_invoice',
  'incoming_invoice',
  'payment_received',
  'credit_card_statement',
  'government_fee',
  'loan_statement',
  'receipt',
  'other'
);

-- Document status enum
CREATE TYPE document_status AS ENUM (
  'imported',
  'reviewed',
  'paid'
);

-- Documents (main table for all document types)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type document_type NOT NULL,
  fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  linked_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  amount DECIMAL(12,2),
  vat DECIMAL(12,2),
  vat_rate DECIMAL(5,2),
  total DECIMAL(12,2),
  payment_date DATE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  ai_extracted_data JSONB,
  ai_confidence INTEGER CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  ai_needs_review BOOLEAN DEFAULT false,
  status document_status DEFAULT 'imported',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Document lines (for credit card statements etc.)
CREATE TABLE document_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  date DATE,
  description TEXT,
  amount DECIMAL(12,2),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bank transactions (for reconciliation)
CREATE TABLE bank_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
  booking_date DATE NOT NULL,
  transaction_date DATE,
  transaction_type TEXT,
  reference TEXT,
  amount DECIMAL(12,2) NOT NULL,
  balance DECIMAL(12,2),
  matched_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  import_batch_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_fiscal_year ON documents(fiscal_year_id);
CREATE INDEX idx_documents_customer ON documents(customer_id);
CREATE INDEX idx_documents_supplier ON documents(supplier_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_document_lines_document ON document_lines(document_id);
CREATE INDEX idx_bank_transactions_fiscal_year ON bank_transactions(fiscal_year_id);
CREATE INDEX idx_bank_transactions_matched ON bank_transactions(matched_document_id);
CREATE INDEX idx_bank_transactions_batch ON bank_transactions(import_batch_id);

-- Row Level Security
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow all authenticated users (2 users share data)
CREATE POLICY "Authenticated users can do everything" ON fiscal_years
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON document_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can do everything" ON bank_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: fiscal year 2025
INSERT INTO fiscal_years (year, is_active) VALUES (2025, true);

-- Storage bucket for PDFs
-- Run in Supabase dashboard: create bucket 'documents' with public = false
-- Storage RLS: allow authenticated users to upload/read
