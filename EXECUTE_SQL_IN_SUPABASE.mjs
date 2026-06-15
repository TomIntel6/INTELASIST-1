#!/usr/bin/env node

/**
 * EXECUTE_SQL_IN_SUPABASE.mjs
 * 
 * Intenta ejecutar el SQL en Supabase usando múltiples métodos:
 * 1. Via Supabase admin client (si existe exec_sql RPC)
 * 2. Via HTTP API directo
 * 3. Via Supabase CLI (si está instalado)
 * 4. Manual copy/paste
 * 
 * Uso: node EXECUTE_SQL_IN_SUPABASE.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'
import dotenv from 'dotenv'
import https from 'https'
import os from 'os'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env')
  process.exit(1)
}

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
  log(title, 'bright')
  log(`${'='.repeat(70)}`, 'cyan')
}

/**
 * Método 1: Via Supabase admin RPC
 */
async function executeViaRPC(sql) {
  try {
    log('🔹 Intentando vía Supabase Admin RPC...', 'blue')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) throw error
    
    log('✅ RPC ejecutado exitosamente', 'green')
    return { success: true, method: 'RPC', data }
  } catch (err) {
    log(`⚠️  RPC no disponible: ${String(err).substring(0, 50)}`, 'yellow')
    return { success: false, method: 'RPC', error: err }
  }
}

/**
 * Método 2: Via Supabase CLI
 */
async function executeViaCLI(sql) {
  try {
    log('🔹 Intentando vía Supabase CLI...', 'blue')
    
    // Verifica si CLI está instalada
    try {
      execSync('supabase --version', { stdio: 'ignore' })
    } catch {
      throw new Error('Supabase CLI no está instalada')
    }

    // Crea archivo temporal
    const tmpDir = os.tmpdir()
    const tmpFile = resolve(tmpDir, `sql_${Date.now()}.sql`)
    writeFileSync(tmpFile, sql)

    // Ejecuta vía CLI
    execSync(`supabase db execute < "${tmpFile}"`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    })

    log('✅ CLI ejecutado exitosamente', 'green')
    return { success: true, method: 'CLI', data: 'CLI executed' }
  } catch (err) {
    log(`⚠️  CLI no disponible: ${String(err).substring(0, 50)}`, 'yellow')
    return { success: false, method: 'CLI', error: err }
  }
}

/**
 * Método 3: Verificar que las tablas existan
 */
async function verifyTables() {
  try {
    log('🔹 Verificando si las tablas existen...', 'blue')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const tables = ['user_activity_log', 'user_permissions', 'user_permission_details']
    let allExist = true

    for (const table of tables) {
      const { error } = await supabase.from(table).select('*', {
        count: 'exact',
        head: true,
      })

      if (error?.code === 'PGRST116') {
        log(`  ❌ ${table} - NO EXISTE`, 'red')
        allExist = false
      } else if (error) {
        log(`  ⚠️  ${table} - Error: ${error.message}`, 'yellow')
      } else {
        log(`  ✅ ${table} - Existe`, 'green')
      }
    }

    return allExist
  } catch (err) {
    log(`❌ Error verificando: ${String(err).substring(0, 50)}`, 'red')
    return false
  }
}

/**
 * Main
 */
async function main() {
  section('EJECUTAR SQL EN SUPABASE')

  log('📝 Leyendo archivo SQL...', 'blue')
  const sqlPath = resolve(process.cwd(), 'CREATE_TABLES_NO_RESTRICTIONS.sql')
  if (!existsSync(sqlPath)) {
    log(`❌ No se encontró: ${sqlPath}`, 'red')
    process.exit(1)
  }

  const sql = readFileSync(sqlPath, 'utf8')
  log(`✅ Archivo cargado: ${sql.length} caracteres`, 'green')

  section('MÉTODOS DE EJECUCIÓN')

  // Primero: Verifica si ya existen
  log('\n🔍 Paso 1: Verificar estado actual...', 'cyan')
  const tablesExist = await verifyTables()

  if (tablesExist) {
    log('\n✅ ¡Las tablas ya existen! No hay nada que hacer.', 'green')
    
    log('\n📋 Próximos pasos:', 'cyan')
    log('1. node SYNC_SUPABASE_AUTH_ROLES.mjs', 'yellow')
    log('2. node VERIFY_ADMIN_SETUP.mjs', 'yellow')
    log('3. Recarga la app (Ctrl+F5)', 'yellow')
    return
  }

  // Intenta diferentes métodos
  log('\n⏳ Paso 2: Intentar crear tablas...', 'cyan')
  
  // Método 1: RPC
  const rpcResult = await executeViaRPC(sql)
  
  if (rpcResult.success) {
    log('\n✅ Tablas creadas exitosamente vía RPC', 'green')
  } else {
    // Método 2: CLI
    const cliResult = await executeViaCLI(sql)
    
    if (cliResult.success) {
      log('\n✅ Tablas creadas exitosamente vía CLI', 'green')
    } else {
      // Método 3: Manual
      section('NO SE PUDO EJECUTAR AUTOMÁTICAMENTE')
      log('\n⚠️  Necesitas ejecutar el SQL manualmente en Supabase', 'yellow')
      log('\n📋 Instrucciones:', 'cyan')
      log('1. Ve a: https://supabase.com/dashboard', 'yellow')
      log('2. Selecciona tu proyecto', 'yellow')
      log('3. Haz clic en: SQL Editor (en el menú izquierdo)', 'yellow')
      log('4. Haz clic en: NEW QUERY', 'yellow')
      log('5. Abre el archivo: CREATE_TABLES_NO_RESTRICTIONS.sql', 'yellow')
      log('6. Copia TODO (Ctrl+A, Ctrl+C)', 'yellow')
      log('7. Pégalo en el editor de Supabase (Ctrl+V)', 'yellow')
      log('8. Haz clic en: RUN o presiona Cmd+Enter', 'yellow')
      log('9. Espera a que se complete ✅', 'yellow')
      
      log('\n📝 También puedes:', 'cyan')
      log('- Instalar Supabase CLI: npm install -g supabase', 'blue')
      log('- Luego ejecutar: supabase db push', 'blue')
      
      return
    }
  }

  // Verifica de nuevo
  section('VERIFICACIÓN FINAL')
  const finalCheck = await verifyTables()

  if (finalCheck) {
    log('\n✅ TODAS LAS TABLAS CREADAS', 'green')
    log('\n📋 Próximos pasos:', 'cyan')
    log('1. node SYNC_SUPABASE_AUTH_ROLES.mjs', 'yellow')
    log('2. node VERIFY_ADMIN_SETUP.mjs', 'yellow')
    log('3. Recarga la app (Ctrl+F5)', 'yellow')
  } else {
    log('\n❌ Las tablas no se crearon', 'red')
    log('Intenta ejecutar manualmente en Supabase SQL Editor', 'yellow')
  }
}

main().catch(err => {
  log(`\n❌ Error fatal: ${err instanceof Error ? err.message : String(err)}`, 'red')
  process.exit(1)
})
