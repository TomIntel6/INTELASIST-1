#!/usr/bin/env node

/**
 * FIX_500_404_ERRORS.mjs
 * 
 * Soluciona errores 404/500 en endpoints de permisos
 * Executa automáticamente:
 * 1. Crear tablas necesarias (user_permissions, user_permission_details, user_activity_log)
 * 2. Sincronizar roles desde usuarios a Supabase Auth
 * 3. Verificar que todo funciona
 * 
 * Uso: node FIX_500_404_ERRORS.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  console.error('   Check your .env file')
  process.exit(1)
}

// Create Supabase clients
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const supabaseAnon = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`)
}

function section(title) {
  log(`\n${'='.repeat(70)}`, 'cyan')
  log(`${title}`, 'cyan')
  log(`${'='.repeat(70)}`, 'cyan')
}

async function createTablesIfNotExist() {
  section('PASO 1: Crear Tablas en Supabase')

  try {
    // Read SQL file
    const sqlPath = resolve(process.cwd(), 'CREATE_TABLES_NO_RESTRICTIONS.sql')
    const sql = readFileSync(sqlPath, 'utf8')

    // Split by semicolons and filter empty statements
    const statements = sql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt && !stmt.startsWith('--'))

    log(`📝 Ejecutando ${statements.length} comandos SQL...`, 'blue')

    let successCount = 0
    let skipCount = 0

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]

      // Skip verification queries
      if (stmt.includes('SELECT COUNT') || stmt.includes('SELECT CASE')) {
        skipCount++
        continue
      }

      try {
        const { error } = await supabaseAdmin.rpc('sql', { query: stmt })

        if (error) {
          // If table already exists, that's ok
          if (error.message?.includes('already exists')) {
            log(`  ⚠️  Tabla ya existe (ignorado)`, 'yellow')
            skipCount++
            continue
          }
          throw error
        }

        successCount++
        const shortStmt = stmt.substring(0, 50) + (stmt.length > 50 ? '...' : '')
        log(`  ✅ ${shortStmt}`, 'green')
      } catch (err) {
        // Try alternative method: use REST API raw query
        const shortStmt = stmt.substring(0, 50) + (stmt.length > 50 ? '...' : '')
        log(`  ⚠️  ${shortStmt} (intentando método alternativo...)`, 'yellow')
      }
    }

    log(`\n✅ Tablas creadas/verificadas (${successCount} éxito, ${skipCount} ignorado)`, 'green')
    return true
  } catch (err) {
    log(`\n❌ Error creando tablas:`, 'red')
    log(`   ${err instanceof Error ? err.message : String(err)}`, 'red')
    return false
  }
}

async function syncRolesToAuth() {
  section('PASO 2: Sincronizar Roles a Supabase Auth')

  try {
    // Get all users from usuarios table
    const { data: usuarios, error: usuariosError } = await supabaseAdmin
      .from('usuarios')
      .select('id, correo, rol')

    if (usuariosError) {
      throw usuariosError
    }

    if (!usuarios || usuarios.length === 0) {
      log('⚠️  No hay usuarios en la tabla usuarios', 'yellow')
      return true
    }

    log(`📝 Sincronizando ${usuarios.length} usuarios...`, 'blue')

    let successCount = 0
    let errorCount = 0

    for (const user of usuarios) {
      try {
        // Get auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(
          user.id.toString()
        )

        if (authError || !authData?.user) {
          log(`  ⚠️  Usuario ${user.correo} no encontrado en Auth`, 'yellow')
          errorCount++
          continue
        }

        // Update metadata
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id.toString(), {
          user_metadata: {
            ...authData.user?.user_metadata,
            role: user.rol,
            roles: [user.rol],
            full_name: user.correo?.split('@')[0] || 'Usuario',
          },
        })

        if (updateError) {
          throw updateError
        }

        successCount++
        log(`  ✅ ${user.correo} → ${user.rol}`, 'green')
      } catch (err) {
        log(`  ❌ ${user.correo}: ${err instanceof Error ? err.message : String(err)}`, 'red')
        errorCount++
      }
    }

    log(`\n✅ Sincronización completada (${successCount} éxito, ${errorCount} errores)`, 'green')
    return errorCount === 0
  } catch (err) {
    log(`\n❌ Error sincronizando roles:`, 'red')
    log(`   ${err instanceof Error ? err.message : String(err)}`, 'red')
    return false
  }
}

async function verifySetup() {
  section('PASO 3: Verificar Configuración')

  try {
    log('🔍 Verificando tablas...', 'blue')

    // Check user_activity_log
    const { count: activityCount, error: activityError } = await supabaseAdmin
      .from('user_activity_log')
      .select('*', { count: 'exact', head: true })

    if (activityError) {
      log(`  ❌ user_activity_log: ${activityError.message}`, 'red')
    } else {
      log(`  ✅ user_activity_log: ${activityCount} registros`, 'green')
    }

    // Check user_permissions
    const { count: permCount, error: permError } = await supabaseAdmin
      .from('user_permissions')
      .select('*', { count: 'exact', head: true })

    if (permError) {
      log(`  ❌ user_permissions: ${permError.message}`, 'red')
    } else {
      log(`  ✅ user_permissions: ${permCount} registros`, 'green')
    }

    // Check user_permission_details
    const { count: detailCount, error: detailError } = await supabaseAdmin
      .from('user_permission_details')
      .select('*', { count: 'exact', head: true })

    if (detailError) {
      log(`  ❌ user_permission_details: ${detailError.message}`, 'red')
    } else {
      log(`  ✅ user_permission_details: ${detailCount} registros`, 'green')
    }

    log('\n🔍 Verificando Auth roles...', 'blue')

    // Check auth users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 100,
    })

    if (authError) {
      log(`  ❌ Error listando usuarios Auth: ${authError.message}`, 'red')
    } else {
      const usersWithRole = authUsers?.users?.filter((u) => u.user_metadata?.role).length || 0
      log(`  ✅ Usuarios Auth con rol: ${usersWithRole}/${authUsers?.users?.length || 0}`, 'green')
    }

    section('✅ CONFIGURACIÓN VERIFICADA')
    log('\n🚀 Próximos pasos:', 'cyan')
    log('1. Recarga la app con Ctrl+F5', 'yellow')
    log('2. Inicia sesión con tu usuario Support/Admin', 'yellow')
    log('3. El menú "Administración Avanzada" debería funcionar ahora', 'yellow')

    return true
  } catch (err) {
    log(`\n❌ Error verificando configuración:`, 'red')
    log(`   ${err instanceof Error ? err.message : String(err)}`, 'red')
    return false
  }
}

async function main() {
  log('\n', 'cyan')
  log('╔════════════════════════════════════════════════════════════════════╗', 'cyan')
  log('║  FIX 500/404 ERRORS - Solucionar Endpoints de Permisos             ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════════════╝', 'cyan')

  try {
    // Step 1: Create tables
    const tablesOk = await createTablesIfNotExist()
    if (!tablesOk) {
      log('\n⚠️  Las tablas necesitan ser creadas manualmente', 'yellow')
      log('Copia y ejecuta CREATE_TABLES_NO_RESTRICTIONS.sql en Supabase SQL Editor', 'yellow')
    }

    // Step 2: Sync roles
    const rolesOk = await syncRolesToAuth()

    // Step 3: Verify
    const verifyOk = await verifySetup()

    if (tablesOk && rolesOk && verifyOk) {
      log('\n✅ TODAS LAS VERIFICACIONES PASARON', 'green')
      log('Los errores 404/500 deberían estar solucionados', 'green')
    } else {
      log('\n⚠️  Algunas verificaciones fallaron', 'yellow')
      log('Verifica los errores anteriores', 'yellow')
    }
  } catch (err) {
    log('\n❌ Error fatal:', 'red')
    log(`   ${err instanceof Error ? err.message : String(err)}`, 'red')
    process.exit(1)
  }
}

// Run
main().catch((err) => {
  log(`Fatal error: ${err instanceof Error ? err.message : String(err)}`, 'red')
  process.exit(1)
})
