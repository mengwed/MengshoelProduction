-- Add comment field to bank transactions
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS comment text;
