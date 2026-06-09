-- Add coverage column to reports for legacy schema compatibility
ALTER TABLE IF EXISTS reports
ADD COLUMN IF NOT EXISTS coverage text NOT NULL DEFAULT '';
