import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
const deleted = await client.query("DELETE FROM work_shifts WHERE id = '25c24232-438e-45a6-8b45-d09d1443fa82' RETURNING id")
const remaining = await client.query('SELECT COUNT(*)::int AS count FROM work_shifts')
console.log(JSON.stringify({ deleted: deleted.rows, remaining: remaining.rows[0].count }, null, 2))
await client.end()
