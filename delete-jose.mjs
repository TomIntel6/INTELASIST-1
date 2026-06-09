import pool from './db.js'

await pool.query('DELETE FROM usuarios WHERE correo = $1', ['jose@email.com'])
console.log('deleted')
