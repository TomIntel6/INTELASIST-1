# 📋 ANÁLISIS: Errores 404 en Administración Avanzada

**Fecha:** 2026-06-14  
**Estado:** Análisis (sin implementación aún)  
**Usuario:** José Rodríguez  

---

## 🔴 PROBLEMA DETECTADO

El módulo de Administración Avanzada presenta **3 errores 404** que impiden el funcionamiento de varios componentes:

```
❌ 404: GET /api/users/statistics
❌ 404: GET /api/users/with-permissions
❌ 404: Tabla user_permissions no existe / acceso denegado
```

---

## 🔍 ANÁLISIS DETALLADO

### 1️⃣ Estado de los Endpoints en api.js

| Endpoint | Código | Estado | Línea |
|----------|--------|--------|-------|
| GET /api/users/with-activity | ✅ Existe | 1690 | Implementado |
| GET /api/users | ✅ Existe | 1731 | Implementado |
| GET /api/users/:userId | ✅ Existe | 1771 | Implementado |
| **GET /api/users/statistics** | ✅ Existe | 1837 | **Implementado pero DA 404** |
| **GET /api/users/with-permissions** | ✅ Existe | 1867 | **Implementado pero DA 404** |
| GET /api/users/with-modules | ✅ Existe | 1911 | Implementado |
| PUT /api/users/:userId/permissions | ✅ Existe | ? | Implementado |
| PUT /api/users/:userId/modules | ✅ Existe | ? | Implementado |
| GET /api/health/auth | ✅ Existe | ? | Implementado |

**Conclusión:** Los endpoints existen en código pero retornan 404. **Esto significa que la solicitud no llega al endpoint.**

---

### 2️⃣ Problema Raíz Identificado

#### ⚠️ CAUSA 1: Mismatch entre `auth.users` y tabla `usuarios`

```
Tablas en Supabase (según usuario):
├─ usuarios          (tabla existente)
├─ reports
├─ report_updates
├─ online_presence
└─ failed_reports

Tablas que DEBERÍA haber (según migración):
├─ user_permissions        ← ¿EXISTE?
├─ user_permission_details ← ¿EXISTE?
├─ audit_logs             ← Probablemente existe
├─ deleted_reports        ← Probablemente existe
└─ user_activity_log      ← ¿EXISTE?

Estructura esperada del endpoint /api/users/statistics:
├─ Lee de tabla: usuarios
├─ Lee de tabla: user_activity_log  ← PROBLEMA
└─ Lee de tabla: reports
```

**El problema:** El código intenta hacer JOIN entre:
- `usuarios` (tabla con estructura propia)
- `user_activity_log` (tabla que referencia `auth.users.id`)

Pero `usuarios.id` ≠ `auth.users.id`

---

#### ⚠️ CAUSA 2: Tabla `usuarios` vs `auth.users`

El sistema tiene **DOS estructuras de usuarios:**

```
Estructura 1: auth.users (Supabase Auth System)
├─ id (UUID)
├─ email
├─ user_metadata (role, name, etc)
└─ Funciona con RLS policies

Estructura 2: usuarios (Tabla PostgreSQL custom)
├─ id (UUID)
├─ correo
├─ nombre
├─ rol
└─ (independiente de auth.users)
```

**El problema arquitectónico:**
- La migración 20260614_advanced_permissions_system.sql crea tablas que referencia `auth.users.id`
- Pero el código backend intenta hacer queries usando `usuarios.id`
- No hay way de mapear entre ellos

---

#### ⚠️ CAUSA 3: La migración NO se ejecutó

Aunque la migración existe, probablemente NO fue ejecutada en Supabase:

```
Migraciones encontradas:
✅ 20260523131915_create_reports_system.sql
✅ 20260525120000_add_coverage_to_reports.sql
✅ 20260527_add_evidence_url_to_reports.sql
❓ 20260614_add_modules_access.sql
❓ 20260614_advanced_permissions_system.sql  ← ¿EJECUTADA?
```

