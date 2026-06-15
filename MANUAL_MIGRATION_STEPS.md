# 📋 INSTRUCCIONES PARA EJECUTAR MIGRACIONES SUPABASE

## Acceso a Supabase SQL Editor

**URL:** https://app.supabase.com/project/ceowmvfxjgrgwrespcrb/sql/new

---

## PASO 1: Ejecutar Primera Migración

**Nombre:** `20260614_advanced_permissions_system.sql`

**Contenido a ejecutar:**

```sql
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
```

**Instrucciones:**
1. Ir a: https://app.supabase.com/project/ceowmvfxjgrgwrespcrb/sql/new
2. Copiar el SQL completo anterior
3. Pegar en el editor SQL
4. Click en botón **"Run"** (o Ctrl+Enter)
5. Esperar a que diga ✅ **Success**

**Si falla con error "type already exists":**
- Significa que las migraciones ya se ejecutaron antes
- Salta directamente al PASO 2

---

## PASO 2: Ejecutar Segunda Migración

**Nombre:** `20260614_FIX_admin_tables_usuarios_reference.sql`

**Contenido a ejecutar:**

```sql
-- Drop existing tables if they were created with wrong references
DROP TABLE IF EXISTS public.user_permission_details CASCADE;
DROP TABLE IF EXISTS public.user_permissions CASCADE;
DROP TABLE IF EXISTS public.user_activity_log CASCADE;

-- ============================================================
-- 1. Create user_activity_log table (references usuarios)
-- ============================================================
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

-- ============================================================
-- 2. Create user_permissions table (references usuarios)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  modules_access jsonb DEFAULT '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================
-- 3. Create user_permission_details table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_permission_details (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_id uuid NOT NULL REFERENCES public.user_permissions(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(permission_id, permission_key)
);

-- ============================================================
-- 4. Create indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_is_suspended ON public.user_activity_log(is_suspended);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_suspended_at ON public.user_activity_log(suspended_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_permission_details_permission_id ON public.user_permission_details(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_details_permission_key ON public.user_permission_details(permission_key);

-- ============================================================
-- 5. Enable Row Level Security
-- ============================================================
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_details ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. Add Comments for Documentation
-- ============================================================
COMMENT ON TABLE public.user_activity_log IS 'Stores user activity metrics and suspension status, linked to usuarios table';
COMMENT ON TABLE public.user_permissions IS 'Master permission record per user, linked to usuarios table';
COMMENT ON TABLE public.user_permission_details IS 'Individual permission flags for each user';

COMMENT ON COLUMN public.user_activity_log.user_id IS 'Foreign key to usuarios.id';
COMMENT ON COLUMN public.user_activity_log.is_suspended IS 'Whether the user is currently suspended';
COMMENT ON COLUMN public.user_permissions.user_id IS 'Foreign key to usuarios.id';
COMMENT ON COLUMN public.user_permissions.modules_access IS 'JSON object storing module access flags';

-- ============================================================
-- 7. RLS Policies
-- ============================================================

-- Policy for user_activity_log - Admins and Support can manage
CREATE POLICY "Admin users can view and manage activity logs" 
  ON public.user_activity_log
  FOR ALL USING (
    -- Check if current user is Admin or Support based on usuarios.rol
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol IN ('Admin', 'Support')
    )
  );

-- Policy for user_permissions - Admins and Support can manage
CREATE POLICY "Admin users can view and manage permissions" 
  ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = auth.uid()
      AND rol IN ('Admin', 'Support')
    )
  );

-- Policy for user_permission_details - Admins and Support can manage
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

-- ============================================================
-- 8. Initialize data for existing users
-- ============================================================
-- For each existing user in usuarios, create activity log entry if not exists
INSERT INTO public.user_activity_log (user_id, reports_created, is_suspended)
SELECT u.id, 0, false
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_activity_log ual WHERE ual.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- For each existing user, create permissions entry if not exists
INSERT INTO public.user_permissions (user_id, modules_access)
SELECT u.id, '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}'::jsonb
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up WHERE up.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;
```

**Instrucciones:**
1. Ir a: https://app.supabase.com/project/ceowmvfxjgrgwrespcrb/sql/new
2. Copiar el SQL completo anterior
3. Pegar en el editor SQL
4. Click en botón **"Run"**
5. Esperar a que diga ✅ **Success**

---

## PASO 3: Verificación de Tablas

**Query:**

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_permissions','user_permission_details','user_activity_log','audit_logs','deleted_reports') 
ORDER BY table_name;
```

**Resultado esperado:** 5 filas con los nombres:
- audit_logs
- deleted_reports
- user_activity_log
- user_permission_details
- user_permissions

---

## PASO 4: Verificación de Columna modules_access

**Query:**

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_schema='public' 
AND table_name='user_permissions' 
AND column_name='modules_access';
```

**Resultado esperado:** 1 fila con `modules_access`

---

## ⏱️ Tiempo total: ~10 minutos

**Después de ejecutar:**
1. Captura pantalla de PASO 3 (verificación de tablas)
2. Captura pantalla de PASO 4 (verificación de módulos_access)
3. Comparte los resultados exactos

---

¿Lista para ejecutar manualmente?
