/*
  # Create Insurance Reports System

  ## Overview
  This migration creates the core data model for the insurance roadside assistance reporting system.

  ## New Tables

  ### 1. `reports`
  Main table storing each insurance service report.
  - `id` (uuid, PK)
  - `month` (text) - Month name in Spanish (Enero, Febrero, etc.)
  - `year` (integer) - Year
  - `insured_name` (text) - Nombre del Asegurado
  - `plate` (text) - Placa del vehículo
  - `policy` (text) - Número de póliza
  - `service_type` (text) - Tipo de servicio (Grua por Averia, etc.)
  - `brand` (text) - Marca del vehículo
  - `model` (text) - Modelo del vehículo
  - `color` (text) - Color del vehículo
  - `year_vehicle` (integer) - Año del vehículo
  - `status` (text) - Estado del caso
  - `observation_comment` (text) - Comentario libre de observación
  - `created_by` (uuid, FK → auth.users)
  - `created_by_name` (text) - Nombre del creador (cached)
  - `created_by_email` (text) - Email del creador (cached)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `report_updates`
  Additional updates/notes added to existing reports by any user.
  - `id` (uuid, PK)
  - `report_id` (uuid, FK → reports)
  - `status` (text) - Updated status
  - `comment` (text) - Update comment
  - `added_by` (uuid, FK → auth.users)
  - `added_by_name` (text) - Nombre del que agrega (cached)
  - `added_by_email` (text) - Email cached
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Authenticated users can read all reports
  - Authenticated users can create reports
  - Only report creator can update/delete their own reports
  - Authenticated users can add updates to any report
  - Only update creator can delete their own updates
*/

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  insured_name text NOT NULL DEFAULT '',
  plate text NOT NULL DEFAULT '',
  policy text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  year_vehicle integer,
  status text NOT NULL DEFAULT 'Seguimiento de caso',
  observation_comment text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_by_email text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Report updates table
CREATE TABLE IF NOT EXISTS report_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Seguimiento de caso',
  comment text NOT NULL DEFAULT '',
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by_name text NOT NULL DEFAULT '',
  added_by_email text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_month_year ON reports(month, year);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_updates_report_id ON report_updates(report_id);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_updates ENABLE ROW LEVEL SECURITY;

-- Reports policies
CREATE POLICY "Authenticated users can read all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Report creator can update their reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Report creator can delete their reports"
  ON reports FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Report updates policies
CREATE POLICY "Authenticated users can read all updates"
  ON report_updates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can add updates to reports"
  ON report_updates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Update creator can delete their updates"
  ON report_updates FOR DELETE
  TO authenticated
  USING (auth.uid() = added_by);
