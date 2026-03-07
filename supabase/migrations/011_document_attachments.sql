-- Document attachments (Word, PDF, Excel files attached to documents)
CREATE TABLE document_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_document_attachments_document ON document_attachments(document_id);

-- RLS
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything" ON document_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
