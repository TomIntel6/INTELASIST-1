import pool from './db.js'

async function insertUser() {
  try {
    const result = await pool.query(`
      INSERT INTO usuarios (nombre, correo)
      VALUES ('Jose', 'jrodriguez@intelasist.com')
      RETURNING *
    `)

    console.log(result.rows)
  } catch (err) {
    console.error(err)
  }
}

insertUser()