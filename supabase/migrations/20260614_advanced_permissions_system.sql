/*
  # Advanced Permissions and Audit System

  ## Overview
  This migration creates the infrastructure for granular permission-based access control
  independent of the existing role-based system, along with complete audit logging and 
  soft delete functionality for reports.

  ## New Tables
  1. user_permissions - Master permission record per user
  2. user_permission_details - Individual permission flags
  3. audit_logs - Complete system activity trail
  4. deleted_reports - Soft-deleted reports (trash bin)
  5. user_activity_log - User metrics and suspension status

  ## Backward Compatibility
  - No existing tables are modified
  - New tables are independent
  - Existing RLS policies remain unchanged
  - Can be rolled back completely
*/

-- Create enum types for audit system
CREATE TYPE audit_action_type AS ENUM (
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

CREATE TYPE audit_status AS ENUM ('success', 'error');

-- 1. Create user_permissions table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Create user_permission_details table  
CREATE TABLE IF NOT EXISTS public.user_permission_details (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_id uuid NOT NULL REFERENCES public.user_permissions(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(permission_id, permission_key)
);

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

-- 4. Create deleted_reports table (trash bin)
CREATE TABLE IF NOT EXISTS public.deleted_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  original_data jsonb NOT NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_name text,
  deleted_by_email text,
  deleted_at timestamptz DEFAULT now(),
  restored_at timestamptz,
  permanently_deleted_at timestamptz,
  permanently_deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text
);

-- 5. Create user_activity_log table
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reports_created integer DEFAULT 0,
  last_login timestamptz,
  last_activity timestamptz,
  is_suspended boolean DEFAULT false,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_details_permission_id ON public.user_permission_details(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_details_permission_key ON public.user_permission_details(permission_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_reports_report_id ON public.deleted_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_deleted_reports_deleted_by ON public.deleted_reports(deleted_by);
CREATE INDEX IF NOT EXISTS idx_deleted_reports_deleted_at ON public.deleted_reports(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);

-- Add comments for documentation
COMMENT ON TABLE public.user_permissions IS 'Stores the main permission record for each user';
COMMENT ON TABLE public.user_permission_details IS 'Individual permission flags for each user per permission_key';
COMMENT ON TABLE public.audit_logs IS 'Complete system audit trail for compliance and security';
COMMENT ON TABLE public.deleted_reports IS 'Soft-deleted reports available in trash bin';
COMMENT ON TABLE public.user_activity_log IS 'User activity metrics and suspension status';

-- Enable Row Level Security on all new tables
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_permissions - Support users can manage all
CREATE POLICY "Support users can view and manage all permissions" 
  ON public.user_permissions
  FOR ALL USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.user_metadata->>'role' IN ('Support', 'Admin')
    )
  );

-- RLS Policies for user_permission_details
CREATE POLICY "Support can manage permission details" 
  ON public.user_permission_details
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      INNER JOIN auth.users ON auth.users.id = auth.uid()
      WHERE public.user_permissions.id = permission_id
      AND auth.users.user_metadata->>'role' IN ('Support', 'Admin')
    )
  );

-- RLS Policies for audit_logs - Readable by authenticated, writable by system
CREATE POLICY "Authenticated users can view audit logs" 
  ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid())
  );

CREATE POLICY "System can insert audit logs" 
  ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for deleted_reports - Support only
CREATE POLICY "Support can manage deleted reports" 
  ON public.deleted_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.user_metadata->>'role' IN ('Support', 'Admin')
    )
  );

-- RLS Policies for user_activity_log - Support only
CREATE POLICY "Support can manage activity logs" 
  ON public.user_activity_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.user_metadata->>'role' IN ('Support', 'Admin')
    )
  );

-- Function to initialize user permissions when a new user is created
CREATE OR REPLACE FUNCTION public.initialize_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_permissions (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_activity_log (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (to avoid duplicate error)
DROP TRIGGER IF EXISTS trigger_initialize_user_permissions ON auth.users;

-- Trigger to initialize user permissions on user creation
CREATE TRIGGER trigger_initialize_user_permissions
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_permissions();

-- Function to log audit events
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
  
  SELECT email, user_metadata->>'full_name' INTO v_user_email, v_user_name
  FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.audit_logs (
    user_id, user_email, user_name, action, module,
    entity_id, entity_type, old_values, new_values,
    status, error_message
  ) VALUES (
    v_user_id, v_user_email, v_user_name, p_action, p_module,
    p_entity_id, p_entity_type, p_old_values, p_new_values,
    p_status, p_error_message
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
