# 🔍 AUDITORÍA COMPLETA DEL SISTEMA - DIAGNÓSTICO DETALLADO

## RESUMEN EJECUTIVO

Se han identificado **2 problemas raíz** afectando dos áreas diferentes del sistema:

| Problema | Síntoma | Causa Raíz | Archivo | Línea |
|----------|---------|-----------|---------|-------|
| **1. Módulos no persisten** | Desmarcar módulos → guardar → recargar → vuelven a aparecer marcados | GET endpoint devuelve objeto `modules` incompleto (solo claves con valores custom) | `api.js` | 2172 |
| **2. Inconsistencia en reportes** | KPI muestra 12.25 informes/usuario pero tabla muestra 0 | GET endpoint con-activity usa subquery que no matchea `created_by` correctamente | `api.js` | 1975 |

---

# PROBLEMA 1: MÓDULOS Y PERMISOS NO PERSISTEN CUANDO SE ESTABLECEN A `false`

## 1. Flujo Actual (Problemático)

```
Usuario entra a Admin → Módulos
    ↓
Frontend carga: GET /api/users/with-modules
    ↓
Backend devuelve: { userId: "123", modules: { "REPORTES": false, "USUARIOS": true } }
    ↓
Frontend renderiza: Checkbox "REPORTES" = unchecked, "USUARIOS" = checked ✅
    ↓
Usuario hace click "Guardar"
    ↓
Frontend envía: PUT /api/users/:userId/modules
    Body: { modules: { "REPORTES": false, "USUARIOS": true, "AUDITORÍA": false } }
    ↓
Backend GUARDA en DB correctamente ✅
    ↓
Usuario recarga página (F5)
    ↓
Frontend: GET /api/users/with-modules NUEVAMENTE
    ↓
Backend devuelve: { modules: {} } ← OBJETO VACÍO O INCOMPLETO
    ↓
Frontend: ALL CHECKBOXES undefined → renderiza con || false
    ↓
Usuario ve: TODOS LOS MÓDULOS DESMARCADOS (o muestra valores por defecto del rol)
    ↗ ❌ BUG: Permisos guardados como FALSE pero se pierden
```

## 2. Análisis Técnico Detallado

### 2.1 Endpoint GET /api/users/with-modules (PROBLEMÁTICO)

**Archivo**: `api.js` líneas 2172-2220

**Código Actual**:
```javascript
// ❌ ACTUAL - PROBLEMÁTICO
app.get('/api/users/with-modules', async (req, res) => {
  const usersResult = await pool.query(`
    SELECT 
      u.id,
      u.correo as email,
      u.nombre as userName,
      u.rol as role,
      COALESCE(up.modules_access, '{}'::jsonb) as modules_access  // ← PROBLEMA AQUÍ
    FROM usuarios u
    LEFT JOIN user_permissions up ON up.user_id = u.id::text
    ORDER BY u.nombre ASC
  `)

  const usersWithModules = usersResult.rows.map(user => ({
    userId: user.id,
    email: user.email,
    userName: user.userName,
    role: user.role,
    modules: user.modules_access || {},  // ← SI modules_access es NULL o {}, devolverá {}
  }))

  res.json(usersWithModules)
})
```

**El Problema Exacto**:

1. La query `COALESCE(up.modules_access, '{}'::jsonb)` devuelve:
   - Si el usuario SÍ tiene permisos: `{ "REPORTES": false, "USUARIOS": true }`
   - Si el usuario NO tiene permisos: `{}` (objeto vacío)

2. El mapeo posterior `modules: user.modules_access || {}` simplemente pasa ese objeto

3. **Cuando módulos se guardan como TODOS FALSE o INCLUYEN FALSE valores**:
   - En la DB se almacena correctamente: `{"REPORTES": false, "USUARIOS": false}`
   - PERO cuando se serializa/deserializa JSON, los valores FALSE están presentes
   - **El verdadero problema**: Si FALTA un módulo del objeto (por cualquier razón), al renderizar el frontend, ese módulo no aparecerá
   - O si el objeto está vacío, el frontend NO sabe cuántos módulos debería haber

### 2.2 Endpoint PUT /api/users/:userId/modules (CORRECTO)

**Archivo**: `api.js` líneas 2470-2530

**Código**:
```javascript
// ✅ CORRECTO - GUARDA BIEN
app.put('/api/users/:userId/modules', async (req, res) => {
  const modules = req.body?.modules || {}  // ← Recibe objeto completo

  // Actualiza en JSON
  const modulesJson = JSON.stringify(modules)
  await pool.query(
    'UPDATE user_permissions SET modules_access = $1, updated_at = NOW() WHERE id = $2',
    [modulesJson, permId]
  )
  // ✅ JSON se serializa correctamente, incluidos valores FALSE
})
```

