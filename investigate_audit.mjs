import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.ceowmvfxjgrgwrespcrb:*dT%3F9C%23K%3Fa%24Uw5Y@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  try {
    console.log('🔍 Investigando registros sin email...\n');
    
    // Consulta: Ver registros sin email pero con el primero que encontremos
    const result = await pool.query(`
      SELECT id, user_id, user_email, user_name, action, created_at
      FROM audit_logs 
      WHERE user_email IS NULL OR user_email = ''
      LIMIT 10
    `);
    
    console.log(`Encontrados ${result.rows.length} registros sin email:\n`);
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ID: ${row.id.substring(0, 8)}...`);
      console.log(`   user_id: ${row.user_id}`);
      console.log(`   action: ${row.action}`);
      console.log(`   created_at: ${row.created_at}`);
      console.log('');
    });
    
    console.log('---\n');
    
    // Ahora vamos a buscar un admin que hizo estas acciones en esa fecha
    const adminResult = await pool.query(`
      SELECT id, nombre, correo, rol FROM usuarios WHERE rol = 'admin' LIMIT 5
    `);
    
    console.log(`Usuarios ADMIN encontrados:\n`);
    adminResult.rows.forEach(row => {
      console.log(`- ${row.nombre} (${row.correo}) - ID: ${row.id}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