Si la migración NO fue ejecutada:
- Las tablas `user_permissions`, `user_permission_details`, `user_activity_log` **NO EXISTEN**
- El endpoint intenta hacer queries a tablas fantasma
- PostgreSQL retorna error (probablemente 500, no 404)

---

### 3️⃣ Componentes Afectados (Frontend)

#### 🔴 **AdminOverview.tsx** (Tab: Resumen)

```typescript
// Línea 35
const response = await fetch('https://intelasist.onrender.com/api/users/statistics')
// ❌ 404 NOT FOUND → Componente se queda en loading infinito
```

**Qué necesita:**
- Estadísticas del sistema (totalUsers, activeUsers, suspendedUsers, totalReports)
- Actualmente no puede cargar

---

#### 🔴 **PermissionsManagement.tsx** (Tab: Permisos)

```typescript
// Línea 40
const response = await fetch('https://intelasist.onrender.com/api/users/with-permissions')
// ❌ 404 NOT FOUND → Lista de usuarios no carga
```

**Qué necesita:**
- Lista de usuarios con sus permisos granulares
- Permite asignar: create_reports, view_reports, delete_users, manage_permissions, etc.

**Interfaz esperada:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "Usuario 1",
    "role": "Admin",
    "permissions": {
      "create_reports": true,
      "view_reports": true,
      "delete_users": false
    }
  }
]
```

---

#### 🟡 **PermissionModules.tsx** (Tab: Módulos)

```typescript
// Línea 38
const response = await fetch('https://intelasist.onrender.com/api/users/with-modules')
// ❓ Probablemente 404 también
```

**Qué necesita:**
- Lista de usuarios con módulos accesibles
- Módulos: reports, evidence, updates, users, system, admin
- Al guardar: `PUT /api/users/:userId/modules`

---

#### 🟡 **SystemHealth.tsx** (Tab: Salud)

```typescript
// Línea 51 (aproximado)
const stats = await UserManagementService.getActivityStatistics()
// → Llama a /api/users/statistics internamente
// ❌ 404 → El check "Servicio de Autenticación" falla
```

---

#### 🟡 **AdvancedUserManagement.tsx** (Tab: Usuarios)

```typescript
// Usa UserManagementService
await UserManagementService.getAllUsersWithActivity()  // GET /api/users/with-activity
await UserManagementService.suspendUser()             // Usa Supabase user_activity_log
await UserManagementService.reactivateUser()          // Usa Supabase user_activity_log
```

**Problemas:**
- `getAllUsersWithActivity()` intenta leer de `user_activity_log` que NO existe
- `suspendUser()` intenta escribir a `user_activity_log` que NO existe

---

### 4️⃣ Rutas/Endpoints que Faltan

| Ruta | Implementada | Funciona | Problema |
|------|--------------|----------|----------|
| GET /api/users/with-activity | ✅ Sí (línea 1691) | ❓ Depende de user_activity_log | Tabla no existe |
| GET /api/users | ✅ Sí (línea 1731) | ❓ Depende de usuarios | OK |
| GET /api/users/:userId | ✅ Sí (línea 1771) | ❓ Depende de user_activity_log | Tabla no existe |
| **GET /api/users/statistics** | ✅ Sí (línea 1837) | ❌ **404** | Tabla user_activity_log no existe |
| **GET /api/users/with-permissions** | ✅ Sí (línea 1867) | ❌ **404** | Tabla user_permission_details no existe |
| GET /api/users/with-modules | ✅ Sí (línea 1911) | ❓ Depende de user_permissions | Tabla no existe |
| PUT /api/users/:userId/permissions | ✅ Sí | ❓ Depende de user_permissions | Tabla no existe |
| PUT /api/users/:userId/modules | ✅ Sí | ❓ Depende de user_permissions | Tabla no existe |
| GET /api/health/auth | ✅ Sí | ✅ Probable que funcione | No usa tablas nuevas |

**Conclusión:** Todos los endpoints que usan las tablas nuevas fallan porque esas tablas no existen.

---

### 5️⃣ Tablas SQL que Faltan Crear

#### Necesarias (según código):

| Tabla | Razón | Status |
|-------|-------|--------|
| `user_activity_log` | Almacenar actividad de usuarios, suspensiones | ❓ Migración existe pero NO ejecutada |
| `user_permissions` | Registro maestro de permisos por usuario | ❓ Migración existe pero NO ejecutada |
| `user_permission_details` | Detalles individuales de cada permiso | ❓ Migración existe pero NO ejecutada |
| `user_permissions.modules_access` | Campo JSONB para módulos | ✅ Migración 20260614_add_modules_access.sql |

#### Tablas que existen:
- ✅ `usuarios`
- ✅ `reports`
- ✅ `report_updates`
- ✅ `online_presence`
- ✅ `failed_reports`
- ✅ `audit_logs` (probablemente)
- ✅ `deleted_reports` (probablemente)

---

### 6️⃣ Problema Arquitectónico: usuarios vs auth.users

**Decisión crítica a tomar:**

#### Opción A: Usar `auth.users` directamente
```
Ventajas:
✅ Nativo de Supabase
✅ Integrado con auth system
✅ Mejor RLS policies
✅ Metadata ya disponible

