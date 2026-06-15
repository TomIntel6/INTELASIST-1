import pool from '../db.js'

async function main() {
  try {
    const ures = await pool.query('SELECT id, correo, nombre, rol, roles FROM usuarios LIMIT 50')
    console.log('usuarios rows:', ures.rows.length)
    console.table(ures.rows)

    const pres = await pool.query('SELECT id, user_id, modules_access FROM user_permissions LIMIT 50')
    console.log('user_permissions rows:', pres.rows.length)
    console.table(pres.rows)

    const count = await pool.query("SELECT COUNT(*) as c FROM usuarios")
    console.log('usuarios count:', count.rows[0].c)
  } catch (err) {
    console.error('Error querying DB:', err)
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error(err)
})
