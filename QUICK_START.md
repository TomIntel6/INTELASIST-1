# ⚡ QUICK START - Deployment en 5 Minutos

**Leer esto primero antes de desplegar. Solo 3 pasos.**

---

## 🎯 Orden de Ejecución

### ⏱️ PASO 1: Migración Supabase (1 minuto)

**URL:** https://app.supabase.com  
**Proyecto:** intelasist

**Instrucciones rápidas:**

1. Ir a **SQL Editor**
2. Click en botón **"New query"**
3. Pegar esto:

```sql
-- Add modules_access column if it doesn't exist
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS modules_access JSONB DEFAULT '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}'::jsonb;

-- Update existing records with default module access
UPDATE public.user_permissions 
SET modules_access = '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}'::jsonb
WHERE modules_access IS NULL;

-- Add constraint to ensure it's not null
ALTER TABLE public.user_permissions
ALTER COLUMN modules_access SET NOT NULL;
```

4. Click en **"RUN"** (Ctrl+Enter)
5. Esperar a que termine ✅

---

### ⏱️ PASO 2: Backend Render (2 minutos)

**URL:** https://dashboard.render.com  
**Servicio:** intelasist (Express)

**Instrucciones rápidas:**

1. Click en el servicio "intelasist"
2. Ir a **Deploys** (panel izquierdo)
3. Click en el deploy más reciente
4. Click botón **"Redeploy"** (esquina superior derecha)
5. Esperar a que diga "Deploy Live" ✅

---

### ⏱️ PASO 3: Frontend Vercel (3 minutos)

**URL:** https://vercel.com/dashboard  
**Proyecto:** intelasist

**Instrucciones rápidas:**

1. Click en proyecto "intelasist"
2. Esperar a que Vercel auto-detecte cambios
3. Deployment comenzará automáticamente
4. Esperar a que diga "Ready" ✅

---

## 🧪 Verificación Rápida (30 segundos)

**URL:** https://intelasist-ai.vercel.app/admin

1. Abrir en navegador
2. Abrir DevTools (F12)
3. Ir a tab **Network**
4. Verificar:
   - ❌ Sin "401 Unauthorized"
   - ❌ Sin "404 Not Found"  
   - ✅ Requests a `api/users/*` tienen status 200

Si todo OK → ✅ **DEPLOYMENT EXITOSO**

---

## ❌ Si Algo Falla

### Problema: Vercel muestra error 404

**Causa:** Backend aún no desplegó

**Solución:**
1. Esperar 2 minutos más
2. F5 (refresh página)
3. Si sigue: ir a Render Dashboard y verificar Deploy Live

### Problema: Supabase devuelve error SQL

**Causa:** Migración no se ejecutó bien

**Solución:**
1. Ir a Supabase SQL Editor
2. Ejecutar query a mano
3. Verificar no haya errores
4. Re-intentar

### Problema: Aún hay errores 401

**Causa:** Frontend aún tiene caché

**Solución:**
1. Limpiar cache: Ctrl+Shift+Delete
2. F5 (refresh)
3. Si sigue: abrir en incógnito

---

## ⏭️ Siguientes Pasos

Una vez deployment exitoso:

1. ✅ Usar AdminDashboard normalmente
2. ✅ Revisar que 9/9 tabs funcionan
3. ✅ Limpiar archivos temporales de análisis si deseas:
   - ANALYSIS_AUTH_ADMIN_ISSUES.md
   - CORRECTIONS_CHECKLIST.md
   - TECHNICAL_CHANGES.md
   - (Opcional - documentación generada)

---

## 📞 Soporte Rápido

| Problema | Solución |
|----------|----------|
| 401 Unauthorized | Verificar migración Supabase ejecutada |
| 404 Not Found | Esperar deploy Backend + recargar página |
| Módulos no guardan | Verificar backend desplegó correctamente |
| Admin Dashboard no carga | DevTools → Ver error en Console |

---

**¡Listo! Deployment completado en ~5 minutos. 🎉**

---

*Documentos completos en:*
- 📄 [DEPLOYMENT_INSTRUCTIONS.md](DEPLOYMENT_INSTRUCTIONS.md) - Instrucciones detalladas
- 📄 [README_IMPLEMENTACION.md](README_IMPLEMENTACION.md) - Resumen ejecutivo
- 📄 [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md) - Qué cambió exactamente
