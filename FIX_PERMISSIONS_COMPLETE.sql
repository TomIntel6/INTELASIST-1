-- ================================================================================
-- SCRIPT COMPLETO: Crear tablas + Inicializar permisos para crear informes
-- Ejecutar en SQL Editor de Supabase
-- ================================================================================

-- ================================================================================
-- PARTE 1: CREAR TABLAS (si no existen)
-- ================================================================================

-- Drop existing tables if they were created with wrong references
DROP TABLE IF EXISTS public.user_permission_details CASCADE;
DROP TABLE IF EXISTS public.user_permissions CASCADE;
DROP TABLE IF EXISTS public.user_activity_log CASCADE;

-- 1. Create user_activity_log table (references usuarios)
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  reports_created integer DEFAULT 0,
  last_login timestamptz,
  last_activity timestamptz,
  is_suspended boolean DEFAULT false,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Create user_permissions table (references usuarios)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  modules_access jsonb DEFAULT '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false,"create_reports":true}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. Create user_permission_details table
CREATE TABLE IF NOT EXISTS public.user_permission_details (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_id uuid NOT NULL REFERENCES public.user_permissions(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(permission_id, permission_key)
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_is_suspended ON public.user_activity_log(is_suspended);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_suspended_at ON public.user_activity_log(suspended_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_details_permission_id ON public.user_permission_details(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_details_permission_key ON public.user_permission_details(permission_key);

-- 5. Enable RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_details ENABLE ROW LEVEL SECURITY;

-- 6. Add comments
COMMENT ON TABLE public.user_activity_log IS 'Stores user activity metrics and suspension status, linked to usuarios table';
COMMENT ON TABLE public.user_permissions IS 'Master permission record per user, linked to usuarios table';
COMMENT ON TABLE public.user_permission_details IS 'Individual permission flags for each user';
COMMENT ON COLUMN public.user_activity_log.user_id IS 'Foreign key to usuarios.id';
COMMENT ON COLUMN public.user_activity_log.is_suspended IS 'Whether the user is currently suspended';
COMMENT ON COLUMN public.user_permissions.user_id IS 'Foreign key to usuarios.id';
COMMENT ON COLUMN public.user_permissions.modules_access IS 'JSON object storing module access flags';

-- 7. RLS Policies
CREATE POLICY "Admin users can view and manage activity logs" 
  ON public.user_activity_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol IN ('Admin', 'Support')
    )
  );

CREATE POLICY "Admin users can view and manage permissions" 
  ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol IN ('Admin', 'Support')
    )
  );

CREATE POLICY "Admin users can manage permission details" 
  ON public.user_permission_details
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions p
      INNER JOIN public.usuarios u ON u.id = p.user_id
      WHERE p.id = permission_id
      AND EXISTS (
        SELECT 1 FROM public.usuarios admin
        WHERE admin.id = auth.uid()
        AND admin.rol IN ('Admin', 'Support')
      )
    )
  );

-- All authenticated users can create reports
CREATE POLICY "All users can create reports" 
  ON public.user_permissions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (modules_access->>'create_reports')::boolean = true
  );

-- ================================================================================
-- PARTE 2: INICIALIZAR DATOS PARA TODOS LOS USUARIOS
-- ================================================================================

-- Initialize user_activity_log
INSERT INTO public.user_activity_log (user_id, reports_created, is_suspended)
SELECT u.id, 0, false
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_activity_log ual WHERE ual.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Initialize user_permissions with create_reports enabled
INSERT INTO public.user_permissions (user_id, modules_access)
SELECT u.id, '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false,"create_reports":true}'::jsonb
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up WHERE up.user_id = u.id
)
ON CONFLICT (user_id) DO UPDATE SET 
  modules_access = jsonb_set(
    EXCLUDED.modules_access,
    '{create_reports}',
    'true'::jsonb
  ),
  updated_at = now();

