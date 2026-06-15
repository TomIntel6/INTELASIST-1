# INTELASIST - Advanced Permissions System Migration Guide

## 📋 Overview

This guide explains how to apply the Advanced Permissions and Audit System migration to your Supabase PostgreSQL database. The migration creates:

- **5 new tables** for permissions, auditing, and soft-delete functionality
- **Row Level Security (RLS) policies** for data protection
- **15+ database indexes** for performance
- **1 trigger** for automatic permission initialization
- **1 RPC function** for server-side audit logging

✅ **Fully backward compatible** - No existing tables are modified

---

## 🔧 Option 1: Supabase Dashboard (Recommended for Non-Technical Users)

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Left sidebar → SQL Editor
   - Click "New Query"

3. **Copy & Paste Migration SQL**
   - Open file: `/supabase/migrations/20260614_advanced_permissions_system.sql`
   - Copy ALL content
   - Paste into the SQL editor in Supabase

4. **Execute**
   - Click "Run" button
   - Wait for completion (should take ~5-10 seconds)
   - You should see: `✓ Success`

5. **Verify Tables Created**
   - Left sidebar → Database → Tables
   - Should see these new tables:
     - `user_permissions`
     - `user_permission_details`
     - `audit_logs`
     - `deleted_reports`
     - `user_activity_log`

---

## 🔧 Option 2: Supabase CLI (For Developers)

### Prerequisites:
- Node.js installed
- Supabase CLI: `npm install -g supabase`

### Steps:

```bash
# 1. Login to Supabase
supabase login

# 2. Link to your project
cd /path/to/INTELASIST
supabase link --project-id YOUR_PROJECT_ID

# 3. Push migration
supabase db push

# 4. Verify
supabase db remote commit
```

---

## 🔧 Option 3: Manual SQL Execution (If CLI Doesn't Work)

If you encounter issues with the full migration file, you can apply the SQL in smaller chunks:

### Step 1: Create Enums
```sql
CREATE TYPE audit_action_type AS ENUM (
  'create_report', 'update_report', 'delete_report', 'change_report_status',
  'add_update', 'delete_update', 'upload_evidence', 'delete_evidence',
  'create_user', 'delete_user', 'reset_password', 'change_role',
  'suspend_user', 'reactivate_user', 'update_permissions', 'manage_alerts',
  'restore_report', 'permanently_delete_report', 'empty_trash', 'login', 'logout'
);

CREATE TYPE audit_status AS ENUM ('success', 'error');
```

### Step 2: Create Tables
- Copy the table creation statements from the migration file
- Execute in order: `user_permissions` → `user_permission_details` → `audit_logs` → `deleted_reports` → `user_activity_log`

### Step 3: Create RLS Policies
- Copy all RLS policy statements from migration file
- Execute them

### Step 4: Create Trigger
- Copy trigger creation statement

### Step 5: Create RPC Function
- Copy RPC function creation statement

> **Note**: The full migration file is easier - use Option 1 or 2 if possible

---

## ✅ Post-Migration Verification

After migration completes, verify everything worked:

1. **In Supabase Dashboard:**
   - Tables section → All 5 new tables visible
   - Functions section → `log_audit_event` RPC function visible
   - Database → Triggers → `initialize_user_permissions` trigger visible

2. **Test Permission System:**
   - Login to INTELASIST app
   - Go to Settings → Admin Panel (if you have Support role)
   - Go to "Administración Avanzada" → "Permisos"
   - You should see your user listed with permissions

3. **Test Audit Logging:**
   - Create or edit an informe (report)
   - Go to admin panel → "Auditoría"
   - You should see events logged with your user and action

---

## 🔄 Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Drop tables (in reverse order of creation)
DROP TABLE IF EXISTS user_activity_log CASCADE;
DROP TABLE IF EXISTS deleted_reports CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_permission_details CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS log_audit_event(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT);

-- Drop trigger
DROP TRIGGER IF EXISTS initialize_user_permissions ON auth.users;
DROP FUNCTION IF EXISTS initialize_user_permissions();

-- Drop types
DROP TYPE IF EXISTS audit_status;
DROP TYPE IF EXISTS audit_action_type;
```

---

## 🐛 Troubleshooting

### Error: "relation 'user_permissions' already exists"
**Solution**: The table already exists from a previous migration. This is safe - the system will use existing tables.

### Error: "type 'audit_action_type' already exists"
**Solution**: The type already exists. This is safe - enums are reused.

### Error: "function 'auth.uid()' does not exist"
**Solution**: Make sure you're connected to the correct Supabase project. This is a Supabase built-in function.

### Error: "RLS policy '...' already exists"
**Solution**: This is safe - RLS policies are being re-applied. No data loss occurs.

### Audit logs not appearing after actions
**Resolution steps**:
1. Verify migration completed successfully
2. Verify user is logged in (check `auth.uid()` in dashboard)
3. Check audit_logs table has rows: `SELECT COUNT(*) FROM audit_logs;`
4. Check RPC function exists: `SELECT * FROM pg_proc WHERE proname = 'log_audit_event';`

---

## 📚 What's New After Migration

### For End Users:
- ✅ Can see admin panel (if Support role)
- ✅ Can view all audit logs
- ✅ Can manage permissions (if authorized)
- ✅ Can recover deleted reports from trash

### For Developers:
- ✅ Audit logging automatically on all actions
- ✅ Full permission control via `usePermissions()` hook
- ✅ Soft-delete via `TrashService`
- ✅ Audit queries via `AuditService.fetchAuditLogs()`

---

## 📞 Support

If you encounter issues:

1. **Check migration file syntax** - Open `/supabase/migrations/20260614_advanced_permissions_system.sql`
2. **Verify Supabase project** - Make sure you're connected to the right project
3. **Check console errors** - Browser F12 → Console tab
4. **Review Supabase logs** - Dashboard → Logs tab

---

## ✨ Next Steps After Migration

1. ✅ **Migration applied** → You're here
2. 🔄 **Configure WebSockets** → Real-time audit updates (Optional Phase 4)
3. 📊 **Deploy to production** → Push to Render backend
4. 🚀 **Go live** → Users get full advanced admin features

---

**File reference**: `/supabase/migrations/20260614_advanced_permissions_system.sql`

**Last updated**: 2026-06-14

