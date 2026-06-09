import pool from '../db.js'

async function main() {
  try {
    const res = await pool.query("SELECT id, created_at, created_at::text AS created_at_text FROM reports ORDER BY created_at DESC LIMIT 10")
    console.log(JSON.stringify(res.rows, null, 2))
  } catch (error) {
    console.error(error)
  } finally {
    await pool.end()
  }
}

main()
