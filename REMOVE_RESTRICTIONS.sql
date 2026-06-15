-- ================================================================================
-- SCRIPT PARA QUITAR RESTRICCIONES DE PERMISOS EN SUPABASE
-- Permitir crear informes sin restricciones como antes
-- ================================================================================

-- 1. Eliminar las políticas RLS restrictivas que bloquean la creación de informes
DROP POLICY IF EXISTS "Admin users can view and manage activity logs" ON public.user_activity_log;
DROP POLICY IF EXISTS "Admin users can view and manage permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admin users can manage permission details" ON public.user_permission_details;
DROP POLICY IF EXISTS "All users can create reports" ON public.user_permissions;

-- 2. Desactivar RLS en las tablas de permisos (si existen)
-- Esto permite acceso sin restricciones
ALTER TABLE IF EXISTS public.user_activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_permission_details DISABLE ROW LEVEL SECURITY;

-- 3. Verificar que se removieron correctamente
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('user_activity_log', 'user_permissions', 'user_permission_details')
ORDER BY tablename;
