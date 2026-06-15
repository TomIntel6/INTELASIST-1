#!/usr/bin/env node

/**
 * VERIFY_ADMIN_SETUP.mjs
 * 
 * Script para verificar que toda la configuración de Administración Avanzada está correcta
 * 
 * USO:
 * node VERIFY_ADMIN_SETUP.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const API_BASE = process.env.VITE_API_BASE_URL || 'https://intelasist.onrender.com';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERROR: Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, ...args) {
  console.log(color, ...args, COLORS.reset);
}

async function verifyAdminSetup() {
  console.log('\n' + COLORS.blue + '═══════════════════════════════════════════════════════' + COLORS.reset);
  console.log(COLORS.blue + 'VERIFICACIÓN COMPLETA DE ADMINISTRACIÓN AVANZADA' + COLORS.reset);
  console.log(COLORS.blue + '═══════════════════════════════════════════════════════' + COLORS.reset + '\n');

  let allPassed = true;

  // CHECK 1: Usuarios en tabla `usuarios`
  console.log(COLORS.blue + '1️⃣  Verificando tabla `usuarios`...' + COLORS.reset);
  try {
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, correo, nombre, rol');

    if (error) throw error;

    if (!usuarios || usuarios.length === 0) {
      log(COLORS.red, '   ❌ No hay usuarios en la tabla');
      allPassed = false;
    } else {
      log(COLORS.green, `   ✅ Se encontraron ${usuarios.length} usuarios:`);
      usuarios.forEach(u => {
        console.log(`      • ${u.correo} (${u.nombre}) - Rol: ${u.rol}`);
      });
    }
  } catch (err) {
    log(COLORS.red, `   ❌ Error: ${err.message}`);
    allPassed = false;
  }

  console.log('');

  // CHECK 2: Tabla user_activity_log
  console.log(COLORS.blue + '2️⃣  Verificando tabla `user_activity_log`...' + COLORS.reset);
  try {
    const { data, error, count } = await supabase
      .from('user_activity_log')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count === 0) {
      log(COLORS.yellow, '   ⚠️  Tabla vacía (pero existe)');
    } else {
      log(COLORS.green, `   ✅ ${count} registros`);
    }
  } catch (err) {
    log(COLORS.red, `   ❌ Error: ${err.message}`);
    allPassed = false;
  }

  console.log('');

  // CHECK 3: Tabla user_permissions
  console.log(COLORS.blue + '3️⃣  Verificando tabla `user_permissions`...' + COLORS.reset);
  try {
    const { data, error, count } = await supabase
      .from('user_permissions')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count === 0) {
      log(COLORS.yellow, '   ⚠️  Tabla vacía - NECESITA INICIALIZACIÓN');
      allPassed = false;
    } else {
      log(COLORS.green, `   ✅ ${count} registros`);
    }
  } catch (err) {
    log(COLORS.red, `   ❌ Error: ${err.message}`);
    allPassed = false;
  }

  console.log('');

  // CHECK 4: Tabla user_permission_details
  console.log(COLORS.blue + '4️⃣  Verificando tabla `user_permission_details`...' + COLORS.reset);
  try {
    const { data, error, count } = await supabase
      .from('user_permission_details')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    if (count === 0) {
      log(COLORS.yellow, '   ⚠️  Tabla vacía - NECESITA INICIALIZACIÓN');
      allPassed = false;
    } else {
      log(COLORS.green, `   ✅ ${count} permisos registrados`);
    }
  } catch (err) {
    log(COLORS.red, `   ❌ Error: ${err.message}`);
    allPassed = false;
  }

  console.log('');

  // CHECK 5: Endpoint /api/users/with-permissions
  console.log(COLORS.blue + '5️⃣  Verificando endpoint `/api/users/with-permissions`...' + COLORS.reset);
  try {
    const response = await fetch(`${API_BASE}/api/users/with-permissions`);
    if (!response.ok) {
      log(COLORS.red, `   ❌ Error ${response.status}: ${response.statusText}`);
      allPassed = false;
    } else {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        log(COLORS.green, `   ✅ Retorna ${data.length} usuarios con permisos`);
      } else {
        log(COLORS.yellow, '   ⚠️  Endpoint responde pero sin datos');
      }
    }
  } catch (err) {
    log(COLORS.red, `   ❌ Error: ${err.message}`);
    allPassed = false;
  }

  console.log('');

  // CHECK 6: Endpoint /api/users/with-modules
  console.log(COLORS.blue + '6️⃣  Verificando endpoint `/api/users/with-modules`...' + COLORS.reset);
  try {
    const response = await fetch(`${API_BASE}/api/users/with-modules`);
    if (!response.ok) {
      log(COLORS.red, `   ❌ Error ${response.status}: ${response.statusText}`);
      allPassed = false;
    } else {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        log(COLORS.green, `   ✅ Retorna ${data.length} usuarios con módulos`);
      } else {
        log(COLORS.yellow, '   ⚠️  Endpoint responde pero sin datos');
      }
    }
  } catch (err) {
    log(COLORS.red, `   ❌ Error: ${err.message}`);
    allPassed = false;
  }

  console.log('');

  // CHECK 7: Endpoint /api/users/statistics
  console.log(COLORS.blue + '7️⃣  Verificando endpoint `/api/users/statistics`...' + COLORS.reset);
  try {
    const response = await fetch(`${API_BASE}/api/users/statistics`);
    if (!response.ok) {
      log(COLORS.red, `   ❌ Error ${response.status}: ${response.statusText}`);
      allPassed = false;
    } else {
      const data = await response.json();
      if (data && typeof data === 'object') {
        log(COLORS.green, `   ✅ Endpoint funcionando`);
        console.log(`      • Total de usuarios: ${data.totalUsers || 0}`);
        console.log(`      • Usuarios activos: ${data.activeUsers || 0}`);
        console.log(`      • Usuarios suspendidos: ${data.suspendedUsers || 0}`);
      }
    }
  } catch (err) {
    log(COLORS.red, `   ❌ Error: ${err.message}`);
    allPassed = false;
  }

  console.log('');

  // RESUMEN FINAL
  console.log(COLORS.blue + '═══════════════════════════════════════════════════════' + COLORS.reset);
  if (allPassed) {
    log(COLORS.green, '✅ TODAS LAS VERIFICACIONES PASARON\n');
    console.log('Tu sistema de Administración Avanzada debería funcionar correctamente.');
    console.log('Si aún ves el menú vacío, recarga la página (Ctrl+F5) para limpiar la caché.\n');
  } else {
    log(COLORS.red, '❌ ALGUNAS VERIFICACIONES FALLARON\n');
    console.log('Pasos para corregir:');
    console.log('1. Ejecuta el script SQL: SYNC_ROLES_AND_PERMISSIONS.sql');
    console.log('2. Ejecuta el script de sincronización: node SYNC_SUPABASE_AUTH_ROLES.mjs');
    console.log('3. Vuelve a ejecutar este script para verificar.\n');
  }

  console.log(COLORS.blue + '═══════════════════════════════════════════════════════' + COLORS.reset + '\n');

  process.exit(allPassed ? 0 : 1);
}

verifyAdminSetup();
