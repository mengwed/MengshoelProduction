-- Add 'insurance' to document_type enum
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'insurance' AFTER 'receipt';
