#!/usr/bin/env node

/**
 * SYNC_SUPABASE_AUTH_ROLES.mjs
 * 
 * Script para sincronizar roles de la tabla `usuarios` a Supabase Auth custom claims
 * 
 * USO:
 * node SYNC_SUPABASE_AUTH_ROLES.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Preferir la service role key para operaciones admin; fallback a anon si no existe
const SUPABASE_CLIENT_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_CLIENT_KEY) {
  console.error('❌ ERROR: Faltan SUPABASE_URL o clave de cliente en .env (VITE_SUPABASE_ANON_KEY o SUPABASE_SERVICE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_CLIENT_KEY);

async function syncRolesToSupabaseAuth() {
  console.log('\n🔄 INICIANDO SINCRONIZACIÓN DE ROLES A SUPABASE AUTH...\n');

  try {
    // Paso 1: Obtener todos los usuarios de la tabla `usuarios`
    console.log('📋 Paso 1: Obteniendo usuarios de la tabla `usuarios`...');
    const { data: usuarios, error: usuariosError } = await supabase
      .from('usuarios')
      .select('id, correo, nombre, rol');

    if (usuariosError) {
      throw new Error(`Error obteniendo usuarios: ${usuariosError.message}`);
    }

    if (!usuarios || usuarios.length === 0) {
      console.log('⚠️  No hay usuarios en la tabla `usuarios`');
      return;
    }

    console.log(`✅ Se encontraron ${usuarios.length} usuarios\n`);

    // Paso 2: Para cada usuario, obtener su auth user y actualizar custom claims
    console.log('🔐 Paso 2: Sincronizando roles a Supabase Auth...\n');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const usuario of usuarios) {
      try {
        console.log(`  📧 ${usuario.correo}:`);

        // Obtener lista de usuarios de Supabase Auth
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

        if (authError) {
          throw new Error(`Error listando usuarios Auth: ${authError.message}`);
        }

        // Encontrar el usuario en Auth
        const authUser = authUsers?.users?.find(
          u => u.email?.toLowerCase() === usuario.correo.toLowerCase()
        );

        if (!authUser) {
          console.log(`     ⚠️  Usuario no encontrado en Supabase Auth — creando usuario...`);

          try {
            // Generar contraseña temporal fuerte
            const tempPassword = `Tmp!${Math.random().toString(36).slice(2)}${Date.now().toString().slice(-4)}`;

            const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
              email: usuario.correo,
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                role: usuario.rol,
                roles: [usuario.rol],
                full_name: usuario.nombre,
              }
            });

            if (createError) {
              throw createError;
            }

            console.log(`     ✅ Usuario creado en Auth (id: ${createdUser?.id || 'unknown'})`);
            successCount++;
            continue;
          } catch (createErr) {
            console.log(`     ❌ Error creando usuario: ${createErr.message || createErr}`);
            errorCount++;
            errors.push({ email: usuario.correo, error: createErr.message || String(createErr) });
            continue;
          }
        }

        // Actualizar custom claims
        const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
          authUser.id,
          {
            user_metadata: {
              ...(authUser.user_metadata || {}),
              role: usuario.rol,
              roles: [usuario.rol],
              full_name: usuario.nombre,
            }
          }
        );

        if (updateError) {
          throw updateError;
        }

        console.log(`     ✅ Rol actualizado a: ${usuario.rol}`);
        successCount++;
      } catch (err) {
        console.log(`     ❌ Error: ${err.message}`);
        errorCount++;
        errors.push({
          email: usuario.correo,
          error: err.message
        });
      }
    }

    // Paso 3: Resumen
    console.log(`\n📊 RESUMEN:\n`);
    console.log(`  ✅ Sincronizados correctamente: ${successCount}/${usuarios.length}`);
    console.log(`  ❌ Con errores: ${errorCount}/${usuarios.length}\n`);

    if (errors.length > 0) {
      console.log('⚠️  ERRORES ENCONTRADOS:\n');
      errors.forEach(err => {
        console.log(`  - ${err.email}: ${err.error}`);
      });
      console.log('');
    }

    // Paso 4: Verificar que los roles se sincronizaron
    console.log('🔍 Paso 3: Verificando sincronización...\n');

    const { data: verificacion, error: verError } = await supabase
      .from('usuarios')
      .select('id, correo, nombre, rol')
      .limit(5);

    if (!verError && verificacion) {
      console.log('✅ Primeros 5 usuarios sincronizados:');
      verificacion.forEach(u => {
        console.log(`  - ${u.correo}: ${u.rol}`);
      });
    }

    console.log('\n✅ SINCRONIZACIÓN COMPLETADA\n');
    process.exit(successCount === usuarios.length ? 0 : 1);

  } catch (error) {
    console.error('\n❌ ERROR EN SINCRONIZACIÓN:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Ejecutar
syncRolesToSupabaseAuth();
