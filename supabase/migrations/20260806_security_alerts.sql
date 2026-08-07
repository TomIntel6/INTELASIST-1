-- Migration: create security_alerts table
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  ip_address TEXT,
  user_agent TEXT,
  platform TEXT,
  device TEXT,
  distance_meters REAL,
  status TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_occurred_at ON public.security_alerts (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_email ON public.security_alerts (LOWER(user_email));
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts (status);
