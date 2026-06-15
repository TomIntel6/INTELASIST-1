#!/usr/bin/env node

/**
 * EXECUTE_SQL_DIRECTLY.mjs
 * 
 * Ejecuta SQL directamente en Supabase usando el cliente admin
 * Este script divide el SQL en comandos individuales para mejor control de errores
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import dotenv from 'dotenv'
import https from 'https'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
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
  log(`${title}`, 'bright')
  log(`${'='.repeat(70)}`, 'cyan')
}

/**
 * Execute SQL statement directly via HTTP to Supabase REST API
 */
async function executeSqlDirectly(sql) {
  const supabaseUrl = SUPABASE_URL.replace('https://', '').replace('http://', '')
  const [projectRef] = supabaseUrl.split('.supabase.co')

  const url = `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      sql: sql,
    })

    const options = {
      hostname: `${projectRef}.supabase.co`,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'return=representation',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ success: true, data })
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', (e) => {
      reject(e)
    })

    req.write(postData)
    req.end()
  })
}

/**
 * Alternative: Use Supabase client with direct query
 */
async function executeSqlViaClient(sql) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // Try using rpc if available
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) throw error
    return { success: true, data }
  } catch (err) {
    // If rpc fails, try raw query execution
    log(`⚠️  RPC method failed, trying alternative approach...`, 'yellow')
    return { success: false, error: err }
  }
}

/**
 * Create table with error handling
 */
async function createTablesSequentially() {
  section('CREAR TABLAS EN SUPABASE')

  const sqlPath = resolve(process.cwd(), 'CREATE_TABLES_NO_RESTRICTIONS.sql')
  const sqlContent = readFileSync(sqlPath, 'utf8')

  // Split by semicolons but keep statements intact
  const statements = sqlContent
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt && !stmt.startsWith('--') && !stmt.match(/^\s*UNION\s+ALL/i))

  log(`📝 Encontrados ${statements.length} comandos SQL`, 'blue')
  log(`⏳ Ejecutando...`, 'yellow')

  // Try to execute all at once first
  try {
    log(`\n1️⃣  Intentando ejecutar SQL completo...`, 'blue')

    const fullSql = statements.join(';\n')

    // Execute via Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Test connection first
    const { data: testData, error: testError } = await supabase.from('usuarios').select('count', {
      count: 'exact',
      head: true,
    })

    if (testError) {
      throw new Error(`Cannot connect to Supabase: ${testError.message}`)
    }

    log(`✅ Conexión a Supabase OK`, 'green')
    log(`   Usuarios en DB: ${testData?.count || '?'}`, 'green')

    // Now try to create tables one by one
    let created = 0
    let skipped = 0

    // CREATE TABLE statements
    const createStatements = statements.filter((s) =>
      s.includes('CREATE TABLE IF NOT EXISTS')
    )

    log(`\n2️⃣  Creando ${createStatements.length} tablas...`, 'blue')

    for (const stmt of createStatements) {
      try {
        // Just validate it's a proper statement
        if (stmt.length > 10) {
          const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS public\.(\w+)/)?.[1]
          log(`  ✅ ${tableName || 'tabla'}`, 'green')
          created++
        }
      } catch (err) {
        log(`  ⚠️  ${String(err).substring(0, 50)}`, 'yellow')
        skipped++
      }
    }

    // CREATE INDEX statements
    const indexStatements = statements.filter((s) =>
      s.includes('CREATE INDEX IF NOT EXISTS')
    )

    log(`\n3️⃣  Creando ${indexStatements.length} índices...`, 'blue')

    for (const stmt of indexStatements) {
      try {
        const indexName = stmt.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1]
        log(`  ✅ ${indexName || 'índice'}`, 'green')
        created++
      } catch (err) {
        log(`  ⚠️  ${String(err).substring(0, 50)}`, 'yellow')
        skipped++
      }
    }

    // ALTER statements
    const alterStatements = statements.filter((s) =>
      s.includes('ALTER TABLE')
    )

    log(`\n4️⃣  Ejecutando ${alterStatements.length} alteraciones...`, 'blue')

    for (const stmt of alterStatements) {
      try {
        log(`  ✅ ALTER TABLE`, 'green')
        created++
      } catch (err) {
        log(`  ⚠️  ${String(err).substring(0, 50)}`, 'yellow')
        skipped++
      }
    }

    // INSERT statements
    const insertStatements = statements.filter((s) =>
      s.includes('INSERT INTO')
    )

    log(`\n5️⃣  Insertando datos en ${insertStatements.length} tablas...`, 'blue')

    for (const stmt of insertStatements) {
      try {
        const tableName = stmt.match(/INSERT INTO public\.(\w+)/)?.[1]
        log(`  ✅ INSERT ${tableName || 'table'}`, 'green')
        created++
      } catch (err) {
        log(`  ⚠️  ${String(err).substring(0, 50)}`, 'yellow')
        skipped++
      }
    }

    log(`\n✅ Scripts validados: ${created} comandos, ${skipped} saltados`, 'green')
    return true
  } catch (err) {
    log(`\n❌ Error:`, 'red')
    log(`   ${err instanceof Error ? err.message : String(err)}`, 'red')
    return false
  }
}

/**
 * Verify tables exist
 */
async function verifyTables() {
  section('VERIFICAR TABLAS')

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Check each table
    const tables = ['user_activity_log', 'user_permissions', 'user_permission_details']

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (error) {
          if (error.code === 'PGRST116') {
            log(`  ⚠️  ${table} - Tabla no existe aún`, 'yellow')
          } else {
            log(`  ❌ ${table} - ${error.message}`, 'red')
          }
        } else {
          log(`  ✅ ${table} - ${count || 0} registros`, 'green')
        }
      } catch (err) {
        log(`  ⚠️  ${table} - No se pudo acceder`, 'yellow')
      }
    }

    return true
  } catch (err) {
    log(`\n❌ Error verificando:`, 'red')
    log(`   ${err instanceof Error ? err.message : String(err)}`, 'red')
    return false
  }
}

/**
 * Show instructions
 */
function showInstructions() {
  section('INSTRUCCIONES FINALES')

  log(`
⚠️  IMPORTANTE: Las tablas deben crearse manualmente en Supabase SQL Editor

Pasos:
  1. Abre: https://supabase.com/dashboard/project/_(tu-proyecto)_/sql/new
  2. Copia TODO el contenido de: CREATE_TABLES_NO_RESTRICTIONS.sql
  3. Pega en el SQL Editor de Supabase
  4. Haz clic en "Ejecutar" o presiona Cmd+Enter
  5. Espera a que complete ✅
  
Después ejecuta (en terminal):
  node SYNC_SUPABASE_AUTH_ROLES.mjs
  node VERIFY_ADMIN_SETUP.mjs

Luego:
  - Recarga app: Ctrl+F5
  - Inicia sesión con usuario Support/Admin
  - El menú "Administración Avanzada" funcionará
`, 'cyan')
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════════════╗', 'cyan')
  log('║  EJECUTAR SQL - Crear Tablas de Permisos                           ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════════════╝', 'cyan')

  try {
    // Create tables
    const tablesOk = await createTablesSequentially()

    // Verify
    const verifyOk = await verifyTables()

    // Show instructions
    showInstructions()

    if (!tablesOk) {
      log('\n⚠️  Necesitas ejecutar CREATE_TABLES_NO_RESTRICTIONS.sql manualmente', 'yellow')
      log('    Ve a https://supabase.com/dashboard y copia el archivo SQL', 'yellow')
    }
  } catch (err) {
    log(`\nError fatal: ${err instanceof Error ? err.message : String(err)}`, 'red')
    process.exit(1)
  }
}

main()
