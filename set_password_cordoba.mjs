import pool from './db.js'
import bcrypt from 'bcrypt'

try {
  // Actualizar contraseña a "cordoba"
  const hashedPassword = await bcrypt.hash('cordoba', 10)
  
  const result = await pool.query(
    'UPDATE usuarios SET password = $1, must_change_password = false WHERE correo = $2 RETURNING id, nombre, correo',
    [hashedPassword, 'ycordoba@intelasist.com']
  )
  
  if (result.rowCount === 0) {
    console.log('❌ Usuario no encontrado')
    process.exit(1)
  }
  
  console.log('✓ Contraseña actualizada a "cordoba"')
  console.log('✓ Flag must_change_password puesto en false')
  console.log('Usuario:', result.rows[0])
  
  process.exit(0)
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
