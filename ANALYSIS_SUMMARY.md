# 📌 RESUMEN EJECUTIVO - Análisis de Errores 404

## El Problema en 30 Segundos

✅ **Los endpoints existen en código pero retornan 404**

Razón: Las tablas que necesitan NO EXISTEN en Supabase:
- ❌ `user_activity_log` (falta)
- ❌ `user_permissions` (falta)  
- ❌ `user_permission_details` (falta)

---

## Qué No Funciona Actualmente

| Tab Admin | Estado | Error |
|-----------|--------|-------|
| 📊 Resumen | ❌ | GET /api/users/statistics → 404 |
| 🔐 Permisos | ❌ | GET /api/users/with-permissions → 404 |
| ⚙️ Módulos | ❌ | GET /api/users/with-modules → 404 |
| 👥 Usuarios | ❌ | GET /api/users/with-activity → 404 |
| ❤️ Salud | ⚠️ | Carga parcial por errores de actividad |

---

## Problema Arquitectónico

**El código está dividido entre dos sistemas de usuarios:**

```
Sistema 1: tabla "usuarios" (PostgreSQL)
├─ id (UUID)
├─ correo
├─ nombre
├─ rol
└─ Actualmente en uso

Sistema 2: auth.users (Supabase Auth)
├─ id (UUID)  
├─ email
├─ metadata
└─ No sincronizado
```

Las nuevas tablas referencia `auth.users.id`, pero los queries usan `usuarios.id`.

**No coinciden → Queries sin resultados → 404 equivalente**

---

## La Solución (Opción Recomendada)

### ⭐ Usar tabla `usuarios` como fuente única de verdad

```
Cambios necesarios:

1️⃣ Modificar migración SQL
   └─ Cambiar REFERENCES auth.users(id) → REFERENCES usuarios(id)
   
2️⃣ Crear tablas con estructura correcta:
   ├─ user_activity_log (con foreign key a usuarios.id)
   ├─ user_permissions (con foreign key a usuarios.id)
   └─ user_permission_details (relacionada con user_permissions)
   
3️⃣ Actualizar RLS policies
   └─ Mapear auth.uid() → usuarios.id (relación)
   
4️⃣ Validar queries en api.js
   └─ Asegurar JOINs correctos entre tablas
```

**Ventajas:**
- ✅ Máxima compatibilidad con sistema existente
- ✅ Cambios mínimos y localizados
- ✅ Bajo riesgo
- ✅ Más simple de mantener

---

## Migraciones Necesarias

### SERÁ NECESARIO EJECUTAR:

```sql
-- Crear tabla user_activity_log referenciando usuarios
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  reports_created integer DEFAULT 0,
  last_login timestamptz,
  last_activity timestamptz,
  is_suspended boolean DEFAULT false,
  suspension_reason text,
  suspended_at timestamptz,
  suspended_by uuid,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Crear tabla user_permissions referenciando usuarios
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  modules_access jsonb DEFAULT '{"reports":true,"evidence":true,"updates":true,"users":false,"system":false,"admin":false}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Crear tabla user_permission_details
CREATE TABLE IF NOT EXISTS public.user_permission_details (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_id uuid NOT NULL REFERENCES public.user_permissions(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(permission_id, permission_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
```

---

## Verificación Previa (Antes de Implementar)

**NECESITO CONFIRMAR:**

1. ¿Fueron ejecutadas las migraciones?
   ```
   Ubicación: supabase/migrations/
   Archivos: 20260614_advanced_permissions_system.sql
             20260614_add_modules_access.sql
   ```

2. ¿Las tablas existen?
   ```
   Supabase Dashboard → Database → Ver todas las tablas
   Buscar: user_permissions, user_activity_log, user_permission_details
   ```

3. ¿Tienen usuarios.id?
   ```
   SELECT COUNT(*) FROM public.usuarios;
   → ¿Cuántos registros?
   ```

---

## Plan de Acción

| Paso | Acción | Responsable | Tiempo |
|------|--------|-------------|--------|
| 1 | Analizar estado actual ← **AQUÍ** | GitHub Copilot | Hecho |
| 2 | Generar informe | GitHub Copilot | ← Esperando aprobación |
| 3 | Implementar cambios | GitHub Copilot | ~2 horas |
| 4 | Testear endpoints | Tú | ~30 min |
| 5 | Desplegar a producción | Tú | ~5 min |

---

## Siguiente Paso

👉 **Revisa el informe completo: [ANALYSIS_ERRORS_404.md](ANALYSIS_ERRORS_404.md)**

Después de revisar, confirma:
- ¿Apruebas la Opción C (reutilizar usuarios.id)?
- ¿Deseas que proceda con la implementación?

---

**Estado:** ⏸️ Esperando aprobación del usuario
