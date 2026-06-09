import bcrypt from 'bcrypt'
import { Pool } from 'pg'
const pool = new Pool({ user: 'postgres', host:'localhost', database:'mi_sistema', password:'0nMPIDXwOmWtydl1', port: 5432 })
try {
 const hash = await bcrypt.hash('Password123!', 10)
 const res = await pool.query("UPDATE usuarios SET password = $1, must_change_password = false WHERE correo = $2 RETURNING id, correo, must_change_password", [hash, 'oospina@intelasist.com'])
 console.log(JSON.stringify(res.rows, null, 2))
} catch (err) {
 console.error(err)
 process.exit(1)
} finally {
 await pool.end()
}
