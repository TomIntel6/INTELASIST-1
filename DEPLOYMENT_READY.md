# 🚀 DEPLOYMENT - Corrección de Errores 404

**Fecha:** 2026-06-14  
**Estado:** ✅ Listo para desplegar  
**Cambios:** Migración SQL + Componentes ya actualizados  

---

## 📋 Estado Actual

### ✅ Frontend (Ya Actualizado)
- [x] AdminOverview.tsx - Usa fetch('/api/users/statistics')
- [x] PermissionsManagement.tsx - Usa fetch('/api/users/with-permissions')
- [x] PermissionModules.tsx - Usa fetch('/api/users/with-modules')
- [x] SystemHealth.tsx - Usa fetch('/api/health/auth')
- [x] AdvancedUserManagement.tsx - Usa UserManagementService
- [x] user-management.ts - Todos los métodos actualizados

### ✅ Backend (Ya Implementado)
- [x] GET /api/users/with-activity
- [x] GET /api/users
- [x] GET /api/users/:userId
- [x] GET /api/users/statistics
- [x] GET /api/users/with-permissions
- [x] GET /api/users/with-modules
- [x] PUT /api/users/:userId/permissions
- [x] PUT /api/users/:userId/modules
- [x] GET /api/health/auth

### ⏳ Database (PENDIENTE)
- [ ] Ejecutar migración: 20260614_FIX_admin_tables_usuarios_reference.sql

---

## 🔧 PASOS A EJECUTAR

### PASO 1: Ejecutar Migración en Supabase (5 minutos)

**Ubicación:** https://app.supabase.com → Tu Proyecto → SQL Editor

**Instrucciones:**

1. **Opción A: Ejecutar directamente en SQL Editor**
   ```
   1. Ir a: https://app.supabase.com/project/intelasist/sql/new
   2. Pegar contenido de: supabase/migrations/20260614_FIX_admin_tables_usuarios_reference.sql
   3. Click en botón "RUN" (Ctrl+Enter)
   4. Esperar a que se complete ✅
   ```

2. **Opción B: Usar Supabase CLI**
   ```bash
   # En terminal
   cd c:\Users\Jose Rodriguez\Pictures\Screenshots\INTELASIST
   supabase db push
   ```

**Lo que hace la migración:**
- ✅ Elimina tablas anteriores si existen (sin datos)
- ✅ Crea `user_activity_log` referenciando `usuarios.id`
- ✅ Crea `user_permissions` referenciando `usuarios.id`
- ✅ Crea `user_permission_details`
- ✅ Agrega índices para performance
- ✅ Configura RLS policies correctas
- ✅ Inicializa datos para usuarios existentes

---

### PASO 2: Verificar Tablas Creadas

**En Supabase Dashboard:**

1. Ir a: Table Editor
2. Verificar que existen:
   - [ ] `user_activity_log`
   - [ ] `user_permissions`
   - [ ] `user_permission_details`
3. Expandir cada tabla y verificar columnas

**En SQL Query (para verificar datos):**

```sql
-- Verificar user_activity_log
SELECT COUNT(*) as total FROM public.user_activity_log;

-- Verificar user_permissions
SELECT COUNT(*) as total FROM public.user_permissions;

-- Verificar data integrity
SELECT u.id, u.correo, ual.is_suspended, up.modules_access
FROM public.usuarios u
LEFT JOIN public.user_activity_log ual ON ual.user_id = u.id
LEFT JOIN public.user_permissions up ON up.user_id = u.id
LIMIT 5;
```

---

### PASO 3: Backend Render (Auto-Deploy)

**Render Dashboard:** https://dashboard.render.com

1. El backend ya tiene los endpoints correctos
2. Al hacer git push, Render auto-despliega
3. No se necesitan cambios en api.js

**Verificar que esté corriendo:**
```bash
curl https://intelasist.onrender.com/api/health
# Debería responder: { "status": "ok" }
```

---

### PASO 4: Frontend Vercel (Auto-Deploy)

**Vercel Dashboard:** https://vercel.com/dashboard

1. Los componentes ya están actualizados
2. Al hacer git push, Vercel auto-despliega
3. No se necesitan cambios adicionales

**Estados esperados:**
- Build: Success ✅
- Deployment: Ready ✅

---

### PASO 5: Testing Post-Deployment (30 minutos)

**URL:** https://intelasist-ai.vercel.app/admin

#### Test 1: Verificar Network
```
1. Abrir DevTools (F12)
2. Ir a tab "Network"
3. Recargar página (F5)
4. Buscar "404" → Debe estar VACÍO ✅
5. Buscar "api/users" → Debe ver varios 200 OK ✅
```

#### Test 2: Tab por Tab

**📊 Resumen**
- [ ] Carga sin errores
- [ ] Muestra: Total Usuarios, Activos, Suspendidos, Total Reportes
- [ ] DevTools: GET /api/users/statistics → 200 OK
- [ ] Datos actualizados

