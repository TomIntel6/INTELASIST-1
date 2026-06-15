# Análisis: Errores 401 por auth.admin en Frontend

**Fecha del análisis:** 2026-06-14  
**Estado:** ANÁLISIS COMPLETADO - SIN CAMBIOS IMPLEMENTADOS

---

## 📋 Resumen Ejecutivo

El análisis ha identificado **9 llamadas a métodos `auth.admin`** distribuidas en el frontend y backend que causan errores 401. Estos métodos solo funcionan con `SERVICE_ROLE_KEY` en el servidor, no en React/Vercel.

**Problemas encontrados:**
- ✗ 9 llamadas a `auth.admin` en frontend (debería usar backend)
- ✗ 2 llamadas a `auth.admin` en backend (están correctamente configuradas)
- ✗ 4 componentes sin datos de usuarios disponibles
- ✗ Ausencia de tabla `profiles`
- ✗ Endpoints faltantes para permisos
- ✗ Esquema inconsistente en módulos de permisos

---

## 🔍 Llamadas auth.admin Encontradas

### 1. **api.js** (Backend - Línea 673-689)
**Estado:** ✓ CORRECTO - Usa SERVICE_ROLE_KEY en servidor

```javascript
// Línea 673
const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })

// Línea 689  
const { error: updateError } = await admin.auth.admin.updateUserById(targetUser.id, {
  user_metadata: { ...targetUser.user_metadata, role: nextRole }
})
```

**Análisis:** Estas llamadas están en el backend correcto y usan `admin` (cliente Supabase con SERVICE_ROLE_KEY).

---

### 2. **src/lib/user-management.ts** (Frontend - Líneas 25, 66, 312)
**Estado:** ✗ ERROR - Se ejecuta desde React/Vercel

```typescript
// Línea 25 - getAllUsersWithActivity()
const { data, error: usersError } = await supabase.auth.admin.listUsers()

// Línea 66 - getUserActivity()
const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId)

// Línea 312 - (dentro de otra función)
const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
```

**Impacto:** Causa errores 401 en:
- `AdvancedUserManagement.tsx` → llama `UserManagementService.getAllUsersWithActivity()`
- Componentes que dependen de estos datos no pueden cargar

**Solución:** Estos datos deben venir del backend en Render

---

### 3. **src/pages/components/AdminOverview.tsx** (Frontend - Línea 35)
**Estado:** ✗ ERROR - Causa 401 en el módulo

```typescript
// Línea 35
const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

const totalUsers = authUsers?.users?.length || 0
```

**Impacto:** 
- No muestra el conteo total de usuarios
- El módulo de Resumen falla al cargar
- Afecta a la vista `AdminDashboard` tab "overview"

---

### 4. **src/pages/components/PermissionsManagement.tsx** (Frontend - Línea 38)
**Estado:** ✗ ERROR - Bloquea gestión de permisos

```typescript
// Línea 38
const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

// Luego itera sobre los usuarios para cargar sus permisos
for (const user of authUsers?.users || []) {
  const perms = await PermissionsManagementService.getUserPermissions(user.id)
  // ...
}
```

**Impacto:**
- No se puede ver la lista de usuarios para asignar permisos
- El tab "Permisos" en AdminDashboard falla
- Endpoint faltante: `GET /api/permissions/:userId`

---

### 5. **src/pages/components/PermissionModules.tsx** (Frontend - Línea 36)
**Estado:** ✗ ERROR - Bloquea gestión de módulos

```typescript
// Línea 36
const { data: authUsers, error } = await supabase.auth.admin.listUsers()

// Luego intenta guardar con un campo inexistente
const handleSave = async (userId: string) => {
  await supabase
    .from('user_permissions')
    .upsert({
      user_id: userId,
      modules_access: user.modules,  // ← CAMPO NO EXISTE EN LA TABLA
      updated_at: new Date().toISOString(),
    })
}
```

**Impacto:**
- No carga lista de usuarios
- El campo `modules_access` no existe en tabla `user_permissions`
- Error al intentar guardar cambios

**Problemas adicionales:**
- La tabla `user_permissions` tiene estructura diferente
- Falta endpoint: `PUT /api/permissions/:userId/modules`

