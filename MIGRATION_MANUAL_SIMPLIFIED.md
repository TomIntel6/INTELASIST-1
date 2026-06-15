# 🔧 GUÍA MANUAL SIMPLIFICADA - EJECUTAR MIGRACIONES EN SUPABASE

## ✅ Prerequisitos
- Tener acceso a Supabase Dashboard
- URL del proyecto: `https://ceowmvfxjgrgwrespcrb.supabase.co`

---

## 🚀 PASO 1: Acceder a SQL Editor

1. Abre en navegador: **https://app.supabase.com**
2. Haz login (si no estás logueado)
3. Selecciona proyecto: **ceowmvfxjgrgwrespcrb**
4. En menu izquierdo: **SQL Editor**
5. Click en: **New Query** (botón verde) o **+ New**

---

## 📝 PASO 2: Ejecutar MIGRATION 1

**Nombre:** `20260614_advanced_permissions_system.sql`

### Contenido a copiar:

```sql
-- Create enum types for audit system
CREATE TYPE audit_action_type AS ENUM (
  'create_report','update_report','delete_report','change_report_status',
  'add_update','delete_update','upload_evidence','delete_evidence',
  'create_user','delete_user','reset_password','change_role',
  'suspend_user','reactivate_user','update_permissions','manage_alerts',
  'restore_report','permanently_delete_report','empty_trash','login','logout'
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
  user_email text, user_name text,
  action audit_action_type NOT NULL,
  module text NOT NULL,
  entity_id uuid, entity_type text,
  old_values jsonb, new_values jsonb,
  ip_address text, user_agent text,
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
  deleted_by_name text, deleted_by_email text,
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

-- Create indexes
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

-- Add comments
COMMENT ON TABLE public.user_permissions IS 'Stores the main permission record for each user';
COMMENT ON TABLE public.user_permission_details IS 'Individual permission flags for each user per permission_key';
COMMENT ON TABLE public.audit_logs IS 'Complete system audit trail for compliance and security';
COMMENT ON TABLE public.deleted_reports IS 'Soft-deleted reports available in trash bin';
COMMENT ON TABLE public.user_activity_log IS 'User activity metrics and suspension status';

-- Enable Row Level Security
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

CREATE POLICY "Authenticated users can view audit logs" 
  ON public.audit_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid()));

CREATE POLICY "System can insert audit logs" 
  ON public.audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Support can manage deleted reports" 
  ON public.deleted_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.user_metadata->>'role' IN ('Support', 'Admin')
    )
  );

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

### Instrucciones PASO 2:

1. Abre nueva ventana/pestaña: **https://app.supabase.com/project/ceowmvfxjgrgwrespcrb/sql/new**
2. **Copia TODO** el SQL arriba
3. **Pega** en el editor
4. Click **RUN** (botón verde) o presiona **Ctrl+Enter**
5. Espera respuesta ✅ "Success" o mensaje completado

**Si falla con "type already exists":**
- ✅ Es NORMAL - significa que se ejecutó antes
- Continúa a PASO 3

---

## 📝 PASO 3: Ejecutar MIGRATION 2

**Nombre:** `20260614_FIX_admin_tables_usuarios_reference.sql`

### Contenido a copiar:

```sql
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
  modules_access jsonb DEFAULT '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}'::jsonb NOT NULL,
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

-- 8. Initialize data for existing users
INSERT INTO public.user_activity_log (user_id, reports_created, is_suspended)
SELECT u.id, 0, false
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_activity_log ual WHERE ual.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_permissions (user_id, modules_access)
SELECT u.id, '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}'::jsonb
FROM public.usuarios u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_permissions up WHERE up.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;
```

### Instrucciones PASO 3:

1. Abre **nueva query**: **https://app.supabase.com/project/ceowmvfxjgrgwrespcrb/sql/new**
2. **Copia TODO** el SQL arriba
3. **Pega** en el editor
4. Click **RUN** (botón verde) o presiona **Ctrl+Enter**
5. Espera respuesta ✅ "Success"

---

## ✅ PASO 4: Verificar

Ejecuta estas 2 queries para verificar:

### Query A - Verificar tablas:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_permissions','user_permission_details','user_activity_log','audit_logs','deleted_reports') 
ORDER BY table_name;
```

**Resultado esperado:** 5 filas
- audit_logs
- deleted_reports
- user_activity_log
- user_permission_details
- user_permissions

### Query B - Verificar columna modules_access:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_schema='public' 
AND table_name='user_permissions' 
AND column_name='modules_access';
```

**Resultado esperado:** 1 fila con `modules_access`

---

## 🎉 ¡Listo!

Después de ejecutar:
- Abre: **https://intelasist-ai.vercel.app/admin**
- Verifica que no haya errores 404
- Tab Resumen debe mostrar estadísticas
- Tab Permisos debe mostrar usuarios
- Todos los tabs deben cargar correctamente

---

## 📞 Si hay problemas:

**Error "type already exists":**
- Normal si se ejecutó antes
- Continúa a PASO 3

**Error "relation ... does not exist":**
- Tabla no encontrada
- Verifica que PASO 2 se ejecutó correctamente

**Error de conexión a Supabase:**
- Cierra sesión y vuelve a hacer login
- Intenta en navegador privado

**Admin Dashboard aún muestra errores 404:**
- Espera 2-3 minutos por replicación de BD
- Recarga página (Ctrl+F5)
- Verifica Network tab en DevTools
