-- Registro independiente de turnos de supervisores.
-- Los informes se relacionan por su fecha de creación para no alterar reports.
CREATE TABLE IF NOT EXISTS work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id text NOT NULL,
  supervisor_name text NOT NULL DEFAULT '',
  supervisor_email text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_shifts_closed_has_end CHECK (status = 'open' OR ended_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_work_shifts_status_started_at ON work_shifts(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_shifts_supervisor_started_at ON work_shifts(supervisor_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_shifts_one_open_per_supervisor
  ON work_shifts(supervisor_id) WHERE status = 'open';

ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;
