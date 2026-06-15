# Detalles Técnicos - Líneas a Reemplazar

## Archivo 1: src/lib/user-management.ts

### Cambio 1.1: Línea 25 - getAllUsersWithActivity()

**ACTUAL (INCORRECTO):**
```typescript
static async getAllUsersWithActivity() {
  try {
    const { data, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) throw usersError
    
    const users = (data?.users || []) as any[]
    // ...
  }
}
```

**DEBE SER:**
```typescript
static async getAllUsersWithActivity() {
  try {
    const response = await fetch('https://intelasist.onrender.com/api/users/with-activity')
    if (!response.ok) throw new Error('Failed to fetch users')
    
    const data = await response.json()
    const users = data || []
    // ...
  }
}
```

**Qué cambia:**
- Línea 25: `supabase.auth.admin.listUsers()` → `fetch('/api/users/with-activity')`
- Manejo de respuesta
- Backend ahora combina auth.users + user_activity_log

---

### Cambio 1.2: Línea 66 - getUserActivity()

**ACTUAL (INCORRECTO):**
```typescript
static async getUserActivity(userId: string) {
  try {
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError) throw userError
    
    let { data: activity, error: activityError } = await supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId)
      .single()
    // ...
  }
}
```

**DEBE SER:**
```typescript
static async getUserActivity(userId: string) {
  try {
    const response = await fetch(`https://intelasist.onrender.com/api/users/${userId}/activity`)
    if (!response.ok) throw new Error('Failed to fetch user activity')
    
    const { user, activity } = await response.json()
    
    // Backend ya combinó los datos
    // ...
  }
}
```

**Qué cambia:**
- Línea 66: `supabase.auth.admin.getUserById()` → `fetch('/api/users/{userId}/activity')`
- Backend devuelve datos combinados

---

### Cambio 1.3: Línea 312 - getActivityStatistics()

**UBICACIÓN EXACTA:** Buscar dentro de `getActivityStatistics()`

**ACTUAL:**
```typescript
// Si existe otra llamada auth.admin aquí
const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
```

**DEBE SER:**
```typescript
const response = await fetch('https://intelasist.onrender.com/api/users/statistics')
if (!response.ok) throw new Error('Failed to fetch statistics')
const stats = await response.json()
```

---

## Archivo 2: src/pages/components/AdminOverview.tsx

### Cambio 2: Línea 35 - loadStats()

**ACTUAL (INCORRECTO):**
```typescript
const loadStats = async () => {
  try {
    setLoading(true)
    setError(null)

    // Get total users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()  // ← LÍNEA 35
    if (authError) throw authError

    const totalUsers = authUsers?.users?.length || 0

    // Get user activity stats
    const activityStats = await UserManagementService.getActivityStatistics()
    // ...
  }
}
```

**DEBE SER:**
```typescript
const loadStats = async () => {
  try {
    setLoading(true)
    setError(null)

    // Get all stats in one call
    const response = await fetch('https://intelasist.onrender.com/api/users/statistics')
    if (!response.ok) throw new Error('Failed to load statistics')
    
    const statsData = await response.json()
    
    const totalUsers = statsData.totalUsers || 0
    const activityStats = {
      activeUsers: statsData.activeUsers,
      suspendedUsers: statsData.suspendedUsers,
      totalReports: statsData.totalReports,
    }
    // ...
  }
}
```

**Qué cambia:**
- Línea 35: Reemplazar `supabase.auth.admin.listUsers()` con fetch
- Línea 37: Eliminar check de authError
- Línea 39: Usar datos del endpoint
- Línea 41-42: Backend devuelve todo combinado

---

## Archivo 3: src/pages/components/PermissionsManagement.tsx

### Cambio 3: Línea 38 - loadUsers()

**ACTUAL (INCORRECTO):**
```typescript
const loadUsers = async () => {
  try {
    setLoading(true)
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()  // ← LÍNEA 38

    if (authError) throw authError

    const usersWithPerms: UserWithPermissions[] = []

    for (const user of authUsers?.users || []) {  // ← N+1 queries
      const perms = await PermissionsManagementService.getUserPermissions(user.id)
      usersWithPerms.push({
        id: user.id,
        email: user.email || '',
        fullName: user.user_metadata?.full_name || '',
        role: user.user_metadata?.role || 'Agente',
        permissions: perms,
      })
    }

    setUsers(usersWithPerms)
  } catch (error) {
    console.error('Error loading users:', error)
    toast.error('Error cargando usuarios')
  } finally {
    setLoading(false)
  }
}
```

**DEBE SER:**
```typescript
const loadUsers = async () => {
  try {
    setLoading(true)
    
    // Backend devuelve usuarios + permisos de una vez
    const response = await fetch('https://intelasist.onrender.com/api/users/with-permissions')
    if (!response.ok) throw new Error('Failed to load users')
    
    const usersWithPerms = await response.json()
    setUsers(usersWithPerms)
  } catch (error) {
    console.error('Error loading users:', error)
    toast.error('Error cargando usuarios')
  } finally {
    setLoading(false)
  }
}
```

**Qué cambia:**
- Línea 38: Reemplazar `supabase.auth.admin.listUsers()` con fetch
- Línea 40: Eliminar check de authError
- Línea 42-52: Eliminar loop N+1, backend ya combina todo
- Backend endpoint devuelve: `[{ id, email, fullName, role, permissions }, ...]`

---

## Archivo 4: src/pages/components/PermissionModules.tsx

### Cambio 4.1: Línea 36 - loadUsers()

**ACTUAL (INCORRECTO):**
```typescript
const loadUsers = async () => {
  try {
    setLoading(true)
    const { data: authUsers, error } = await supabase.auth.admin.listUsers()  // ← LÍNEA 36
    if (error) throw error

    const usersData: UserModuleAccess[] = []

    for (const user of authUsers?.users || []) {
      const moduleAccess: Record<string, boolean> = {}
      Object.keys(PERMISSION_MODULES).forEach((module) => {
        moduleAccess[module] = true
      })

      usersData.push({
        userId: user.id,
        email: user.email || '',
        userName: user.user_metadata?.full_name || '',
        role: user.user_metadata?.role || 'Agente',
        modules: moduleAccess,
      })
    }

    setUsers(usersData)
  } catch (error) {
    console.error('Error loading users:', error)
    toast.error('Error cargando usuarios')
  } finally {
    setLoading(false)
  }
}
```

**DEBE SER:**
```typescript
const loadUsers = async () => {
  try {
    setLoading(true)
    
    // Backend devuelve usuarios + módulos accesibles
    const response = await fetch('https://intelasist.onrender.com/api/users/with-modules')
    if (!response.ok) throw new Error('Failed to load users')
    
    const usersData = await response.json()
    setUsers(usersData)
  } catch (error) {
    console.error('Error loading users:', error)
    toast.error('Error cargando usuarios')
  } finally {
    setLoading(false)
  }
}
```

**Qué cambia:**
- Línea 36: Reemplazar `supabase.auth.admin.listUsers()`
- Línea 37: Eliminar error check
- Línea 39-52: Eliminar loop, backend calcula todo
- Backend devuelve estructura lista para usar

---

### Cambio 4.2: Línea 82-89 - handleSave()

**ACTUAL (INCORRECTO):**
```typescript
const handleSave = async (userId: string) => {
  try {
    setSaving((prev) => ({ ...prev, [userId]: true }))

    const user = users.find((u) => u.userId === userId)
    if (!user) return

    // Save to database ← PROBLEMA: módulos_access no existe en schema
    await supabase
      .from('user_permissions')
      .upsert({
        user_id: userId,
        modules_access: user.modules,  // ← CAMPO NO EXISTE EN TABLA
        updated_at: new Date().toISOString(),
      })

    toast.success(`Módulos actualizados para ${user.email}`)
  } catch (error) {
    console.error('Error saving:', error)
    toast.error('Error guardando cambios')
  } finally {
    setSaving((prev) => ({ ...prev, [userId]: false }))
  }
}
```

**DEBE SER:**
```typescript
const handleSave = async (userId: string) => {
  try {
    setSaving((prev) => ({ ...prev, [userId]: true }))

    const user = users.find((u) => u.userId === userId)
    if (!user) return

    // Call backend to update modules
    const response = await fetch(`https://intelasist.onrender.com/api/users/${userId}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules: user.modules }),
    })
    
    if (!response.ok) throw new Error('Failed to update modules')

    toast.success(`Módulos actualizados para ${user.email}`)
  } catch (error) {
    console.error('Error saving:', error)
    toast.error('Error guardando cambios')
  } finally {
    setSaving((prev) => ({ ...prev, [userId]: false }))
  }
}
```

**Qué cambia:**
- Línea 82-89: Reemplazar supabase.from().upsert() con fetch PUT
- Backend endpoint: `PUT /api/users/:userId/modules`
- Backend maneja el guardado correcto en base de datos

---

## Archivo 5: src/pages/components/SystemHealth.tsx

### Cambio 5: Línea 51 - checkHealth()

**ACTUAL (INCORRECTO):**
```typescript
// Check 2: Auth service
try {
  const { data, error } = await supabase.auth.admin.listUsers()  // ← LÍNEA 51
  checks.push({
    name: 'Servicio de Autenticación',
    status: error ? 'error' : 'healthy',
    message: error ? 'Problema con autenticación' : `${data?.users?.length || 0} usuarios registrados`,
    icon: <Users className="size-4" />,
  })
} catch (err) {
  checks.push({
    name: 'Servicio de Autenticación',
    status: 'error',
    message: 'Servicio no disponible',
    icon: <Users className="size-4" />,
  })
}
```

**DEBE SER:**
```typescript
// Check 2: Auth service
try {
  const response = await fetch('https://intelasist.onrender.com/api/health/auth')
  const health = await response.json()
  
  checks.push({
    name: 'Servicio de Autenticación',
    status: health.status,
    message: health.message || 'Servicio disponible',
    icon: <Users className="size-4" />,
  })
} catch (err) {
  checks.push({
    name: 'Servicio de Autenticación',
    status: 'error',
    message: 'Servicio no disponible',
    icon: <Users className="size-4" />,
  })
}
```

**Qué cambia:**
- Línea 51: Reemplazar `supabase.auth.admin.listUsers()` con fetch
- Backend endpoint: `GET /api/health/auth`
- Backend realiza verificaciones internas sin exponer auth.admin

---

## Resumen de Endpoints Nuevos Requeridos

```javascript
// En api.js, agregar:

// 1. Listar usuarios con actividad
GET /api/users/with-activity
  Response: [{ id, email, nombre, role, reportsCreated, lastLogin, ... }, ...]

// 2. Obtener usuario específico con actividad
GET /api/users/:userId/activity
  Response: { user: { id, email, ... }, activity: { ... } }

// 3. Estadísticas agregadas
GET /api/users/statistics
  Response: { totalUsers, activeUsers, suspendedUsers, totalReports, ... }

// 4. Usuarios con permisos (batch)
GET /api/users/with-permissions
  Response: [{ id, email, fullName, role, permissions: {} }, ...]

// 5. Usuarios con módulos
GET /api/users/with-modules
  Response: [{ userId, email, userName, role, modules: {} }, ...]

// 6. Actualizar módulos de usuario
PUT /api/users/:userId/modules
  Body: { modules: {} }
  Response: { success: true }

// 7. Actividad de usuario específico
GET /api/users/:userId/activity
  Response: { user: {...}, activity: {...} }

// 8. Health check de auth
GET /api/health/auth
  Response: { status: 'healthy|warning|error', message: '...', userCount: N }
```

---

## Base de Datos - Cambios Requeridos

### Opción 1: Agregar columna a user_permissions

```sql
ALTER TABLE public.user_permissions ADD COLUMN modules_access JSONB DEFAULT '{}'::jsonb;

-- Actualizar con datos existentes
UPDATE public.user_permissions SET modules_access = '{
  "reports": true,
  "evidence": true,
  "updates": true,
  "users": false,
  "system": false,
  "admin": false
}'::jsonb;
```

### Opción 2: Crear tabla separada (recomendado)

```sql
CREATE TABLE public.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  module_key text NOT NULL,
  has_access boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_module_access_user_id ON user_module_access(user_id);
```

---

**Total de cambios:** 7 archivos  
**Líneas a modificar:** ~15-20  
**Endpoints nuevos:** 8  
**Complejidad:** Media  
**Tiempo estimado:** 3-4 horas