Desventajas:
❌ Requiere refactor de toda la tabla usuarios
❌ Cambio mayor en el sistema
❌ Alto riesgo de breaking changes
```

#### Opción B: Crear mapping entre usuarios.id ↔ auth.users.id
```
Ventajas:
✅ Mantiene código existente
✅ Menor riesgo
✅ Cambios localizados

Desventajas:
❌ Compleja la sincronización
❌ Queries más complicadas
❌ Mantenimiento futuro difícil
```

#### ⭐ Opción C: Reutilizar tabla `usuarios` directamente (RECOMENDADA)
```
Ventajas:
✅ Máxima compatibilidad
✅ Cambios mínimos
✅ Bajo riesgo
✅ Más simple de mantener

Desventajas:
❌ Menos integración con Supabase auth
❌ Requiere cambiar migraciones

IMPLEMENTACIÓN:
- Modificar las migraciones para usar usuarios.id en lugar de auth.users.id
- Las foreign keys apuntarían a tabla usuarios, no auth.users
- RLS policies se basarían en auth.uid() vs usuarios.id mapping
```

---

## 📊 MATRIZ DE IMPACTO

### Archivos Frontend Afectados

| Archivo | Componente | Impacto | Gravedad |
|---------|-----------|--------|----------|
| AdminOverview.tsx | Tab Resumen | ❌ No carga | 🔴 CRÍTICO |
| PermissionsManagement.tsx | Tab Permisos | ❌ No carga | 🔴 CRÍTICO |
| PermissionModules.tsx | Tab Módulos | ❌ No carga | 🔴 CRÍTICO |
| AdvancedUserManagement.tsx | Tab Usuarios | ❌ No carga | 🔴 CRÍTICO |
| SystemHealth.tsx | Tab Salud | ⚠️ Carga parcial | 🟡 MAYOR |
| AdminDashboard.tsx | Contenedor | ⚠️ Carga con errores | 🟡 MAYOR |

---

### Archivos Backend Afectados

| Archivo | Endpoint | Dependencia | Status |
|---------|----------|------------|--------|
| api.js | GET /api/users/statistics | user_activity_log | ❌ Falso |
| api.js | GET /api/users/with-permissions | user_permission_details | ❌ Falso |
| api.js | GET /api/users/with-modules | user_permissions | ❌ Falso |
| api.js | PUT /api/users/:userId/permissions | user_permissions | ❌ Falso |
| api.js | PUT /api/users/:userId/modules | user_permissions | ❌ Falso |
| api.js | GET /api/users/with-activity | user_activity_log | ❌ Falso |

---

### Migraciones SQL Necesarias

| Migración | Creada | Ejecutada | Requiere Cambios |
|-----------|--------|-----------|------------------|
| 20260614_advanced_permissions_system.sql | ✅ Sí | ❓ No | 🔴 **SÍ** (usar usuarios.id) |
| 20260614_add_modules_access.sql | ✅ Sí | ❓ No | ✅ OK |

---

## ⚠️ RIESGOS DETECTADOS

### 1️⃣ **Riesgo Alto: Inconsistencia de Keys**
```
Problema: 
- auth.users.id (UUID de Supabase Auth)
- usuarios.id (UUID de tabla custom)
- Podrían no coincidir

