CREATE TABLE ai_logs (
  id SERIAL PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  duration_ms INTEGER,
  raw_response JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything" ON ai_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_ai_logs_document ON ai_logs(document_id);
CREATE INDEX idx_ai_logs_created ON ai_logs(created_at DESC);