**🔐 Permisos**
- [ ] Carga lista de usuarios
- [ ] Muestra checkboxes de permisos
- [ ] DevTools: GET /api/users/with-permissions → 200 OK
- [ ] Puedo cambiar permisos
- [ ] Botón "Guardar" funciona

**⚙️ Módulos**
- [ ] Carga lista de usuarios
- [ ] Muestra checkboxes de módulos (reports, evidence, etc)
- [ ] DevTools: GET /api/users/with-modules → 200 OK
- [ ] Puedo cambiar módulos
- [ ] Guardar persiste cambios

**👥 Usuarios**
- [ ] Carga lista de usuarios con actividad
- [ ] Muestra últimos logins
- [ ] DevTools: GET /api/users/with-activity → 200 OK

**❤️ Salud**
- [ ] Carga todos los checks
- [ ] "Servicio de Autenticación": 🟢 Saludable
- [ ] DevTools: GET /api/health/auth → 200 OK

**📋 Auditoría, 📄 Reportes, 📈 Timeline, 🗑️ Papelera**
- [ ] Cargan sin errores de administración

---

## 🎯 Plan Exacto de Ejecución

```
AHORA:
1️⃣  Ejecutar migración SQL en Supabase (5 min)
2️⃣  Verificar tablas creadas (2 min)

LUEGO (Git push):
3️⃣  Git add/commit/push (Frontend + Backend auto-deploys)
4️⃣  Esperar deployments completados (3-5 min)

FINALMENTE:
5️⃣  Abrir AdminDashboard en browser
6️⃣  Realizar tests (DevTools Network)
7️⃣  Confirmar que TODO funciona ✅
```

---

## 📊 Cambios por Archivo

| Archivo | Cambios | Status |
|---------|---------|--------|
| supabase/migrations/20260614_FIX_admin_tables_usuarios_reference.sql | Nueva migración | ✅ Creada |
| src/pages/components/*.tsx | Todos usan fetch() | ✅ Actualizado |
| src/lib/user-management.ts | Todos usan fetch() | ✅ Actualizado |
| api.js | Endpoints listos | ✅ Implementado |
| db.js | Sin cambios | ✅ OK |

---

## ⚠️ Checklist Pre-Deployment

- [ ] ¿Todos los archivos React están actualizados? → Ver git log
- [ ] ¿Backend está corriendo? → curl https://intelasist.onrender.com/api/health
- [ ] ¿Supabase responde? → Ir a Dashboard
- [ ] ¿La migración está lista? → Revisar archivo SQL

---

## 🔍 Troubleshooting

### Problema: Migración falla en Supabase
```
Error: "relation \"user_permissions\" already exists"

Solución:
- La migración intenta DROP y CREATE nuevamente
- Si falla, ir a SQL Editor y ejecutar manualmente
```

### Problema: Endpoints retornan 404
```
Error: GET /api/users/statistics → 404

Causa posible: Migración no se ejecutó
Solución:
1. Verificar que tablas existen en Supabase
2. Ver logs de Render backend
3. Ejecutar migración nuevamente
```

### Problema: Components no muestran datos
```
Error: Lista de usuarios vacía

Causa: user_permissions/user_activity_log sin datos
Solución:
- La migración auto-inicializa datos
- Si vacío: ejecutar migration again
```

### Problema: RLS Policies bloquean lectura
```
Error: Forbidden (error code 403)

Solución:
- Verificar que usuario actual tiene rol 'Admin' o 'Support'
- Revisar RLS policies en Supabase Dashboard
- Ejecutar: SELECT * FROM usuarios WHERE id = auth.uid()
```

---

## ✅ Validación Final

Después de todo, verificar:

```sql
-- Debe retornar datos
SELECT COUNT(*) FROM public.user_activity_log;
SELECT COUNT(*) FROM public.user_permissions;

-- Debe retornar sin errores RLS
SELECT * FROM public.user_activity_log LIMIT 1;
SELECT * FROM public.user_permissions LIMIT 1;

-- Backend debe retornar JSON
curl https://intelasist.onrender.com/api/users/statistics
# Response: {"totalUsers": N, "activeUsers": N, ...}
```

---

## 📞 Siguiente Paso

### ⏭️ Acciones Inmediatas:

1. **Ejecutar migración SQL** en Supabase (paso 1 anterior)
2. **Esperar confirmación** de que tablas existen
3. **Git push** los cambios
4. **Testear AdminDashboard** en browser

---

## ✨ Resultado Esperado

```
✅ AdminDashboard completamente funcional
✅ 0 errores 404 en Network
✅ Todos los tabs cargan datos
✅ RLS policies funcionan
✅ Usuarios pueden gestionar permisos y módulos
```

---

**Listo para desplegar 🚀**

¿Ejecuto la migración ahora?
