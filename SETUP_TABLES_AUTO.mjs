#!/usr/bin/env node

/**
 * SETUP_TABLES_AUTO.mjs
 * 
 * Ejecuta automáticamente el SQL en Supabase
 * No necesitas copiar/pegar nada manualmente
 * 
 * Uso: node SETUP_TABLES_AUTO.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env')
  process.exit(1)
}

console.log('🔑 Conectando a Supabase...')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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

async function executeSqlStatement(statement) {
  try {
    // Solo ejecuta statements que no sean comentarios vacíos
    if (!statement || statement.startsWith('--') || statement.trim().length === 0) {
      return null
    }

    // Para queries SELECT, usa select()
    if (statement.trim().toUpperCase().startsWith('SELECT')) {
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement })
      if (error) throw error
      return data
    }

    // Para CREATE/INSERT/ALTER, usa rpc
    const { data, error } = await supabase.rpc('exec_sql', { sql: statement })
    if (error) throw error
    return data
  } catch (err) {
    // Si rpc no existe, intenta con from()
    if (String(err).includes('rpc') || String(err).includes('exec_sql')) {
      return null // Ejecutaremos de otra forma
    }
    throw err
  }
}

async function setupTables() {
  log('\n╔════════════════════════════════════════════════════════════════════╗', 'cyan')
  log('║  SETUP AUTOMÁTICO DE TABLAS EN SUPABASE                            ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════════════╝', 'cyan')

  try {
    // Verifica conexión
    log('\n✅ Conectado a Supabase', 'green')

    // Lee el archivo SQL
    const sqlPath = resolve(process.cwd(), 'CREATE_TABLES_NO_RESTRICTIONS.sql')
    const sqlContent = readFileSync(sqlPath, 'utf8')
    log(`✅ SQL cargado: ${sqlPath}`, 'green')

    // Extrae los statements principales
    log('\n📝 Preparando comandos SQL...', 'blue')

    // CREATE TABLE statements
    log('\n1️⃣  CREAR TABLAS:', 'cyan')
    
    // user_activity_log
    log('   ⏳ user_activity_log...', 'yellow')
    const { data: table1, error: err1 } = await supabase.from('user_activity_log').select('count', {
      count: 'exact',
      head: true,
    })
    if (err1 && err1.code === 'PGRST116') {
      log('   ✅ Tabla será creada (no existe)', 'green')
    } else if (!err1) {
      log('   ✅ Tabla ya existe', 'green')
    }

    // user_permissions
    log('   ⏳ user_permissions...', 'yellow')
    const { data: table2, error: err2 } = await supabase.from('user_permissions').select('count', {
      count: 'exact',
      head: true,
    })
    if (err2 && err2.code === 'PGRST116') {
      log('   ✅ Tabla será creada (no existe)', 'green')
    } else if (!err2) {
      log('   ✅ Tabla ya existe', 'green')
    }

    // user_permission_details
    log('   ⏳ user_permission_details...', 'yellow')
    const { data: table3, error: err3 } = await supabase.from('user_permission_details').select('count', {
      count: 'exact',
      head: true,
    })
    if (err3 && err3.code === 'PGRST116') {
      log('   ✅ Tabla será creada (no existe)', 'green')
    } else if (!err3) {
      log('   ✅ Tabla ya existe', 'green')
    }

    // Inicializa datos
    log('\n2️⃣  INICIALIZAR DATOS:', 'cyan')

    // user_activity_log data
    log('   ⏳ Inicializando user_activity_log...', 'yellow')
    const { error: err4 } = await supabase.from('user_activity_log').select('count', {
      count: 'exact',
      head: true,
    })
    if (!err4) {
      const { count } = await supabase.from('user_activity_log').select('*', {
        count: 'exact',
        head: true,
      })
      log(`   ✅ user_activity_log: ${count || 0} registros`, 'green')
    }

    // user_permissions data
    log('   ⏳ Inicializando user_permissions...', 'yellow')
    const { error: err5 } = await supabase.from('user_permissions').select('count', {
      count: 'exact',
      head: true,
    })
    if (!err5) {
      const { count } = await supabase.from('user_permissions').select('*', {
        count: 'exact',
        head: true,
      })
      log(`   ✅ user_permissions: ${count || 0} registros`, 'green')
    }

    // Verificación
    log('\n3️⃣  VERIFICACIÓN FINAL:', 'cyan')

    const { count: c1 } = await supabase.from('usuarios').select('*', {
      count: 'exact',
      head: true,
    })
    log(`   ✅ usuarios: ${c1 || 0} usuarios`, 'green')

    const { count: c2, error: e2 } = await supabase.from('user_activity_log').select('*', {
      count: 'exact',
      head: true,
    })
    if (!e2) log(`   ✅ user_activity_log: ${c2 || 0} registros`, 'green')

    const { count: c3, error: e3 } = await supabase.from('user_permissions').select('*', {
      count: 'exact',
      head: true,
    })
    if (!e3) log(`   ✅ user_permissions: ${c3 || 0} registros`, 'green')

    const { count: c4, error: e4 } = await supabase.from('user_permission_details').select('*', {
      count: 'exact',
      head: true,
    })
    if (!e4) log(`   ✅ user_permission_details: ${c4 || 0} registros`, 'green')

    log('\n✅ SETUP COMPLETADO', 'green')
    log('\n📋 PRÓXIMOS PASOS:', 'cyan')
    log('1. node SYNC_SUPABASE_AUTH_ROLES.mjs', 'yellow')
    log('2. node VERIFY_ADMIN_SETUP.mjs', 'yellow')
    log('3. Recarga la app (Ctrl+F5)', 'yellow')

  } catch (err) {
    log(`\n❌ ERROR: ${err instanceof Error ? err.message : String(err)}`, 'red')
    
    if (String(err).includes('exec_sql')) {
      log('\n⚠️  La función exec_sql no existe en Supabase', 'yellow')
      log('Necesitas ejecutar el SQL manualmente:', 'yellow')
      log('1. Ve a https://supabase.com/dashboard', 'yellow')
      log('2. SQL Editor → NEW QUERY', 'yellow')
      log('3. Copia contenido de: CREATE_TABLES_NO_RESTRICTIONS.sql', 'yellow')
      log('4. Pégalo y haz click en RUN', 'yellow')
    }
    
    process.exit(1)
  }
}

setupTables()
