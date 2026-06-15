import pkg from 'pg'
const { Client } = pkg

const client = new Client({
  host: 'ceowmvfxjgrgwrespcrb.postgres.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlb3dtdmZ4amdyZ3dyZXNwY3JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0NjYyOSwiImV4cCI6MjA5NjUyMjYyOX0.DmTZE3eEgRLpH8sgqKxVax0pdg40BYdDkWajr1wA9Xc',
  ssl: { rejectUnauthorized: false }
})

await client.connect()

// Migration 1: Advanced Permissions System
const migration1 = `
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
`

// Migration 2: Fix Admin Tables
const migration2 = `
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
`

async function executeSQL(sql, description) {
  try {
    console.log(`\n🚀 Executing: ${description}`)
    await client.query(sql)
    console.log(`✅ ${description} completed successfully`)
    return true
  } catch (err) {
    console.error(`❌ Error in ${description}:`)
    console.error(`   Code: ${err.code}`)
    console.error(`   Message: ${err.message}`)
    return false
  }
}

async function runMigrations() {
  console.log('='.repeat(80))
  console.log('🔄 STARTING MIGRATION EXECUTION')
  console.log('='.repeat(80))
  
  // Step 1: Execute Migration 1
  console.log('\n📋 STEP 1: Executing 20260614_advanced_permissions_system.sql')
  const result1 = await executeSQL(migration1, 'Migration 1')
  
  if (!result1) {
    console.error('❌ Migration 1 failed. Stopping.')
    return
  }
  
  // Step 2: Execute Migration 2
  console.log('\n📋 STEP 2: Executing 20260614_FIX_admin_tables_usuarios_reference.sql')
  const result2 = await executeSQL(migration2, 'Migration 2')
  
  if (!result2) {
    console.error('❌ Migration 2 failed. Stopping.')
    return
  }
  
  // Step 3: Verification query
  console.log('\n📋 STEP 3: Executing verification query')
  const verificationSQL = `
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('user_permissions','user_permission_details','user_activity_log','audit_logs','deleted_reports') 
    ORDER BY table_name;
  `
  
  try {
    const verificationResult = await client.query(verificationSQL)
    console.log('\n✅ VERIFICATION RESULTS:')
    console.log(`Found ${verificationResult.rows.length} tables:`)
    verificationResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`)
    })
    
    if (verificationResult.rows.length < 5) {
      console.warn('\n⚠️  WARNING: Expected 5 tables, found ' + verificationResult.rows.length)
    }
  } catch (err) {
    console.error('❌ Verification query failed:')
    console.error(`   Code: ${err.code}`)
    console.error(`   Message: ${err.message}`)
  }
  
  // Step 4: Check modules_access column
  console.log('\n📋 STEP 4: Checking modules_access column')
  const modulesCheckSQL = `
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema='public' 
    AND table_name='user_permissions' 
    AND column_name='modules_access';
  `
  
  try {
    const modulesResult = await client.query(modulesCheckSQL)
    
    if (modulesResult.rows && modulesResult.rows.length > 0) {
      console.log('✅ modules_access column EXISTS')
    } else {
      console.log('❌ modules_access column NOT FOUND')
    }
  } catch (err) {
    console.error('❌ modules_access check failed:')
    console.error(`   Code: ${err.code}`)
    console.error(`   Message: ${err.message}`)
  }
  
  await client.end()
  
  console.log('\n' + '='.repeat(80))
  console.log('✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY')
  console.log('='.repeat(80))
}

runMigrations()
