import pool from './db.js'

async function addEvidenceUrlColumn() {
  try {
    console.log('Agregando columna evidence_url a la tabla reports...')
    
    await pool.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS evidence_url text;
    `)
    
    console.log('✅ Columna evidence_url agregada exitosamente')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error al agregar la columna:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

addEvidenceUrlColumn()
