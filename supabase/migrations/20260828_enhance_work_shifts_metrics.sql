-- Campos operativos adicionales para métricas y cierre de turnos.
-- La migración es aditiva: no elimina ni modifica columnas existentes.
ALTER TABLE work_shifts
  ADD COLUMN IF NOT EXISTS started_reports_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_reports_count integer,
  ADD COLUMN IF NOT EXISTS closing_observation text,
  ADD COLUMN IF NOT EXISTS closed_by text,
  ADD COLUMN IF NOT EXISTS closed_by_name text;

ALTER TABLE work_shifts
  ADD CONSTRAINT work_shifts_started_reports_count_nonnegative
  CHECK (started_reports_count >= 0);

ALTER TABLE work_shifts
  ADD CONSTRAINT work_shifts_closed_reports_count_nonnegative
  CHECK (closed_reports_count IS NULL OR closed_reports_count >= 0);
