ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS ambulance_type text,
  ADD COLUMN IF NOT EXISTS paramedic_name text;
