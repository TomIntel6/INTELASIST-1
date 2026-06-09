import { Pool } from 'pg'
const pool = new Pool({ user: 'postgres', host:'localhost', database:'mi_sistema', password:'0nMPIDXwOmWtydl1', port: 5432 })
try {
 const res = await pool.query(`
   SELECT created_by_email, count(*) AS count
   FROM reports
   GROUP BY created_by_email
   ORDER BY count DESC
   LIMIT 50
 `)
 console.log(JSON.stringify(res.rows, null, 2))
 const sample = await pool.query(`
   SELECT id, month, year, insured_name, plate, policy, service_type, brand, model, color, status, created_by_email, created_at
   FROM reports
   ORDER BY created_at DESC
   LIMIT 20
 `)
 console.log('SAMPLE:', JSON.stringify(sample.rows, null, 2))
} catch (err) {
 console.error(err)
 process.exit(1)
} finally {
 await pool.end()
}
