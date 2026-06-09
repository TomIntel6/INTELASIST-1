import pool from '../db.js'

async function main() {
  try {
    console.log('Convirtiendo columnas created_at y updated_at a timestamptz...')
    await pool.query(`ALTER TABLE reports ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'`)
    await pool.query(`ALTER TABLE reports ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'`)
    console.log('Conversión completada.')
  } catch (error) {
    console.error('Error al convertir columnas:', error)
  } finally {
    await pool.end()
  }
}

main()
