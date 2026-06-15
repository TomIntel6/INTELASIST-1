-- ================================================================================
-- CREAR TABLAS SIN RESTRICCIONES - Para crear informes sin validaciones
-- ================================================================================

-- 1. Create user_activity_log table (SIN RLS) - Usando INTEGER para user_id
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  reports_created integer DEFAULT 0,
  last_login timestamptz,
  last_activity timestamptz,
  is_suspended boolean DEFAULT false,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Create user_permissions table (SIN RLS) - Usando INTEGER para user_id
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  modules_access jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. Create user_permission_details table (SIN RLS) - Usando INTEGER para permission_id
CREATE TABLE IF NOT EXISTS public.user_permission_details (
  id bigserial PRIMARY KEY,
  permission_id bigint NOT NULL REFERENCES public.user_permissions(id) ON DELETE CASCADE,
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

-- 5. Asegurar que RLS está DESACTIVADO
ALTER TABLE public.user_activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_details DISABLE ROW LEVEL SECURITY;

-- 6. Add comments
COMMENT ON TABLE public.user_activity_log IS 'Stores user activity metrics and suspension status, linked to usuarios table';
COMMENT ON TABLE public.user_permissions IS 'Master permission record per user, linked to usuarios table';
COMMENT ON TABLE public.user_permission_details IS 'Individual permission flags for each user';
COMMENT ON COLUMN public.user_activity_log.user_id IS 'Foreign key to usuarios.id';
COMMENT ON COLUMN public.user_activity_log.is_suspended IS 'Whether the user is currently suspended';
COMMENT ON COLUMN public.user_permissions.user_id IS 'Foreign key to usuarios.id';
COMMENT ON COLUMN public.user_permissions.modules_access IS 'JSON object storing module access flags';

-- ================================================================================
-- INICIALIZAR DATOS PARA TODOS LOS USUARIOS
-- ================================================================================

-- Initialize user_activity_log
INSERT INTO public.user_activity_log (user_id, reports_created, is_suspended)
SELECT u.id, 0, false
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_activity_log ual WHERE ual.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Initialize user_permissions
INSERT INTO public.user_permissions (user_id, modules_access)
SELECT u.id, '{}'::jsonb
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up WHERE up.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ================================================================================
-- VERIFICACIÓN FINAL
-- ================================================================================

-- Mostrar estado de las tablas
SELECT 
  'user_activity_log' as tabla,
  (SELECT COUNT(*) FROM public.user_activity_log) as registros,
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='user_activity_log') as rls_activo
UNION ALL
SELECT 
  'user_permissions',
  (SELECT COUNT(*) FROM public.user_permissions),
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='user_permissions')
UNION ALL
SELECT 
  'user_permission_details',
  (SELECT COUNT(*) FROM public.user_permission_details),
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='user_permission_details');

-- Mostrar usuarios creados
SELECT 
  u.id,
  CASE WHEN ual.id IS NOT NULL THEN '✅' ELSE '❌' END as activity_log,
  CASE WHEN up.id IS NOT NULL THEN '✅' ELSE '❌' END as permissions
FROM public.usuarios u
LEFT JOIN public.user_activity_log ual ON u.id = ual.user_id
LEFT JOIN public.user_permissions up ON u.id = up.user_id
ORDER BY u.id;
