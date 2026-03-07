-- Add indexes to improve search performance
CREATE INDEX IF NOT EXISTS idx_documents_invoice_number ON documents(invoice_number);
CREATE INDEX IF NOT EXISTS idx_documents_invoice_date ON documents(invoice_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_matched_doc ON bank_transactions(matched_document_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_booking_date ON bank_transactions(booking_date);
