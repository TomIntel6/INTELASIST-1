-- Script para fijar el permiso create_reports para todos los usuarios
-- Ejecutar directamente en el SQL Editor de Supabase

-- 1. Asegurar que todos los usuarios tengan registros en user_permissions con create_reports habilitado
INSERT INTO public.user_permissions (user_id, modules_access)
SELECT u.id, jsonb_set(
  '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false,"create_reports":true}'::jsonb,
  '{create_reports}',
  'true'::jsonb
)
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

-- 2. Asegurar que todos los usuarios tengan registros en user_activity_log
INSERT INTO public.user_activity_log (user_id, reports_created, is_suspended)
SELECT u.id, 0, false
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_activity_log ual WHERE ual.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Asegurar que todos los usuarios tengan el permiso create_reports en user_permission_details
WITH user_perms AS (
  SELECT 
    up.id as permission_id,
    u.id as user_id,
    COALESCE(u.rol, 'Agente') as user_role
  FROM public.user_permissions up
  INNER JOIN public.usuarios u ON u.id = up.user_id
)
INSERT INTO public.user_permission_details (permission_id, permission_key, granted, created_at, updated_at)
SELECT 
  permission_id,
  'create_reports',
  true,
  now(),
  now()
FROM user_perms
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permission_details upd 
  WHERE upd.permission_id = user_perms.permission_id 
  AND upd.permission_key = 'create_reports'
)
ON CONFLICT (permission_id, permission_key) DO UPDATE SET 
  granted = true,
  updated_at = now();

-- 4. Asegurar que todos los permisos estén inicializados correctamente según el rol
WITH all_perms AS (
  SELECT
    up.id as permission_id,
    u.id as user_id,
    COALESCE(u.rol, 'Agente') as user_role,
    perm.permission_key,
    CASE 
      WHEN perm.permission_key IN ('create_reports', 'view_reports', 'upload_evidence', 'download_evidence', 'add_updates') THEN true
      WHEN u.rol = 'Admin' THEN true
      WHEN u.rol = 'Support' THEN true
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

-- 5. Verificar que los cambios se aplicaron correctamente
SELECT 
  u.email,
  u.rol,
  COUNT(CASE WHEN upd.granted THEN 1 END) as total_permisos_habilitados,
  CASE WHEN upd.permission_key = 'create_reports' AND upd.granted THEN '✅ create_reports: HABILITADO' ELSE NULL END as create_reports_status
FROM public.usuarios u
LEFT JOIN public.user_permissions up ON u.id = up.user_id
LEFT JOIN public.user_permission_details upd ON up.id = upd.permission_id AND upd.permission_key IN ('create_reports')
GROUP BY u.id, u.email, u.rol, upd.permission_key, upd.granted
ORDER BY u.email;
