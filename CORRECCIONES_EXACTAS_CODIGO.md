# 🔧 CORRECCIONES EXACTAS - CÓDIGO LISTO PARA APLICAR

## CORRECCIÓN 1: GET /api/users/with-modules - Devolver módulos completos

### Ubicación
**Archivo**: `api.js`
**Líneas actuales**: 2172-2220

### Código Actual (PROBLEMÁTICO)
```javascript
// GET /api/users/with-modules - Usuarios + Módulos accesibles
app.get('/api/users/with-modules', async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT 
        u.id,
        u.correo as email,
        u.nombre as userName,
        u.rol as role,
        COALESCE(up.modules_access, '{}'::jsonb) as modules_access
      FROM usuarios u
      LEFT JOIN user_permissions up ON up.user_id = u.id::text
      ORDER BY u.nombre ASC
    `)

    const usersWithModules = usersResult.rows.map(user => ({
      userId: user.id,
      email: user.email,
      userName: user.userName,
      role: user.role,
      modules: user.modules_access || {},
    }))

    res.json(usersWithModules)
  } catch (err) {
    console.error('Error fetching users with modules:', err)
    res.status(500).json({ error: 'Error al obtener usuarios con módulos' })
  }
})
```

### Código Corregido
```javascript
// GET /api/users/with-modules - Usuarios + Módulos accesibles
app.get('/api/users/with-modules', async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT 
        u.id,
        u.correo as email,
        u.nombre as userName,
        u.rol as role,
        COALESCE(up.modules_access, '{}'::jsonb) as modules_access
      FROM usuarios u
      LEFT JOIN user_permissions up ON up.user_id = u.id::text
      ORDER BY u.nombre ASC
    `)

    // Get all module keys defined in the system
    const allModulesResult = await pool.query(`
      SELECT DISTINCT jsonb_object_keys(modules_access) as module_key 
      FROM user_permissions 
      WHERE modules_access IS NOT NULL
    `)
    
    const allModuleKeys = new Set(allModulesResult.rows.map(r => r.module_key))

    const usersWithModules = usersResult.rows.map(user => {
      // Initialize complete modules object with all keys set to false
      const completeModules = {}
      allModuleKeys.forEach(key => {
        completeModules[key] = false
      })
      
      // Override with actual user modules from database
      if (user.modules_access && typeof user.modules_access === 'object') {
        Object.assign(completeModules, user.modules_access)
      }

      return {
        userId: user.id,
        email: user.email,
        userName: user.userName,
        role: user.role,
        modules: completeModules,
      }
    })

    res.json(usersWithModules)
  } catch (err) {
    console.error('Error fetching users with modules:', err)
    res.status(500).json({ error: 'Error al obtener usuarios con módulos' })
  }
})
```

### Cambios Aplicados
1. ✅ Query para obtener TODAS las claves de módulos del sistema
2. ✅ Inicializar objeto `completeModules` con TODAS las claves en `false`
3. ✅ Sobrescribir con valores reales del usuario
4. ✅ Garantizar que TODOS los usuarios reciben objeto completo

---

## CORRECCIÓN 2: POST /reports - Garantizar que created_by se llena

### Ubicación
**Archivo**: `api.js`
**Líneas actuales**: 1293-1380

### Código Problemático (Línea 1357)
```javascript
// ANTES - created_by puede ser null
INSERT INTO reports (
  id, month, year, insured_name, plate, policy, service_type, coverage, 
  brand, model, color, year_vehicle, status, observation_comment, 
  evidence_url, evidence_filename, evidence_path, evidence_urls, 
  created_by,              // ← Puede ser null
  created_by_name, 
  created_by_email,
  created_at, updated_at
) VALUES ($1, $2, $3, ..., $19, $20, $21, $22, $23)
```

En valores (línea 1369):
```javascript
payload.created_by ?? null,  // ← Fallback a null
payload.created_by_name ?? '',
payload.created_by_email ?? '',
```

### Corrección: Líneas a Modificar

#### Paso 1: Agregar fallback a req.user (después de normalización)

**Ubicación**: Después de línea 1306 (después de normalizeReportPayload)

```javascript
const reportId = getReportId()
const createdAt = new Date().toISOString()

// NUEVO: Garantizar que created_by está relleno
const userId = payload.created_by ?? req.user?.id ?? null
const userEmail = payload.created_by_email ?? req.user?.email ?? ''
const userName = payload.created_by_name ?? req.user?.user_metadata?.full_name ?? ''

console.log(`[API] Creating report with created_by fallback:`, {
  userId,
  userEmail, 
  userName,
  payloadProvidedUserId: payload.created_by,
})
```

#### Paso 2: Usar variables en INSERT (línea ~1357)

```javascript
// ACTUAL
const result = await pool.query(`
  INSERT INTO reports (
    id, month, year, insured_name, plate, policy, service_type, coverage, brand, model, color,
    year_vehicle, status, observation_comment, evidence_url, evidence_filename, evidence_path, evidence_urls, 
    created_by, created_by_name, created_by_email,
    created_at, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
  RETURNING *
`, [
  reportId,
  payload.month,
  Number(payload.year),
  payload.insured_name,
  payload.plate,
  payload.policy,
  payload.service_type ?? '',
  payload.coverage ?? null,
  payload.brand ?? '',
  payload.model ?? '',
  payload.color ?? '',
  payload.year_vehicle === undefined || payload.year_vehicle === null ? null : Number(payload.year_vehicle),
  payload.status ?? 'Seguimiento de caso',
  payload.observation_comment ?? '',
  payload.evidence_url ?? null,
  payload.evidence_filename ?? null,
  payload.evidence_path ?? null,
  payload.evidence_urls ? JSON.stringify(payload.evidence_urls) : null,
  payload.created_by ?? null,          // ← AQUÍ: Cambiar esto
  payload.created_by_name ?? '',       // ← AQUÍ: Cambiar esto
  payload.created_by_email ?? '',      // ← AQUÍ: Cambiar esto
  createdAt,
  createdAt,
])

// CORREGIDO
const result = await pool.query(`
  INSERT INTO reports (
    id, month, year, insured_name, plate, policy, service_type, coverage, brand, model, color,
    year_vehicle, status, observation_comment, evidence_url, evidence_filename, evidence_path, evidence_urls, 
    created_by, created_by_name, created_by_email,
    created_at, updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
  RETURNING *
`, [
  reportId,
  payload.month,
  Number(payload.year),
  payload.insured_name,
  payload.plate,
  payload.policy,
  payload.service_type ?? '',
  payload.coverage ?? null,
  payload.brand ?? '',
  payload.model ?? '',
  payload.color ?? '',
  payload.year_vehicle === undefined || payload.year_vehicle === null ? null : Number(payload.year_vehicle),
  payload.status ?? 'Seguimiento de caso',
  payload.observation_comment ?? '',
  payload.evidence_url ?? null,
  payload.evidence_filename ?? null,
  payload.evidence_path ?? null,
  payload.evidence_urls ? JSON.stringify(payload.evidence_urls) : null,
  userId,          // ← CORREGIDO: Usar variable con fallback
  userName,        // ← CORREGIDO: Usar variable con fallback
  userEmail,       // ← CORREGIDO: Usar variable con fallback
  createdAt,
  createdAt,
])
```

### Cambios Aplicados
1. ✅ Extraer `created_by` desde payload, fallback a `req.user.id`
2. ✅ Extraer `created_by_email` desde payload, fallback a `req.user.email`
3. ✅ Extraer `created_by_name` desde payload, fallback a `req.user.user_metadata.full_name`
4. ✅ Usar variables en INSERT en vez de expresiones ternarias

---

## CORRECCIÓN 3: GET /api/users/with-activity - Mejorar subquery de conteo

### Ubicación
**Archivo**: `api.js`
**Líneas actuales**: 1970-1985

### Código Actual (PROBLEMÁTICO)
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
      WHERE r.created_by = u.id::text
        OR (r.created_by_email IS NOT NULL AND LOWER(r.created_by_email) = LOWER(u.correo))
    ), 0) as reportsCreated,
    (SELECT last_login FROM user_activity_log WHERE user_id = u.id ORDER BY last_login DESC LIMIT 1) as lastLogin,
    ...
`)
```

### Código Corregido
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
      WHERE (r.created_by IS NOT NULL AND r.created_by::text = u.id::text)
        OR (r.created_by_email IS NOT NULL AND LOWER(TRIM(r.created_by_email)) = LOWER(TRIM(u.correo)))
    ), 0) as reportsCreated,
    (SELECT last_login FROM user_activity_log WHERE user_id = u.id ORDER BY last_login DESC LIMIT 1) as lastLogin,
    ...
