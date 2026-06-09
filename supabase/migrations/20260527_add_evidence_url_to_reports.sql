/*
  # Add evidence_url column to reports

  ## Description
  This migration adds the `evidence_url` column to the reports table to store base64 encoded images of evidence.
  
  The column is optional (can be null) and stores the full base64 encoded image data as a text field.
*/

-- Add evidence_url column to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS evidence_url text;