**Veredicto**: ✅ Funciona correctamente, guarda todos los valores incluyendo FALSE

### 2.3 Frontend Component (CORRECTO)

**Archivo**: `src/pages/components/PermissionModules.tsx` líneas 108-165

**Código**:
```javascript
const loadUsers = React.useCallback(async () => {
  const response = await fetch(`${API_BASE}/api/users/with-modules`)
  const usersData = await response.json()
  setUsers(usersData)  // ← Sets users con modules incompleto
}, [])

const handleModuleToggle = (userId, module) => {
  setUsers(prev =>
    prev.map(u =>
      u.userId === userId 
        ? { ...u, modules: { ...u.modules, [module]: !u.modules[module] } }
        : u
    )
  )
}

// Renderiza checkboxes
<Checkbox
  checked={user.modules[moduleKey] || false}  // ← Si modules está vacío, TODO es false
  onCheckedChange={() => onModuleToggle(moduleKey)}
/>
```

**Veredicto**: ✅ Frontend funciona correctamente, pero recibe datos incompletos del backend

### 2.4 Comparación con Fix de Permisos

Recuerda que hace poco se FIJÓ el problema de permisos similar en:
- **Archivo**: `api.js` líneas 2119-2167 (GET /api/users/with-permissions)
- **Solución aplicada**: Se modificó para devolver TODAS las claves de permisos inicializadas a false, luego se sobrescriben con valores reales

**El mismo fix DEBE aplicarse a módulos**

---

# PROBLEMA 2: INCONSISTENCIA EN CONTEO DE INFORMES/USUARIO

## 1. Síntoma

**AdminOverview.tsx** (línea 103):
```
Promedio informes/usuario = 12.25
```

**AdvancedUserManagement.tsx** (línea 270):
```
Tabla muestra para CADA usuario: "Informes" = 0
```

**Esperado**: Si el promedio es 12.25, debería verse algo como:
- Usuario A: 12 informes
- Usuario B: 12 informes  
- Usuario C: 13 informes
- Usuario D: 12 informes
- **Promedio**: (12+12+13+12)/4 = 12.25

**Actual**:
- Usuario A: 0 informes
- Usuario B: 0 informes
- Usuario C: 0 informes  
- Usuario D: 0 informes
- **¿Pero el KPI dice 12.25?** ← INCONSISTENCIA

## 2. Análisis de Endpoints

### 2.1 Endpoint GET /api/users/statistics (KPI)

**Archivo**: `api.js` líneas 2087-2115