`)
```

### Cambios Aplicados
1. ✅ Agregar validación `r.created_by IS NOT NULL` antes de comparar
2. ✅ Usar `r.created_by::text` explícitamente (cast antes de comparar)
3. ✅ Agregar `TRIM()` a emails para remover espacios
4. ✅ Mantener `LOWER()` para case-insensitive

### Comparación Lógica

| Caso | Antes | Después |
|------|-------|---------|
| `created_by = 123, created_by_email = "user@test.com"` | ✅ Matchea con Condición 1 | ✅ Matchea con Condición 1 |
| `created_by = null, created_by_email = "user@test.com"` | ❌ Condición 1 falla, depende de Condición 2 | ✅ Condición 1 explícitamente NO aplica, Condición 2 funciona |
| `created_by = null, created_by_email = " user@test.com "` (espacios) | ❌ Condición 2 falla por espacios | ✅ TRIM() elimina espacios, Condición 2 funciona |
| `created_by = 123, created_by_email = null` | ✅ Condición 1 funciona | ✅ Condición 1 funciona |

---

## RESUMEN DE CAMBIOS

| Número | Archivo | Línea | Función | Cambio |
|--------|---------|-------|---------|--------|
| 1 | api.js | 2172-2220 | GET /api/users/with-modules | Devolver módulos COMPLETOS con todas las claves |
| 2 | api.js | 1306-1310 | POST /reports (new) | Agregar fallback de created_by a req.user.id |
| 3 | api.js | 1357-1370 | POST /reports (INSERT) | Usar variables con fallback en INSERT |
| 4 | api.js | 1975-1980 | GET /api/users/with-activity | Mejorar subquery con validaciones |

