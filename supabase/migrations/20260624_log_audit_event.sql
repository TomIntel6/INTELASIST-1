-- Migration: Create audit system structures for log_audit_event

-- 1. Create audit action enum type
CREATE TYPE IF NOT EXISTS public.audit_action_type AS ENUM (
  'create_report',
  'update_report',
  'delete_report',
  'change_report_status',
  'add_update',
  'delete_update',
  'upload_evidence',
  'delete_evidence',
  'create_user',
  'delete_user',
  'reset_password',
  'change_role',
  'suspend_user',
  'reactivate_user',
  'update_permissions',
  'manage_alerts',
  'restore_report',
  'permanently_delete_report',
  'empty_trash',
  'login',
  'logout'
);

-- 2. Create audit status enum type
CREATE TYPE IF NOT EXISTS public.audit_status AS ENUM ('success', 'error');

-- 3. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  action audit_action_type NOT NULL,
  module text NOT NULL,
  entity_id uuid,
  entity_type text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  status audit_status DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 4. Create RPC function log_audit_event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action audit_action_type,
  p_module text,
  p_entity_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_status audit_status DEFAULT 'success',
  p_error_message text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_audit_id uuid;
  v_user_id uuid;
  v_user_email text;
  v_user_name text;
BEGIN
  v_user_id := auth.uid();

  SELECT email, user_metadata->>'full_name'
    INTO v_user_email, v_user_name
    FROM auth.users
   WHERE id = v_user_id;

  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    user_name,
    action,
    module,
    entity_id,
    entity_type,
    old_values,
    new_values,
    status,
    error_message
  ) VALUES (
    v_user_id,
    v_user_email,
    v_user_name,
    p_action,
    p_module,
    p_entity_id,
    p_entity_type,
    p_old_values,
    p_new_values,
    p_status,
    p_error_message
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
