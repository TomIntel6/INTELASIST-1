import { Pool } from 'pg'
const pool = new Pool({ user: 'postgres', host:'localhost', database:'mi_sistema', password:'0nMPIDXwOmWtydl1', port: 5432 })
try {
 const res = await pool.query("SELECT id, nombre, correo, rol, roles, password IS NOT NULL AS has_password FROM usuarios ORDER BY id LIMIT 100")
 console.log(JSON.stringify(res.rows, null, 2))
} catch (err) {
 console.error(err)
 process.exit(1)
} finally {
 await pool.end()
}
