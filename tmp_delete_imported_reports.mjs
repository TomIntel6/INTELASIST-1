import { Pool } from 'pg'
const pool = new Pool({ user: 'postgres', host:'localhost', database:'mi_sistema', password:'0nMPIDXwOmWtydl1', port: 5432 })
try {
 const countRes = await pool.query(`
   SELECT count(*) AS count
   FROM reports
   WHERE created_by_email = $1
     AND created_at >= $2
 `, ['jrodriguez@intelasist.com', '2026-05-28T19:05:19Z'])
 console.log('COUNT_BEFORE:', JSON.stringify(countRes.rows, null, 2))
 const deleteRes = await pool.query(`
   DELETE FROM reports
   WHERE created_by_email = $1
     AND created_at >= $2
   RETURNING id
 `, ['jrodriguez@intelasist.com', '2026-05-28T19:05:19Z'])
 console.log('DELETED:', deleteRes.rowCount)
} catch (err) {
 console.error(err)
 process.exit(1)
} finally {
 await pool.end()
}