**Código**:
```javascript
app.get('/api/users/statistics', async (req, res) => {
  const statsResult = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM usuarios) AS total_users,
      (SELECT COUNT(*) FROM user_activity_log WHERE is_suspended = true) AS suspended_users,
      (SELECT COUNT(*) FROM reports) AS total_reports,  // ← Cuenta GLOBAL de reportes
      (SELECT COUNT(*) FROM user_activity_log WHERE is_suspended = false OR is_suspended IS NULL) AS active_users
  `)

  const totalUsers = parseInt(row.total_users || 0)     // ← 4 usuarios
  const totalReports = parseInt(row.total_reports || 0) // ← 49 reportes
  
  // Calcula promedio
  const averageReportsPerUser = totalUsers > 0 
    ? Number((totalReports / totalUsers).toFixed(2))  // ← 49/4 = 12.25 ✅
    : 0

  res.json({
    totalUsers,
    activeUsers,
    suspendedUsers,
    totalReports,
    averageReportsPerUser,  // ← Devuelve 12.25
  })
})
```

**Veredicto**: ✅ Calcula correctamente el promedio GLOBAL

### 2.2 Endpoint GET /api/users/with-activity (Tabla por usuario)

**Archivo**: `api.js` líneas 1886-2020

**Código Relevante** (líneas 1975-1980):
```javascript
const result = await pool.query(`
  SELECT 
    u.id,
    u.correo as email,
    u.nombre,
    u.rol as role,
    COALESCE((
      SELECT COUNT(*)
      FROM reports r
      WHERE r.created_by = u.id::text         // ← Condición 1: Compara created_by con ID
         OR (r.created_by_email IS NOT NULL 
             AND LOWER(r.created_by_email) = LOWER(u.correo))  // ← Condición 2: Compara email
    ), 0) as reportsCreated,  // ← Retorna el conteo
    ...
  FROM usuarios u
  ORDER BY u.nombre ASC
`)
```

**El Problema Identificado**:

1. **Condición 1**: `r.created_by = u.id::text`
   - Convierte `u.id` a texto y compara con `r.created_by`
   - ❓ **Pregunta crítica**: ¿Cuál es el tipo de `u.id`? (integer o text)
   - ❓ ¿Cuál es el tipo de `r.created_by`? (integer o text)
   - Si los tipos no coinciden, la comparación falla

2. **Condición 2**: `LOWER(r.created_by_email) = LOWER(u.correo)`
   - Compara emails (debería funcionar)
   - PERO: Si `r.created_by_email` es NULL, esta condición NO se aplica

3. **El VERDADERO problema**: Cuando se crea un reporte en POST /reports (línea 1340), se guarda:
   ```javascript
   INSERT INTO reports (
     ...,
     created_by,           // ← ¿Se guarda? ¿Qué valor?
     created_by_email,     // ← Se guarda desde payload
     created_by_name,      // ← Se guarda desde payload
     ...
   )
   ```

   **¿Pero qué valor tiene `created_by`?** Ver línea 1357:
   ```javascript
   created_by: payload.created_by ?? null,  // ← Puede ser null si no se pasa
   ```

4. **Si `created_by` es NULL**, entonces:
   - Condición 1 falla: `NULL = u.id::text` → FALSE
   - Si `created_by_email` está presente, Condición 2 funciona ✓
   - Si `created_by_email` NO está presente, AMBAS condiciones fallan → COUNT retorna 0

### 2.3 Verificación: ¿Cómo se crean los Reportes?

**Frontend** - Envía a POST /reports con:
```javascript
const payload = {
  ..., 
  created_by: user.id,           // ← Debería enviar
  created_by_email: user.email,  // ← Se envía
  created_by_name: user.name,    // ← Se envía
}
```

**Backend** - Recibe en POST /reports (línea 1319):
```javascript
const payload = normalizeReportPayload(req.body ?? {})
// ...
created_by: payload.created_by ?? null,          // ← Si frontend no envía, será null
created_by_email: payload.created_by_email ?? '',
```

**RAÍZ DEL PROBLEMA**:
Si el frontend **NO está enviando `created_by`**, entonces:
- Los reportes se guardan con `created_by = null`
- El subquery en GET /api/users/with-activity falla con Condición 1
- Depende 100% de Condición 2 (email matching)
- Si hay problemas con emails (null, mismatch case), la Condición 2 también falla
- Resultado: COUNT(*) retorna 0 para TODOS los usuarios

### 2.4 Por qué el KPI SÍ funciona

El KPI en GET /api/users/statistics SOLO hace:
```javascript
(SELECT COUNT(*) FROM reports) AS total_reports
```

Simplemente cuenta TODOS los reportes, sin filtrar por usuario. Por eso devuelve 49.

**Pero el desglose por usuario NO funciona** porque el subquery falla.

---

## 3. Flujo Correcto vs Actual

### Actual (Problemático)

```
POST /reports { created_by: null, created_by_email: "user@test.com" }
    ↓
Guarda en DB con created_by = null
    ↓
GET /api/users/with-activity
    ↓
Subquery: SELECT COUNT(*) FROM reports r WHERE r.created_by = u.id::text OR r.created_by_email = u.correo
    ↓
created_by = null → Condición 1 FALLA
    ↓
created_by_email puede no coincidir con u.correo (diferentes formatos, case sensitive antes del LOWER, etc)
    ↓
Ambas condiciones fallan → COUNT(*) = 0
    ↓
Tabla muestra: "0 informes" para cada usuario ❌
    ↓
PERO: GET /api/users/statistics hace COUNT(*) FROM reports → cuenta los 49 globalmente ✅
    ↓
KPI muestra: 12.25 pero tabla muestra 0 ← INCONSISTENCIA
```

---

# SOLUCIONES PROPUESTAS

## Solución Problema 1: Módulos No Persisten

### Paso 1: Aplicar mismo fix que Permisos

**Archivo**: `api.js` línea 2172-2220

**Cambio**:
```javascript
// ❌ ACTUAL
const usersWithModules = usersResult.rows.map(user => ({
  userId: user.id,
  email: user.email,
  userName: user.userName,
  role: user.role,
  modules: user.modules_access || {},  // ← INCOMPLETO
}))

// ✅ CORREGIDO
// Primero, obtener todas las claves de módulos definidas
const allModulesResult = await pool.query(`
  SELECT DISTINCT jsonb_object_keys(modules_access) as module_key 
  FROM user_permissions 
  WHERE modules_access IS NOT NULL
`)

