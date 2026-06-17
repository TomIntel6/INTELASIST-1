const SUPABASE_URL = 'https://cqxvggucpfvmwdfsnskt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeHZnZ3VjcGZ2bXdkZnNuc2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4MzI2NjcsImV4cCI6MjA1MTQwODY2N30.9VF7bB8KKVlFvZlnwQPPa8Pj0oHBdHvp7VJG3WVx_1E';

// Realizar una consulta REST a Supabase
async function request(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }

  return response.json();
}

async function main() {
  try {
    console.log('🔄 Iniciando proceso de llenar user_names en audit_logs...\n');

    // 1. Obtener todos los registros con user_name vacío o nulo
    console.log('1️⃣ Obteniendo registros con user_name vacío...');
    const emptyNameLogs = await request('audit_logs?select=*&or=(user_name.is.null,user_name.eq.%22%22)&limit=1000');
    console.log(`   ✅ Se encontraron ${emptyNameLogs.length} registros con user_name vacío\n`);

    if (emptyNameLogs.length === 0) {
      console.log('✅ No hay registros que actualizar. ¡Todos tienen user_name!');
      return;
    }

    // 2. Para cada registro, obtener el nombre del usuario
    console.log('2️⃣ Obteniendo nombres de usuarios desde tabla usuarios...');
    const updates = [];

    for (const log of emptyNameLogs) {
      try {
        if (!log.user_email) {
          console.log(`   ⚠️  Registro ${log.id}: No tiene user_email`);
          updates.push({
            id: log.id,
            user_name: 'Usuario Desconocido',
          });
          continue;
        }

        // Buscar el usuario por email
        const users = await request(`usuarios?select=nombre&correo=eq.${encodeURIComponent(log.user_email)}`);
        
        if (users.length > 0) {
          const userName = users[0].nombre || log.user_email;
          updates.push({
            id: log.id,
            user_name: userName,
          });
          console.log(`   ✅ ${log.id}: ${log.user_email} → ${userName}`);
        } else {
          // Fallback: usar el email como nombre
          updates.push({
            id: log.id,
            user_name: log.user_email,
          });
          console.log(`   ⚠️  ${log.id}: No encontrado, usando email: ${log.user_email}`);
        }
      } catch (e) {
        console.log(`   ❌ Error procesando log ${log.id}: ${e.message}`);
        updates.push({
          id: log.id,
          user_name: log.user_email || 'Usuario Desconocido',
        });
      }
    }

    // 3. Actualizar los registros en lotes
    console.log(`\n3️⃣ Actualizando ${updates.length} registros en audit_logs...`);
    let updated = 0;

    for (const update of updates) {
      try {
        await request(`audit_logs?id=eq.${update.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            user_name: update.user_name,
          }),
        });
        updated++;
        if (updated % 10 === 0) {
          console.log(`   ✅ ${updated}/${updates.length} actualizados...`);
        }
      } catch (e) {
        console.log(`   ❌ Error actualizando log ${update.id}: ${e.message}`);
      }
    }

    console.log(`\n✅ Proceso completado!`);
    console.log(`   📊 Registros actualizados: ${updated}/${updates.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
