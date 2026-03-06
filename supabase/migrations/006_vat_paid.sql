-- Add vat_paid flag to documents (tracks whether VAT has been paid for outgoing invoices)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS vat_paid boolean NOT NULL DEFAULT false;