---

### 6. **src/pages/components/SystemHealth.tsx** (Frontend - Línea 51)
**Estado:** ✗ ERROR - No verifica salud del sistema

```typescript
// Línea 51
try {
  const { data, error } = await supabase.auth.admin.listUsers()
  checks.push({
    name: 'Servicio de Autenticación',
    status: error ? 'error' : 'healthy',
    message: error ? 'Problema con autenticación' : `${data?.users?.length || 0} usuarios registrados`,
  })
}
```

**Impacto:**
- Check de "Servicio de Autenticación" siempre falla con 401
- No muestra conteo de usuarios
- El tab "Salud" muestra error permanente

---

## 📊 Resumen de Archivos Afectados

| Archivo | Línea | Función | Tipo | Impacto |
|---------|-------|---------|------|---------|
| api.js | 673, 689 | updateUserRoleInSupabase | Backend | ✓ Correcto |
| user-management.ts | 25 | getAllUsersWithActivity | Frontend | ✗ Error 401 |
| user-management.ts | 66 | getUserActivity | Frontend | ✗ Error 401 |
| user-management.ts | 312 | getActivityStatistics | Frontend | ✗ Error 401 |
| AdminOverview.tsx | 35 | loadStats | Frontend | ✗ Error 401 |
| PermissionsManagement.tsx | 38 | loadUsers | Frontend | ✗ Error 401 |
| PermissionModules.tsx | 36 | loadUsers | Frontend | ✗ Error 401 |
| SystemHealth.tsx | 51 | checkHealth | Frontend | ✗ Error 401 |

---

## 🗄️ Estructura de Datos en Base de Datos

### Tablas Existentes (Verificadas)

```sql
-- ✓ user_permissions
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz,
  updated_at timestamptz
)

-- ✓ user_permission_details
CREATE TABLE public.user_permission_details (
  id uuid PRIMARY KEY,
  permission_id uuid NOT NULL,
  permission_key text NOT NULL,
  granted boolean DEFAULT false,
  UNIQUE(permission_id, permission_key)
)

-- ✓ user_activity_log
CREATE TABLE public.user_activity_log (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  reports_created integer DEFAULT 0,
  last_login timestamptz,
  last_activity timestamptz,
  is_suspended boolean DEFAULT false,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid,
  updated_at timestamptz,
  UNIQUE(user_id)
)

-- ✓ audit_logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY,
  user_id uuid,
  user_email text,
  user_name text,
  action audit_action_type,
  module text,
  entity_id uuid,
  entity_type text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  status audit_status,
  error_message text,
  created_at timestamptz
)
```

### Tablas No Existentes
- ✗ `profiles` - NO EXISTE (no es necesaria)

### Problemas de Esquema

**PermissionModules.tsx intenta usar:**
```javascript
modules_access: user.modules  // Campo que NO existe en user_permissions
```

**Solución:** Usar `user_permission_details` con nueva columna `module_access` o crear estructura diferente.

---

## 🔌 Endpoints Disponibles en Backend (api.js)

### Endpoints Actuales

**GET Endpoints:**
- `GET /` - Health check
- `GET /usuarios` - Listar usuarios
- `GET /events` - Eventos SSE
- `GET /reports` - Listar reportes
- `GET /reports/count` - Contar reportes
- `GET /reports/:id` - Obtener reporte específico
- `GET /reports/:id/updates` - Obtener actualizaciones de reporte
- `GET /failed-report-attempts` - Intentos fallidos
- `GET /failed-report-attempts/raw` - Datos crudos
- `GET /failed-report-attempts/:email` - Por email
- `GET /online-users` - Usuarios en línea

**POST Endpoints:**
- `POST /upload` - Subir archivo
- `POST /usuarios` - Crear usuario
- `POST /reports` - Crear reporte
- `POST /reports/bulk` - Crear múltiples reportes
- `POST /reports/:id/updates` - Agregar actualización
- `POST /failed-report-attempts/register` - Registrar intento fallido
- `POST /online-users` - Marcar usuario en línea
- `POST /online-users/offline` - Marcar usuario fuera de línea