-- Initialize all permission details for each user based on their role
WITH all_perms AS (
  SELECT
    up.id as permission_id,
    u.id as user_id,
    COALESCE(u.rol, 'Agente') as user_role,
    perm.permission_key,
    CASE 
      -- Todos los usuarios pueden crear informes
      WHEN perm.permission_key = 'create_reports' THEN true
      WHEN perm.permission_key = 'view_reports' THEN true
      WHEN perm.permission_key = 'upload_evidence' THEN true
      WHEN perm.permission_key = 'download_evidence' THEN true
      WHEN perm.permission_key = 'add_updates' THEN true
      -- Admin y Support tienen todos los permisos
      WHEN u.rol = 'Admin' THEN true
      WHEN u.rol = 'Support' THEN true
      -- Gerente tiene permisos adicionales
      WHEN u.rol = 'Gerente' AND perm.permission_key IN ('view_all_reports', 'edit_reports', 'change_report_status', 'assign_reports', 'export_reports', 'view_users', 'view_alerts', 'view_audit_logs') THEN true
      ELSE false
    END as should_grant
  FROM public.user_permissions up
  INNER JOIN public.usuarios u ON u.id = up.user_id
  CROSS JOIN (
    SELECT 'create_reports' as permission_key UNION ALL
    SELECT 'view_reports' UNION ALL
    SELECT 'view_all_reports' UNION ALL
    SELECT 'edit_reports' UNION ALL
    SELECT 'delete_reports' UNION ALL
    SELECT 'close_reports' UNION ALL
    SELECT 'reopen_reports' UNION ALL
    SELECT 'change_report_status' UNION ALL
    SELECT 'assign_reports' UNION ALL
    SELECT 'export_reports' UNION ALL
    SELECT 'upload_evidence' UNION ALL
    SELECT 'delete_evidence' UNION ALL
    SELECT 'download_evidence' UNION ALL
    SELECT 'add_updates' UNION ALL
    SELECT 'edit_updates' UNION ALL
    SELECT 'delete_updates' UNION ALL
    SELECT 'view_users' UNION ALL
    SELECT 'create_users' UNION ALL
    SELECT 'delete_users' UNION ALL
    SELECT 'reset_passwords' UNION ALL
    SELECT 'change_roles' UNION ALL
    SELECT 'view_alerts' UNION ALL
    SELECT 'manage_alerts' UNION ALL
    SELECT 'view_audit_logs' UNION ALL
    SELECT 'manage_permissions' UNION ALL
    SELECT 'suspend_users' UNION ALL
    SELECT 'restore_users' UNION ALL
    SELECT 'access_trash' UNION ALL
    SELECT 'permanently_delete_reports'
  ) as perms(permission_key)
)
INSERT INTO public.user_permission_details (permission_id, permission_key, granted, created_at, updated_at)
SELECT 
  permission_id,
  permission_key,
  should_grant,
  now(),
  now()
FROM all_perms
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permission_details upd 
  WHERE upd.permission_id = all_perms.permission_id 
  AND upd.permission_key = all_perms.permission_key
)
ON CONFLICT (permission_id, permission_key) DO UPDATE SET 
  granted = EXCLUDED.granted,
  updated_at = now();

-- ================================================================================
-- PARTE 3: VERIFICACIÓN - Ver resultados finales
-- ================================================================================

-- Mostrar estado final de todos los usuarios
SELECT 
  u.email,
  u.rol,
  up.modules_access->>'create_reports' as create_reports_json,
  COALESCE(upd.granted, false) as create_reports_detail,
  ual.is_suspended,
  CASE 
    WHEN COALESCE(upd.granted, false) = true THEN '✅ HABILITADO'
    ELSE '❌ DESHABILITADO'
  END as estado_permisos
FROM public.usuarios u
LEFT JOIN public.user_permissions up ON u.id = up.user_id
LEFT JOIN public.user_permission_details upd ON up.id = upd.permission_id AND upd.permission_key = 'create_reports'
LEFT JOIN public.user_activity_log ual ON u.id = ual.user_id
ORDER BY u.email;