---

## PASOS DE IMPLEMENTACIÓN

### 1. Aplicar Corrección 1 (Módulos)

```bash
# Edit api.js lines 2172-2220
# Replace GET /api/users/with-modules endpoint
```

**Verificar después**:
- Ir a Admin → Módulos
- Desmarcar un módulo
- Guardar
- Recargar página
- ✅ Módulo debe seguir desmarcado

### 2. Aplicar Corrección 2 & 3 (Reportes)

```bash
# Edit api.js lines 1306-1310
# Add fallback variables

# Edit api.js lines 1357-1370
# Use fallback variables in INSERT
```

**Verificar después**:
- Crear un nuevo reporte
- Ir a Admin → Usuarios
- Ver columna "Informes"
- ✅ Debe mostrar cantidad > 0 (no 0)
- ✅ El promedio en AdminOverview debe coincidir con desglose en tabla

### 3. Aplicar Corrección 4 (Subquery)

```bash
# Edit api.js lines 1975-1980
# Improve WHERE condition in subquery
```

**Verificar después**:
- GET /api/users/with-activity
- Respuesta debe incluir `reportsCreated` > 0 para usuarios con reportes
- ✅ KPI (GET /api/users/statistics) debe coincidir con promedio manual

---

## TESTING CHECKLIST

### Prueba 1: Módulos Persisten
```
[ ] 1. Acceder a Admin → Módulos
[ ] 2. Desmarcar "REPORTES" para un usuario
[ ] 3. Click "Guardar"
[ ] 4. Ver toast: "Módulos actualizados"
[ ] 5. F5 (recargar página)
[ ] 6. Verificar que "REPORTES" sigue DESMARCADO
```

### Prueba 2: Permisos Siguen Funcionando
```
[ ] 1. Acceder a Admin → Permisos
[ ] 2. Desmarcar algunos permisos
[ ] 3. Click "Guardar"
[ ] 4. F5 (recargar)
[ ] 5. Verificar que permisos desactivados siguen desactivados
```

### Prueba 3: Conteo de Reportes
```
[ ] 1. Crear un nuevo reporte
[ ] 2. Acceder a Admin → Usuarios
[ ] 3. Ver tabla con columna "Informes"
[ ] 4. Verificar que el usuario que creó el reporte muestra "1" (no 0)
[ ] 5. Crear 10 reportes más de ese usuario
[ ] 6. Recargar página
[ ] 7. Verificar que muestra "11"
```

### Prueba 4: KPI vs Tabla Coinciden
```
[ ] 1. Ir a Admin → Resumen
[ ] 2. Anotar "Promedio informes/usuario = X"
[ ] 3. Ir a Admin → Usuarios
[ ] 4. Sumar manualmente los informes: user1 + user2 + ... / cantidad_usuarios
[ ] 5. El resultado debe ser ≈ X (con máximo 0.1 de diferencia por redondeo)
```

---