**PUT Endpoints:**
- `PUT /usuarios/:email/rol` - Cambiar rol
- `PUT /usuarios/:email/password` - Cambiar contraseña

**DELETE Endpoints:**
- `DELETE /usuarios/:id` - Eliminar usuario
- `DELETE /reports/:id` - Eliminar reporte
- `DELETE /failed-report-attempts/:id` - Eliminar intento fallido
- `DELETE /online-users/:userId` - Eliminar de en línea

---

## ❌ Endpoints Faltantes

### Críticos para Administración

| Endpoint | Método | Propósito | Precedencia |
|----------|--------|-----------|-------------|
| `/api/users` | GET | Listar usuarios (NO auth.admin) | CRÍTICA |
| `/api/users/:userId/permissions` | GET | Obtener permisos de usuario | CRÍTICA |
| `/api/users/:userId/permissions` | PUT | Actualizar permisos | CRÍTICA |
| `/api/users/:userId/modules` | PUT | Actualizar módulos accesibles | ALTA |
| `/api/users/activity/statistics` | GET | Estadísticas de actividad | ALTA |
| `/api/users/:userId/activity` | GET | Actividad de usuario específico | MEDIA |
| `/api/users/:userId/suspend` | POST | Suspender usuario | MEDIA |
| `/api/users/:userId/reactivate` | POST | Reactivar usuario | MEDIA |

---

## 🔄 Flujo Actual (INCORRECTO)

```
Frontend Component (React)
    ↓
    └─→ supabase.auth.admin.listUsers()  ← ✗ ERROR 401
    
        (Requiere SERVICE_ROLE_KEY, no disponible en browser)
```

---

## 🔄 Flujo Recomendado (CORRECTO)

```
Frontend Component (React)
    ↓
    └─→ fetch('https://intelasist.onrender.com/api/users')
    
        ↓
        
Backend (Express en Render)
    ↓
    └─→ getSupabaseAdminClient() con SERVICE_ROLE_KEY
    
        ↓
        
        └─→ admin.auth.admin.listUsers()  ← ✓ Correcto
        
        ↓
        
        └─→ response.json(users)
        
        ↓
        
Frontend recibe datos seguros
```

---

## 📝 Detalles de Cada Problema

### Problema 1: getAllUsersWithActivity()

**Ubicación:** `src/lib/user-management.ts:25`

**Código problemático:**
```typescript
static async getAllUsersWithActivity() {
  try {
    const { data, error: usersError } = await supabase.auth.admin.listUsers()
    // ...
  }
}
```

**Usado por:**
- `AdvancedUserManagement.tsx` - loadUsers()
- Componente que se carga en AdminDashboard tab "Usuarios"

**Solución:**
- Mover lógica a `/api/users` en backend
- Usar datos de `user_activity_log` + `auth.users`
- Frontend llamará: `GET /api/users`

---

### Problema 2: getUserActivity()

**Ubicación:** `src/lib/user-management.ts:66`

**Código problemático:**
```typescript
static async getUserActivity(userId: string) {
  try {
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId)
    // ...
  }
}
```

**Impacto:**
- No se puede obtener detalles de un usuario específico
- Afecta dialogs de detalles en AdvancedUserManagement

**Solución:**
- Endpoint: `GET /api/users/:userId`
- Combinar datos de auth.users + user_activity_log

---

### Problema 3: PermissionModules.tsx - Campo Inexistente

**Ubicación:** `src/pages/components/PermissionModules.tsx:82-89`

```typescript
await supabase
  .from('user_permissions')
  .upsert({
    user_id: userId,
    modules_access: user.modules,  // ← NO EXISTE
    updated_at: new Date().toISOString(),
  })
```

**Problema:**
- La tabla `user_permissions` NO tiene columna `modules_access`
- Usa estructura `user_permission_details` en su lugar

**Solución:**
1. O crear columna `modules_access` JSONB en `user_permissions`
2. O usar backend endpoint para guardar en `user_permission_details`

---

### Problema 4: AdminOverview - Error de Estadísticas

**Ubicación:** `src/pages/components/AdminOverview.tsx:35`

```typescript
const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
const totalUsers = authUsers?.users?.length || 0
```

