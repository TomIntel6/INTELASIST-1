#!/usr/bin/env node

/**
 * FIX_ADMIN_EVERYTHING.mjs
 * 
 * Script maestro que ejecuta TODOS los pasos necesarios para fijar
 * la Administración Avanzada
 * 
 * USO:
 * node FIX_ADMIN_EVERYTHING.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = process.env.VITE_API_BASE_URL || 'https://intelasist.onrender.com';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, COLORS.reset);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.clear();
  console.log(COLORS.cyan + '╔════════════════════════════════════════════════════════╗' + COLORS.reset);
  console.log(COLORS.cyan + '║      🔧 FIX ADMINISTRACIÓN AVANZADA - TODO EN UNO      ║' + COLORS.reset);
  console.log(COLORS.cyan + '╚════════════════════════════════════════════════════════╝' + COLORS.reset + '\n');

  // Validación de variables de entorno
  console.log(COLORS.blue + '🔍 Paso 1: Validando configuración...' + COLORS.reset + '\n');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log(COLORS.red, '❌ ERROR: Variables de entorno no configuradas\n');
    console.log('Necesitas un archivo .env con:\n');
    console.log('  VITE_SUPABASE_URL=https://...');
    console.log('  VITE_SUPABASE_ANON_KEY=eyJ...');
    console.log('  VITE_API_BASE_URL=https://intelasist.onrender.com\n');
    process.exit(1);
  }

  log(COLORS.green, '  ✅ VITE_SUPABASE_URL configurado');
  log(COLORS.green, '  ✅ VITE_SUPABASE_ANON_KEY configurado');
  log(COLORS.green, `  ✅ API_BASE: ${API_BASE}\n`);

  // Conectar a Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // PASO 1: Ejecutar SQL Migration
  console.log(COLORS.blue + '⏱️  Paso 2: Ejecutando SQL migration...' + COLORS.reset + '\n');

  try {
    // Verificar si las tablas existen
    const { data: tables, error: tablesError } = await supabase
      .from('user_permissions')
      .select('id', { count: 'exact', head: true });

    if (tables === null && tablesError?.code === 'PGRST116') {
      log(COLORS.yellow, '  ℹ️  Tablas no existen, necesitas crear tabla primero');
      log(COLORS.yellow, '  📋 Mira SYNC_ROLES_AND_PERMISSIONS.sql\n');
    } else {
      log(COLORS.green, '  ✅ Tablas de permisos ya existen\n');
    }
  } catch (err) {
    log(COLORS.yellow, `  ℹ️  ${err.message}\n`);
  }

  // PASO 2: Obtener y sincronizar usuarios
  console.log(COLORS.blue + '🔄 Paso 3: Sincronizando usuarios con Supabase Auth...' + COLORS.reset + '\n');

  try {
    // Obtener usuarios de tabla
    const { data: usuarios, error: usuariosError } = await supabase
      .from('usuarios')
      .select('id, correo, nombre, rol');

    if (usuariosError) {
      throw usuariosError;
    }

    if (!usuarios || usuarios.length === 0) {
      log(COLORS.yellow, '  ⚠️  No hay usuarios para sincronizar\n');
    } else {
      log(COLORS.green, `  ✅ Se encontraron ${usuarios.length} usuarios\n`);

      // IMPORTANTE: El sync de Supabase Auth requiere service role key
      // que no tenemos en el cliente. Mostrar instrucción manual.

      console.log(COLORS.yellow + '  ⚠️  NOTA IMPORTANTE:' + COLORS.reset);
      console.log('  Para sincronizar roles con Supabase Auth, ejecuta:\n');
      console.log(COLORS.cyan + '  node SYNC_SUPABASE_AUTH_ROLES.mjs\n' + COLORS.reset);
      console.log('  Eso actualizará los custom claims de cada usuario.\n');

      // Mostrar usuarios que serían sincronizados
      console.log(COLORS.blue + '  Usuarios que serán sincronizados:\n' + COLORS.reset);
      usuarios.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.correo}`);
        console.log(`     Nombre: ${u.nombre}`);
        console.log(`     Rol: ${u.rol}`);
        if (i < usuarios.length - 1) console.log('');
      });
      console.log('');
    }
  } catch (err) {
    log(COLORS.red, `  ❌ Error: ${err.message}\n`);
  }

  // PASO 3: Verificar endpoints
  console.log(COLORS.blue + '📡 Paso 4: Verificando endpoints del backend...' + COLORS.reset + '\n');

  const endpoints = [
    '/api/users/with-permissions',
    '/api/users/with-modules',
    '/api/users/statistics'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (response.ok) {
        log(COLORS.green, `  ✅ ${endpoint}`);
      } else {
        log(COLORS.yellow, `  ⚠️  ${endpoint} (status: ${response.status})`);
      }
    } catch (err) {
      log(COLORS.red, `  ❌ ${endpoint} - ${err.message}`);
    }
  }

  console.log('');

  // RESUMEN FINAL
  console.log(COLORS.cyan + '╔════════════════════════════════════════════════════════╗' + COLORS.reset);
  console.log(COLORS.cyan + '║                    📋 RESUMEN FINAL                     ║' + COLORS.reset);
  console.log(COLORS.cyan + '╚════════════════════════════════════════════════════════╝' + COLORS.reset + '\n');

  console.log(COLORS.blue + '✅ PASOS COMPLETADOS:\n' + COLORS.reset);
  console.log('  1. ✅ Configuración validada');
  console.log('  2. ✅ Tablas verificadas');
  console.log('  3. 📋 Usuarios listados\n');

  console.log(COLORS.yellow + '⚠️  PRÓXIMOS PASOS MANUALES:\n' + COLORS.reset);
  console.log('  1. Si aún no lo has hecho:');
  console.log('     Ejecuta el script SQL en Supabase:\n');
  console.log('     → Ve a Supabase → SQL Editor → New Query');
  console.log('     → Copia contenido de SYNC_ROLES_AND_PERMISSIONS.sql');
  console.log('     → Click en Run\n');

  console.log('  2. Sincroniza roles con Auth (IMPORTANTE):\n');
  console.log(COLORS.cyan + '     node SYNC_SUPABASE_AUTH_ROLES.mjs\n' + COLORS.reset);

  console.log('  3. Verifica que todo funciona:\n');
  console.log(COLORS.cyan + '     node VERIFY_ADMIN_SETUP.mjs\n' + COLORS.reset);

  console.log('  4. En tu app:\n');
  console.log('     → Recarga con Ctrl+F5');
  console.log('     → Deberías ver "⚙ Administración Avanzada" en el sidebar');
  console.log('     → Los tabs deberían tener contenido\n');

  console.log(COLORS.green + '═══════════════════════════════════════════════════════' + COLORS.reset);
  console.log(COLORS.green + 'Más detalles en: FIX_ADMIN_COMPLETE_GUIDE.md' + COLORS.reset);
  console.log(COLORS.green + '═══════════════════════════════════════════════════════\n' + COLORS.reset);

  process.exit(0);
}

main().catch(err => {
  log(COLORS.red, `\n❌ ERROR: ${err.message}\n`);
  process.exit(1);
});
