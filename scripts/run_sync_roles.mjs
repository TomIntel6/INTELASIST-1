import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Pool } from 'pg'

dotenv.config()

const sqlPath = resolve(process.cwd(), 'SYNC_ROLES_AND_PERMISSIONS.sql')
const sql = readFileSync(sqlPath, 'utf8')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function run() {
  const client = await pool.connect()
  try {
    console.log('Ejecutando SQL:', sqlPath)
    const res = await client.query(sql)
    console.log('SQL ejecutado. command:', res.command || 'MULTI')
    console.log('Revisa la salida final en la DB para confirmar.')
    process.exit(0)
  } catch (err) {
    console.error('ERROR ejecutando SQL:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
