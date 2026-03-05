-- AI learning: store user corrections to improve future extractions
CREATE TABLE IF NOT EXISTS ai_corrections (
  id serial PRIMARY KEY,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  field_name text NOT NULL,        -- which field was corrected (type, counterpart_name, etc)
  ai_value text,                   -- what the AI suggested
  corrected_value text NOT NULL,   -- what the user changed it to
  counterpart_name text,           -- for context: which supplier/customer
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_corrections_field ON ai_corrections(field_name);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_created ON ai_corrections(created_at DESC);
