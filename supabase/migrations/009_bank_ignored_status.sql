-- Add 'ignored' to match_status constraint
ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_match_status_check;
ALTER TABLE bank_transactions ADD CONSTRAINT bank_transactions_match_status_check
  CHECK (match_status IN ('pending', 'approved', 'rejected', 'manual', 'ignored'));
