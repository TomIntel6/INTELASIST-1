#!/usr/bin/env node

import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { Pool } from 'pg'

dotenv.config()

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida en .env')
  process.exit(1)
}

const sql = readFileSync('CREATE_TABLES_NO_RESTRICTIONS.sql', 'utf8')

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

async function main() {
  const client = await pool.connect()
  try {
    console.log('🔗 Conectado a la base de datos Supabase')
    console.log('➡️ Ejecutando SQL completo...')
    const res = await client.query(sql)
    console.log('✅ SQL ejecutado con éxito:', res.command || 'OK')
  } catch (err) {
    console.error('❌ Error al ejecutar SQL completo')
    console.error(err instanceof Error ? err.message : err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('\n🔥 Error al ejecutar SQL directamente en Supabase:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