const allModuleKeys = new Set(allModulesResult.rows.map(r => r.module_key))

const usersWithModules = usersResult.rows.map(user => {
  // Inicializar con TODOS los módulos en false
  const completeModules = {}
  allModuleKeys.forEach(key => {
    completeModules[key] = false
  })
  
  // Sobrescribir con valores reales
  if (user.modules_access && typeof user.modules_access === 'object') {
    Object.assign(completeModules, user.modules_access)
  }
  
  return {
    userId: user.id,
    email: user.email,
    userName: user.userName,
    role: user.role,
    modules: completeModules,  // ← COMPLETO
  }
})
```

**Impacto**: ✅ Módulos con valor `false` ahora persisten correctamente

---

## Solución Problema 2: Inconsistencia en Conteo de Reportes

### Paso 1: Verificar qué está enviando el Frontend

**Frontend** - NewReport.tsx o ReportsList.tsx

**Verificar si envía `created_by`**:
```typescript
const response = await fetch('/reports', {
  method: 'POST',
  body: JSON.stringify({
    ...,
    created_by: user?.id,  // ← ¿Se envía esto?
    created_by_email: user?.email,
    created_by_name: user?.user_metadata?.full_name,
  })
})
```

### Paso 2: Garantizar que POST /reports siempre recibe created_by

**Archivo**: `api.js` línea 1340

**Cambio**:
```javascript
// ❌ ACTUAL
INSERT INTO reports (
  ...,
  created_by: payload.created_by ?? null,  // ← Puede ser null
  ...
)

// ✅ CORREGIDO - Extraer del token si no viene en payload
const userId = payload.created_by ?? req.user?.id ?? null  // ← Fallback a auth user
const userEmail = payload.created_by_email ?? req.user?.email ?? payload.created_by_email ?? ''

INSERT INTO reports (
  ...,
  created_by: userId,  // ← Garantizado llenar
  created_by_email: userEmail,
  ...
)
```

### Paso 3: Arreglar subquery en GET /api/users/with-activity

**Archivo**: `api.js` línea 1975

**Cambio** - Mejorar condición de matching:
```javascript
// ❌ ACTUAL
COALESCE((
  SELECT COUNT(*)
  FROM reports r
  WHERE r.created_by = u.id::text
     OR (r.created_by_email IS NOT NULL AND LOWER(r.created_by_email) = LOWER(u.correo))
), 0) as reportsCreated

// ✅ CORREGIDO - Más robusta
COALESCE((
  SELECT COUNT(*)
  FROM reports r
  WHERE (r.created_by IS NOT NULL AND r.created_by::text = u.id::text)
     OR (r.created_by_email IS NOT NULL AND LOWER(TRIM(r.created_by_email)) = LOWER(TRIM(u.correo)))
), 0) as reportsCreated
```

**Cambios aplicados**:
- Validar `r.created_by IS NOT NULL` antes de comparar
- Usar `::text` cast explícitamente
- Agregar `TRIM()` para eliminar espacios en emails
- Ambos lados usar `LOWER()` correctamente

---

# VERIFICACIÓN DE IMPACTO

## Impacto Esperado Después de Fixes

### Problema 1: Módulos
**Antes**:
```
Desmarcar "REPORTES" → Guardar → Recargar → "REPORTES" aparece marcado ❌
```

**Después**:
```
Desmarcar "REPORTES" → Guardar → Recargar → "REPORTES" sigue desmarcado ✅
```

### Problema 2: Reportes
**Antes**:
```
KPI: 12.25 informes/usuario
Tabla: 0 informes para todos los usuarios
```

**Después**:
```
KPI: 12.25 informes/usuario
Tabla: 12, 12, 13, 12 (desglose que suma 12.25) ✅
```

---

# ANÁLISIS DE CAUSA COMÚN

¿Ambos problemas tienen causa común?

**SÍ - Patrón identificado**:
1. **Problema 1 (Módulos)**: Se guardan CORRECTAMENTE en DB, pero se LEEN INCOMPLETOS
2. **Problema 2 (Reportes)**: Se guardan CON CAMPOS NULL, luego la lectura con subquery falla

**Patrón común**: 
- **Falta de validación de completitud de datos**
- **Endpoints GET que no garantizan completitud de respuesta**
- **Frontend que asume que si un campo no está en el JSON, significa "no existe" o "es false"**

**Lección aprendida**: 
- Cuando se guardan valores booleanos, SIEMPRE devolver todas las claves
- Cuando se crean registros, SIEMPRE llenar campos requeridos desde fuentes alternativas (auth user, etc)
- Validar que el query subselect tenga condiciones correctas y robustas

---
