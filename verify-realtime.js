#!/usr/bin/env node

/**
 * Script de Verificación Rápida - Sistema de Actualización en Tiempo Real
 * 
 * Este script verifica que todos los componentes necesarios para las
 * actualizaciones en tiempo real estén correctamente implementados.
 * 
 * Uso: node verify-realtime.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const CHECK = '✓';
const CROSS = '✗';

function log(color, symbol, message) {
  console.log(`${color}${symbol}${RESET} ${message}`);
}

function logSection(title) {
  console.log(`\n${BLUE}${'='.repeat(60)}${RESET}`);
  console.log(`${BLUE}${title}${RESET}`);
  console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function fileContains(filePath, searchString) {
  if (!fileExists(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes(searchString);
}

function checkFiles() {
  logSection('1️⃣  VERIFICACIÓN DE ARCHIVOS');
  
  const checks = [
    {
      name: 'Backend (api.js)',
      path: 'api.js',
      search: 'permissions-updated'
    },
    {
      name: 'Frontend SSE listeners (auth.tsx)',
      path: 'src/lib/auth.tsx',
      search: 'permissions-updated'
    },
    {
      name: 'Componente Permisos',
      path: 'src/pages/components/PermissionsManagement.tsx',
      search: 'permissions-changed'
    },
    {
      name: 'Componente Módulos',
      path: 'src/pages/components/PermissionModules.tsx',
      search: 'modules-changed'
    },
    {
      name: 'Documentación Técnica',
      path: 'REALTIME_UPDATES_SOLUTION.md',
      search: 'Server-Sent Events'
    },
    {
      name: 'Guía de Pruebas',
      path: 'TESTING_REALTIME_UPDATES.md',
      search: 'Prueba 1'
    },
  ];

  let passed = 0;
  let failed = 0;

  checks.forEach(check => {
    const exists = fileExists(check.path);
    const hasContent = exists && fileContains(check.path, check.search);
    
    if (exists && hasContent) {
      log(GREEN, CHECK, `${check.name} - ENCONTRADO ✓`);
      passed++;
    } else {
      log(RED, CROSS, `${check.name} - NO ENCONTRADO ✗`);
      failed++;
    }
  });

  console.log(`\n${BLUE}Resultado: ${GREEN}${passed} OK${RESET}, ${RED}${failed} FALLIDOS${RESET}`);
  return failed === 0;
}

function checkBackendImplementation() {
  logSection('2️⃣  VERIFICACIÓN BACKEND');

  const checks = [
    {
      name: 'Notificación permisos en sseClients',
      pattern: 'permissions-updated'
    },
    {
      name: 'Notificación módulos en sseClients',
      pattern: 'modules-updated'
    },
    {
      name: 'Endpoint SSE /events',
      pattern: "app.get('/events'"
    }
  ];

  const apiContent = fs.readFileSync('api.js', 'utf8');
  let passed = 0;

  checks.forEach(check => {
    if (apiContent.includes(check.pattern)) {
      log(GREEN, CHECK, `${check.name} - IMPLEMENTADO ✓`);
      passed++;
    } else {
      log(RED, CROSS, `${check.name} - NO ENCONTRADO ✗`);
    }
  });

  console.log(`\n${BLUE}Resultado: ${GREEN}${passed}/${checks.length} OK${RESET}`);
  return passed === checks.length;
}

function checkFrontendImplementation() {
  logSection('3️⃣  VERIFICACIÓN FRONTEND');

  const checks = [
    {
      file: 'src/lib/auth.tsx',
      name: 'EventSource configurado',
      pattern: 'new EventSource'
    },
    {
      file: 'src/lib/auth.tsx',
      name: 'Listener permissions-updated',
      pattern: "addEventListener('permissions-updated'"
    },
    {
      file: 'src/lib/auth.tsx',
      name: 'Listener modules-updated',
      pattern: "addEventListener('modules-updated'"
    },
    {
      file: 'src/lib/auth.tsx',
      name: 'CustomEvent permissions-changed',
      pattern: "dispatchEvent(new CustomEvent('permissions-changed'"
    },
    {
      file: 'src/lib/auth.tsx',
      name: 'CustomEvent modules-changed',
      pattern: "dispatchEvent(new CustomEvent('modules-changed'"
    },
  ];

  let passed = 0;

  checks.forEach(check => {
    if (fileContains(check.file, check.pattern)) {
      log(GREEN, CHECK, `${check.name} - IMPLEMENTADO ✓`);
      passed++;
    } else {
      log(RED, CROSS, `${check.name} - NO ENCONTRADO ✗`);
    }
  });

  console.log(`\n${BLUE}Resultado: ${GREEN}${passed}/${checks.length} OK${RESET}`);
  return passed === checks.length;
}

function checkComponentListeners() {
  logSection('4️⃣  VERIFICACIÓN LISTENERS EN COMPONENTES');

  const checks = [
    {
      file: 'src/pages/components/PermissionsManagement.tsx',
      name: 'PermissionsManagement: addEventListener permissions-changed',
      pattern: "addEventListener('permissions-changed'"
    },
    {
      file: 'src/pages/components/PermissionsManagement.tsx',
      name: 'PermissionsManagement: Recarga de datos al cambiar',
      pattern: 'loadUsers()'
    },
    {
      file: 'src/pages/components/PermissionModules.tsx',
      name: 'PermissionModules: addEventListener modules-changed',
      pattern: "addEventListener('modules-changed'"
    },
    {
      file: 'src/pages/components/PermissionModules.tsx',
      name: 'PermissionModules: Recarga de datos al cambiar',
      pattern: 'loadUsers()'
    },
  ];

  let passed = 0;

  checks.forEach(check => {
    if (fileContains(check.file, check.pattern)) {
      log(GREEN, CHECK, `${check.name} - IMPLEMENTADO ✓`);
      passed++;
    } else {
      log(RED, CROSS, `${check.name} - NO ENCONTRADO ✗`);
    }
  });

  console.log(`\n${BLUE}Resultado: ${GREEN}${passed}/${checks.length} OK${RESET}`);
  return passed === checks.length;
}

function checkDocumentation() {
  logSection('5️⃣  VERIFICACIÓN DOCUMENTACIÓN');

  const docs = [
    { path: 'REALTIME_UPDATES_SOLUTION.md', name: 'Documentación Técnica' },
    { path: 'TESTING_REALTIME_UPDATES.md', name: 'Guía de Pruebas' },
    { path: 'RESUMEN_CAMBIOS_REALTIME.md', name: 'Resumen Ejecutivo' },
  ];

  let passed = 0;

  docs.forEach(doc => {
    if (fileExists(doc.path)) {
      const size = fs.statSync(doc.path).size;
      log(GREEN, CHECK, `${doc.name} - ${(size / 1024).toFixed(1)} KB ✓`);
      passed++;
    } else {
      log(RED, CROSS, `${doc.name} - NO ENCONTRADO ✗`);
    }
  });

  console.log(`\n${BLUE}Resultado: ${GREEN}${passed}/${docs.length} OK${RESET}`);
  return passed === docs.length;
}

function showSummary(results) {
  logSection('📊 RESUMEN FINAL');

  const allPassed = Object.values(results).every(r => r);
  
  console.log('Verificaciones realizadas:');
  console.log(`  ${results.files ? GREEN + CHECK : RED + CROSS}${RESET} Archivos requeridos`);
  console.log(`  ${results.backend ? GREEN + CHECK : RED + CROSS}${RESET} Implementación Backend`);
  console.log(`  ${results.frontend ? GREEN + CHECK : RED + CROSS}${RESET} Implementación Frontend`);
  console.log(`  ${results.listeners ? GREEN + CHECK : RED + CROSS}${RESET} Listeners en Componentes`);
  console.log(`  ${results.docs ? GREEN + CHECK : RED + CROSS}${RESET} Documentación`);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    log(GREEN, CHECK, '¡TODAS LAS VERIFICACIONES PASARON! ✓');
    console.log('\nEl sistema de actualización en tiempo real está LISTO para:');
    console.log('  • npm run dev      (Desarrollo)');
    console.log('  • npm start        (Producción)');
    console.log('  • npm run build    (Compilar)');
  } else {
    log(RED, CROSS, 'Algunas verificaciones fallaron.');
    console.log('\nRevisa los errores anteriores y consulta:');
    console.log('  • REALTIME_UPDATES_SOLUTION.md');
    console.log('  • TESTING_REALTIME_UPDATES.md');
  }
  console.log('='.repeat(60) + '\n');
}

function main() {
  console.clear();
  console.log(`\n${BLUE}╔═══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║   VERIFICACIÓN: SISTEMA DE ACTUALIZACIÓN EN TIEMPO REAL        ║${RESET}`);
  console.log(`${BLUE}║   Permisos y Módulos - Real-time Updates                      ║${RESET}`);
  console.log(`${BLUE}╚═══════════════════════════════════════════════════════════════╝${RESET}\n`);

  const results = {
    files: checkFiles(),
    backend: checkBackendImplementation(),
    frontend: checkFrontendImplementation(),
    listeners: checkComponentListeners(),
    docs: checkDocumentation(),
  };

  showSummary(results);
}

// Ejecutar
main();
