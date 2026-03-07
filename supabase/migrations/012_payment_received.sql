-- Track whether payment has been received for outgoing invoices
ALTER TABLE documents ADD COLUMN payment_received BOOLEAN DEFAULT false;
