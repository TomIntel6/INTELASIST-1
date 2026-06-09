import pool from './db.js'

try {
  const result = await pool.query(
    'SELECT id, nombre, correo, rol, password, must_change_password FROM usuarios WHERE correo = $1',
    ['ycordoba@intelasist.com']
  )
  
  if (result.rows.length === 0) {
    console.log('Usuario no encontrado')
    process.exit(1)
  }

  const user = result.rows[0]
  console.log('Usuario encontrado:')
  console.log(`  ID: ${user.id}`)
  console.log(`  Nombre: ${user.nombre}`)
  console.log(`  Correo: ${user.correo}`)
  console.log(`  Rol: ${user.rol}`)
  console.log(`  Password: ${user.password ? 'SÍ (hash presente)' : 'NO (NULL)'}`)
  console.log(`  Must Change Password: ${user.must_change_password}`)
  
  // Si no tiene password, crear uno
  if (!user.password) {
    console.log('\n⚠️ Usuario sin contraseña. Estableciendo una...')
    const bcrypt = await import('bcrypt')
    const hashedPassword = await bcrypt.default.hash('Temporal123!', 10)
    
    await pool.query(
      'UPDATE usuarios SET password = $1, must_change_password = true WHERE id = $2',
      [hashedPassword, user.id]
    )
    console.log('✓ Contraseña establecida a "Temporal123!"')
    console.log('✓ El usuario debe cambiarla en el siguiente login')
  }
  
  process.exit(0)
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
