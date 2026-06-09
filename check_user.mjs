import pool from './db.js'

try {
  const result = await pool.query(
    'SELECT id, nombre, correo, rol, must_change_password FROM usuarios WHERE correo ILIKE $1',
    ['%ycordoba%']
  )
  console.log('Usuarios encontrados:')
  console.log(JSON.stringify(result.rows, null, 2))
  process.exit(0)
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
