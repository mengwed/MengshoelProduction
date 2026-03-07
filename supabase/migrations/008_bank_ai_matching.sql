-- Add AI matching columns to bank_transactions
ALTER TABLE bank_transactions
  ADD COLUMN ai_suggestion_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN ai_confidence DECIMAL(3,2),
  ADD COLUMN ai_explanation TEXT,
  ADD COLUMN match_status TEXT CHECK (match_status IN ('pending', 'approved', 'rejected', 'manual'));

-- Index for filtering by match status
CREATE INDEX idx_bank_transactions_match_status ON bank_transactions(match_status);
