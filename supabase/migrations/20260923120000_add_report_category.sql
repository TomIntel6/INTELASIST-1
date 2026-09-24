ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS report_category text NOT NULL DEFAULT 'Asistencia Vial';

CREATE INDEX IF NOT EXISTS idx_reports_category_month_year
  ON reports(report_category, month, year, created_at DESC);