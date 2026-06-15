#!/usr/bin/env node

import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config()

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida en .env')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

async function main() {
  const client = await pool.connect()
  try {
    const res = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('user_activity_log','user_permissions','user_permission_details') ORDER BY table_name"
    )
    console.log('TABLAS EXISTENTES:', res.rows.map(r => r.table_name))

    const allTables = ['user_activity_log', 'user_permissions', 'user_permission_details']
    const found = res.rows.map(r => r.table_name)
    for (const table of allTables) {
      console.log(`- ${table}: ${found.includes(table) ? '✅' : '❌'}`)
    }
  } catch (err) {
    console.error('ERROR verificando tablas:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
