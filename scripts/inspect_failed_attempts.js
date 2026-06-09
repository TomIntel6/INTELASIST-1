import pool from '../db.js'

async function inspect() {
  try {
    const result = await pool.query("SELECT id, user_email, user_name, missing_fields, attempted_at FROM failed_report_attempts ORDER BY attempted_at DESC LIMIT 50")
    console.log('Rows:', result.rowCount)
    for (const row of result.rows) {
      console.log(row)
    }
  } catch (err) {
    console.error('Error querying failed_report_attempts:', err)
  } finally {
    await pool.end()
  }
}

inspect()
