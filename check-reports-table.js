import pool from './db.js'

async function checkReportsTable() {
  try {
    console.log('Verificando estructura de la tabla reports...\n')
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'reports'
      ORDER BY ordinal_position;
    `)
    
    console.log('Columnas en la tabla reports:')
    result.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? '(nullable)' : '(NOT NULL)'
      console.log(`  - ${row.column_name}: ${row.data_type} ${nullable}`)
    })
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

checkReportsTable()
