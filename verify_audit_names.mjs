import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.ceowmvfxjgrgwrespcrb:*dT%3F9C%23K%3Fa%24Uw5Y@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  try {
    console.log('📊 Verificando audit_logs...\n');
    
    // Consulta 1: Ver registros con user_name no vacío
    const result1 = await pool.query(`
      SELECT id, user_email, user_name FROM audit_logs 
      WHERE user_name IS NOT NULL AND user_name != '' 
      LIMIT 10
    `);
    
    console.log('✅ Registros con user_name lleno:');
    result1.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Email: ${row.user_email}, Name: ${row.user_name}`);
    });
    
    console.log('\n---\n');
    
    // Consulta 2: Ver registros con user_name vacío
    const result2 = await pool.query(`
      SELECT id, user_email, user_name FROM audit_logs 
      WHERE user_name IS NULL OR user_name = ''
      LIMIT 5
    `);
    
    console.log('❌ Registros con user_name vacío:');
    result2.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Email: ${row.user_email}, Name: "${row.user_name}"`);
    });
    
    console.log('\n---\n');
    
    // Consulta 3: Ver algunos usuarios en la tabla usuarios
    const result3 = await pool.query(`
      SELECT correo, nombre FROM usuarios LIMIT 5
    `);
    
    console.log('👥 Muestra de usuarios en tabla:');
    result3.rows.forEach(row => {
      console.log(`  Email: ${row.correo}, Name: ${row.nombre}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
