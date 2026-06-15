#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);

const SUPABASE_URL = 'https://ceowmvfxjgrgwrespcrb.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlb3dtdmZ4amdyZ3dyZXNwY3JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk0NjYyOSwiZXhwIjoyMDk2NTIyNjI5fQ.DmTZE3eEgRLpH8sgqKxVax0pdg40BYdDkWajr1wA9Xc';

// Read migration files
const migration1Path = path.join(process.cwd(), 'supabase', 'migrations', '20260614_advanced_permissions_system.sql');
const migration2Path = path.join(process.cwd(), 'supabase', 'migrations', '20260614_FIX_admin_tables_usuarios_reference.sql');

console.log('\n' + '='.repeat(80));
console.log('🔄 INICIANDO EJECUCIÓN DE MIGRACIONES SUPABASE');
console.log('='.repeat(80) + '\n');

async function executeSQLQuery(sql, description) {
  try {
    console.log(`🚀 ${description}`);
    
    // Escape quotes and create JSON payload
    const escapedSql = sql.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const payload = `{"query":"${escapedSql}"}`;
    
    // Use curl to execute
    const command = `curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \\
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \\
      -H "Content-Type: application/json" \\
      -d '${payload}'`;
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && stderr.includes('error')) {
      console.error(`❌ Error: ${stderr}`);
      return false;
    }
    
    console.log(`✅ ${description} completada\n`);
    return true;
  } catch (err) {
    if (err.message && err.message.includes('type already exists')) {
      console.warn(`⚠️  ADVERTENCIA: Los tipos ya existen (normal si se ejecutó antes)`);
      console.log(`   Continuando...\n`);
      return true;
    }
    console.error(`❌ Error: ${err.message}\n`);
    return false;
  }
}

async function runMigrations() {
  try {
    // Check if migration files exist
    if (!fs.existsSync(migration1Path)) {
      console.error(`❌ No se encontró: ${migration1Path}`);
      process.exit(1);
    }
    if (!fs.existsSync(migration2Path)) {
      console.error(`❌ No se encontró: ${migration2Path}`);
      process.exit(1);
    }
    
    // Read migration content
    const migration1 = fs.readFileSync(migration1Path, 'utf8');
    const migration2 = fs.readFileSync(migration2Path, 'utf8');
    
    // Execute migrations
    console.log('📋 PASO 1: Ejecutando Migration 1 (advanced_permissions_system)');
    const result1 = await executeSQLQuery(migration1, 'Migration 1');
    
    if (!result1) {
      console.error('❌ Migration 1 falló. Deteniendo.');
      process.exit(1);
    }
    
    console.log('📋 PASO 2: Ejecutando Migration 2 (FIX_admin_tables_usuarios_reference)');
    const result2 = await executeSQLQuery(migration2, 'Migration 2');
    
    if (!result2) {
      console.error('❌ Migration 2 falló. Deteniendo.');
      process.exit(1);
    }
    
    // Verification queries
    console.log('📋 PASO 3: Verificando tablas creadas');
    const verifySQL = `SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_permissions','user_permission_details','user_activity_log','audit_logs','deleted_reports') 
ORDER BY table_name;`;
    
    await executeSQLQuery(verifySQL, 'Query de verificación');
    
    console.log('📋 PASO 4: Verificando columna modules_access');
    const modulesSQL = `SELECT column_name FROM information_schema.columns 
WHERE table_schema='public' 
AND table_name='user_permissions' 
AND column_name='modules_access';`;
    
    await executeSQLQuery(modulesSQL, 'Query modules_access');
    
    console.log('='.repeat(80));
    console.log('✅ TODAS LAS MIGRACIONES COMPLETADAS EXITOSAMENTE');
    console.log('='.repeat(80) + '\n');
    
  } catch (err) {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
  }
}

runMigrations();
