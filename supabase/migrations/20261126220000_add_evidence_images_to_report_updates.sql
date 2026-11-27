ALTER TABLE report_updates
ADD COLUMN IF NOT EXISTS evidence_images JSONB NOT NULL DEFAULT '[]'::jsonb;
