CREATE TABLE company_settings (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  organization_type TEXT NOT NULL DEFAULT 'enskild firma',
  owner_name TEXT,
  industry TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can do everything" ON company_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with current company
INSERT INTO company_settings (company_name, organization_type, owner_name)
VALUES ('Mengshoel Production', 'enskild firma', 'Anne Juul Mengshoel');
