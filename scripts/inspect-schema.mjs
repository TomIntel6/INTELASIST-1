import pool from '../db.js'

async function main() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'reports' AND column_name IN ('created_at','updated_at') ORDER BY column_name")
    console.log(JSON.stringify(res.rows, null, 2))
  } catch (error) {
    console.error(error)
  } finally {
    await pool.end()
  }
}

main()