Impacto: Queries sin resultados, datos huérfanos
Probabilidad: ALTA
Severidad: CRÍTICA
```

### 2️⃣ **Riesgo Alto: RLS Policies Incorrectas**
```
Problema:
- Las RLS policies en la migración usan auth.uid() vs auth.users
- Pero el sistema real usa usuarios.id

Impacto: Acceso denegado a datos legítimos
Probabilidad: ALTA
Severidad: CRÍTICA
```

### 3️⃣ **Riesgo Medio: Migraciones No Ejecutadas**
```
Problema:
- Migraciones existen pero podrían NO haberse ejecutado
- No hay confirmación visual

Impacto: Tablas no existen, queries fallan
Probabilidad: MEDIA
Severidad: CRÍTICA
```

### 4️⃣ **Riesgo Medio: Query Performance**
```
Problema:
- Endpoints usan múltiples queries sin batch
- Correlación entre tablas compleja

Impacto: Queries lentas, N+1 problem
Probabilidad: MEDIA
Severidad: MEDIA
```

### 5️⃣ **Riesgo Bajo: CORS Headers**
```
Problema:
- Endpoints dev requieren CORS
- URL hardcodeada: https://intelasist.onrender.com

Impacto: CORS errors en desarrollo
Probabilidad: BAJA
Severidad: MENOR
```

---

## 🔧 RECOMENDACIONES

### Paso 1: Investigación Inmediata
```
DEBE HACER:
1. ✅ Verificar si migraciones 202606114_*.sql fueron ejecutadas
   → Supabase Dashboard → SQL Editor → Ver history
   
2. ✅ Verificar si tablas existen
   → Supabase Dashboard → Database → Ver todas las tablas
   → Buscar: user_permissions, user_activity_log, user_permission_details
   
3. ✅ Verificar mapping entre usuarios.id y auth.users.id
   → SELECT COUNT(*) FROM usuarios
   → SELECT COUNT(*) FROM auth.users
   → ¿Son el mismo número? ¿Coinciden los IDs?
```

### Paso 2: Decisión Arquitectónica

**Recomendación:** OPCIÓN C (Reutilizar tabla `usuarios`)

**Por qué:**
- Menor riesgo de breaking changes
- Mantiene compatibilidad con código existente
- Sistema más cohesivo
- Más fácil de mantener

**Implica:**
- Modificar migraciones para usar `usuarios.id` en lugar de `auth.users.id`
- Adaptar RLS policies
- Mantener foreign keys consistentes

### Paso 3: Plan de Implementación

Si se elige Opción C:

1. **Crear nueva migración** que:
   - Altere las tablas existentes (si existen) o
   - Cree nuevas tablas con estructura correcta usando `usuarios.id`

2. **Validar queries** en api.js para asegurar JOINs correctos

3. **Actualizar RLS policies** para usar `auth.uid()` → `usuarios.id` mapping

4. **Testear endpoints** después de migración

---

## 📋 CONCLUSIÓN

| Aspecto | Hallazgo |
|---------|----------|
| **Causa de 404** | Tablas no existen o migraciones no ejecutadas |
| **Mejor solución** | Opción C: Reutilizar usuarios.id en lugar de auth.users.id |
| **Componentes afectados** | 6 tabs del AdminDashboard |
| **Tablas faltantes** | user_activity_log, user_permissions, user_permission_details |
| **Riesgo general** | 🔴 CRÍTICO |
| **Tiempo estimado** | 2-3 horas de implementación |

---

## ✋ SIGUIENTE PASO

**Esperar aprobación del usuario para proceder con la implementación según Opción C.**

¿Deseas que proceda con el análisis de código específico para cada endpoint?