**Solución:**
- Endpoint: `GET /api/users/activity/statistics`
- Backend obtiene: total usuarios, activos, suspendidos, reportes, etc.

---

### Problema 5: PermissionsManagement - Loop auth.admin

**Ubicación:** `src/pages/components/PermissionsManagement.tsx:38-48`

```typescript
const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

for (const user of authUsers?.users || []) {
  const perms = await PermissionsManagementService.getUserPermissions(user.id)
  // Itera N+1 queries
}
```

**Problemas:**
- Llama auth.admin (error 401)
- Hace N queries a `user_permissions` para cada usuario
- Ineficiente

**Solución:**
- Endpoint: `GET /api/users/with-permissions`
- Backend devuelve: [{ user, permissions }, ...]

---

### Problema 6: SystemHealth - Check Permanente Fallo

**Ubicación:** `src/pages/components/SystemHealth.tsx:51-62`

```typescript
const { data, error } = await supabase.auth.admin.listUsers()
checks.push({
  name: 'Servicio de Autenticación',
  status: error ? 'error' : 'healthy',
})
```

**Impacto:**
- Check siempre marca error
- Usuario ve "Problema con autenticación" aunque todo funciona
- Alarma falsa

**Solución:**
- Endpoint: `GET /api/health/auth`
- Backend verifica servicios internamente

---

## 🎯 Acciones Recomendadas

### Fase 1: Endpoints del Backend (PRIORIDAD: CRÍTICA)

Crear en `api.js`:

```javascript
// 1. Listar usuarios sin auth.admin
GET /api/users
  → SELECT user_id, email, metadata FROM user_activity_log

// 2. Obtener usuario específico
GET /api/users/:userId
  → SELECT * FROM user_activity_log WHERE user_id = ?

// 3. Estadísticas del sistema
GET /api/users/activity/statistics
  → COUNT(*), SUM(is_suspended), etc.

// 4. Obtener permisos de usuario
GET /api/users/:userId/permissions
  → SELECT * FROM user_permission_details

// 5. Actualizar permisos
PUT /api/users/:userId/permissions
  → UPSERT user_permission_details

// 6. Listar usuarios con permisos
GET /api/users/with-permissions
  → JOIN user_activity_log + user_permission_details
```

### Fase 2: Reemplazar auth.admin en Frontend

1. **user-management.ts**
   - Reemplazar `auth.admin.listUsers()` con `fetch('/api/users')`
   - Reemplazar `auth.admin.getUserById()` con `fetch('/api/users/:id')`

2. **AdminOverview.tsx**
   - Reemplazar con `fetch('/api/users/activity/statistics')`

3. **PermissionsManagement.tsx**
   - Reemplazar con `fetch('/api/users/with-permissions')`

4. **PermissionModules.tsx**
   - Reemplazar con `fetch('/api/users/with-permissions')`
   - Crear endpoint `PUT /api/users/:userId/modules`

5. **SystemHealth.tsx**
   - Reemplazar con `fetch('/api/health/auth')`

### Fase 3: Correcciones de Esquema

1. **user_permissions table**
   - Opción A: Agregar columna `modules_access JSONB`
   - Opción B: Crear tabla `user_modules_access` separada

2. **Documentar estructura final**

---

## 📌 Conclusión del Análisis

**Errores encontrados:** 6 (9 llamadas auth.admin)  
**Archivos afectados:** 6  
**Endpoints faltantes:** 6-8  
**Problemas de esquema:** 1  
**Severidad:** 🔴 CRÍTICA  

El módulo "Administración Avanzada" está completamente no funcional en producción debido a errores 401 causados por uso de `auth.admin` desde el frontend.

**Tiempo estimado de corrección:** 3-4 horas (implementar endpoints + reemplazar frontend)

---

## ✅ Próximos Pasos (Después de Aprobación)

1. Revisar y aprobar este análisis
2. Crear endpoints en backend (`/api/users*`)
3. Reemplazar todas las llamadas auth.admin en frontend
4. Verificar tabla `user_permissions` schema
5. Testing de todos los módulos de administración
6. Deployment a Vercel/Render

**FIN DEL ANÁLISIS**
