# 🚀 Instrucciones de Deployment

**Fecha:** 2026-06-14  
**Versión:** 1.0

---

## 📋 Checklist de Deployment

### ✅ Paso 1: Backend (Render)

**Acciones:**
1. Ir a [Render Dashboard](https://dashboard.render.com)
2. Seleccionar el servicio "intelasist" (Express backend)
3. Push cambios a git o descargar cambios locales
4. Los cambios en `api.js` se desplegarán automáticamente

**Cambios incluidos:**
- 9 nuevos endpoints en `/api/users*`
- 1 nuevo endpoint `/api/health/auth`

**Verificación post-deployment:**
```bash
# Verificar que el backend está corriendo
curl https://intelasist.onrender.com/

# Verificar que el nuevo endpoint funciona
curl https://intelasist.onrender.com/api/users/statistics
```

---

### ✅ Paso 2: Base de Datos (Supabase)

**IMPORTANTE:** Esta migración DEBE ejecutarse ANTES de desplegar el frontend.

**Opción A: Usar Supabase Dashboard (Recomendado)**

1. Ir a [Supabase Dashboard](https://app.supabase.com)
2. Seleccionar proyecto "intelasist"
3. Ir a **SQL Editor**
4. Crear nueva query
5. Copiar y pegar el contenido de: `supabase/migrations/20260614_add_modules_access.sql`
6. Ejecutar query

**Opción B: Usar Supabase CLI (Avanzado)**

```bash
# Terminal en raíz del proyecto
cd /path/to/INTELASIST

# Ejecutar migración
supabase migration up

# Verificar migración
supabase db pull
```

**Verificación post-migración:**

En Supabase SQL Editor, ejecutar:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_permissions' 
AND column_name = 'modules_access';
```

Debe devolver: `modules_access | jsonb`

---

### ✅ Paso 3: Frontend (Vercel)

**Acciones:**
1. Ir a [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleccionar proyecto "intelasist"
3. Push cambios a git (o Vercel auto-detecta)
4. Los cambios en `src/` se desplegarán automáticamente

**Cambios incluidos:**
- Reemplazo de 7 llamadas `auth.admin` con `fetch()`
- 5 componentes actualizados

**Verificación post-deployment:**

1. Ir a https://intelasist-ai.vercel.app/admin
2. Abrir DevTools (F12)
3. Ir a tab **Network**
4. Verificar que NO haya errores 401 o 404
5. Verificar que las requests vayan a `https://intelasist.onrender.com/api/*`

---

## 🔍 Pruebas Post-Deployment

### Test 1: AdminDashboard Carga Correctamente

```
URL: https://intelasist-ai.vercel.app/admin
Esperado: Cargar sin errores 401
Verificar: 5 tabs funcionan (Resumen, Permisos, Módulos, Usuarios, Salud)
```

### Test 2: Tab "Resumen" Muestra Estadísticas

```
1. Ir a AdminDashboard → Tab "Resumen"
2. Verificar que carga: Usuarios Totales, Reportes, Suspendidos, etc
3. DevTools → Network → Verificar GET /api/users/statistics → 200 OK
```

### Test 3: Tab "Permisos" Lista Usuarios

```
1. Ir a AdminDashboard → Tab "Permisos"
2. Verificar que lista usuarios con permisos
3. DevTools → Network → Verificar GET /api/users/with-permissions → 200 OK
```

### Test 4: Tab "Módulos" Funciona Completo

```
1. Ir a AdminDashboard → Tab "Módulos"
2. Verificar que lista usuarios
3. Expandir un usuario y cambiar módulos
4. Hacer click "Guardar"
5. DevTools → Network → Verificar PUT /api/users/:userId/modules → 200 OK
```

### Test 5: Tab "Salud" Sin Errores

```
1. Ir a AdminDashboard → Tab "Salud"
2. Verificar "Servicio de Autenticación" muestra "Saludable"
3. DevTools → Network → Verificar GET /api/health/auth → 200 OK
```

### Test 6: No Hay Errores 401/404

```
1. Abrir DevTools (F12)
2. Ir a tab Network
3. Filter por "401" → Debe estar vacío
4. Filter por "404" → Debe estar vacío
5. Buscar "auth.admin" en requests → Debe estar vacío
```

---

## ❌ Troubleshooting

### Problema: "Cannot GET /api/users"

**Causa:** Backend no tiene los nuevos endpoints  
**Solución:** Esperar a que Render re-despliegue o forzar re-deploy:
- Ir a Render Dashboard
- Seleccionar servicio "intelasist"
- Click en "Redeploy"

---

### Problema: "modules_access column does not exist"

**Causa:** Migración Supabase no se ejecutó  
**Solución:** Ejecutar migración manualmente en Supabase SQL Editor (ver Paso 2)

---

### Problema: Frontend muestra error 401 en admin

**Causa:** Frontend aún tiene calls a `auth.admin`  
**Solución:** Verificar que archivos fueron actualizados:
- `src/lib/user-management.ts`
- `src/pages/components/AdminOverview.tsx`
- `src/pages/components/PermissionsManagement.tsx`
- `src/pages/components/PermissionModules.tsx`
- `src/pages/components/SystemHealth.tsx`

---

### Problema: "CORS error"

**Causa:** Headers CORS no configurados  
**Solución:** Verificar en `api.js` que CORS está habilitado:
```javascript
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}
```

---

## ⏱️ Orden de Deployment

**IMPORTANTE:** Seguir este orden exacto

1. **Primero:** Ejecutar migración Supabase (Paso 2)
2. **Segundo:** Desplegar Backend a Render (Paso 1)
3. **Tercero:** Desplegar Frontend a Vercel (Paso 3)

Si despliegas en otro orden, habrá errores 404.

---

## 📈 Estimated Downtime

- **Supabase:** 0 min (operación instantánea)
- **Render:** 1-2 min (redeploy automático)
- **Vercel:** 2-3 min (build + deployment)

**Total:** ~5 minutos

---

## ✅ Checklist Final

- [ ] Migración Supabase ejecutada
- [ ] Backend re-desplegado en Render
- [ ] Frontend re-desplegado en Vercel
- [ ] AdminDashboard carga sin errores
- [ ] Tab "Resumen" muestra stats
- [ ] Tab "Permisos" lista usuarios
- [ ] Tab "Módulos" guarda cambios
- [ ] Tab "Usuarios" funciona
- [ ] Tab "Salud" sin errores
- [ ] DevTools: Sin 401/404 errors
- [ ] Usuarios administrativos pueden usar AdminDashboard

---

## 📞 Soporte

Si hay problemas post-deployment:

1. Revisar logs en Render Dashboard
2. Revisar errores en DevTools del navegador
3. Verificar Network tab para responses de error
4. Revisar migración Supabase fue ejecutada

---

**Deployment completado exitosamente cuando todos los tests pasen ✅**
