# 🔧 SOLUCIONAR ERRORES 404/500 EN ENDPOINTS

## Problema

```
❌ /api/audit-logs → 500
❌ /api/users/with-permissions → 404  
❌ /api/users/with-modules → 404
```

## Causa Raíz

Las tablas `user_permissions`, `user_permission_details` y `user_activity_log` **NO EXISTEN** en Supabase. Por eso el backend retorna errores al intentar consultarlas.

---

## ✅ SOLUCIÓN (3 PASOS SIMPLES)

### PASO 1: Crear Tablas en Supabase (⏱️ 2 min)

1. **Abre Supabase SQL Editor**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto
   - Haz clic en **SQL Editor** (o **SQL** en el menú izquierdo)
   - Haz clic en **"New Query"** o botón +

2. **Copia el SQL Completo**
   - Abre el archivo: `CREATE_TABLES_NO_RESTRICTIONS.sql`
   - Selecciona TODO (Ctrl+A)
   - Copia (Ctrl+C)

3. **Pega en Supabase**
   - En el editor SQL de Supabase
   - Pega (Ctrl+V)
   - Haz clic en **"Run"** o presiona **Cmd+Enter**

4. **Espera el resultado** ✅
   ```
   ✅ CREATE TABLE user_activity_log
   ✅ CREATE TABLE user_permissions  
   ✅ CREATE TABLE user_permission_details
   ✅ CREATE INDEX idx_user_activity_log_user_id
   ... (más índices)
   ✅ INSERT INTO user_activity_log (SELECT ...)
   ```

### PASO 2: Sincronizar Roles (⏱️ 1 min)

En tu terminal local:

```bash
cd "c:\Users\Jose Rodriguez\Pictures\Screenshots\INTELASIST"
node SYNC_SUPABASE_AUTH_ROLES.mjs
```

Salida esperada:
```
✅ jose@example.com → Admin
✅ maria@example.com → Gerente
✅ juan@example.com → Agente
...
```

### PASO 3: Verificar Configuración (⏱️ 1 min)

```bash
node VERIFY_ADMIN_SETUP.mjs
```

Salida esperada:
```
✅ Conexión a Supabase: OK
✅ Tabla usuarios: 5 usuarios
✅ Tabla user_activity_log: 5 registros
✅ Tabla user_permissions: 5 registros
✅ Tabla user_permission_details: 145 permisos
✅ Endpoint /api/users/with-permissions: OK
✅ Endpoint /api/users/with-modules: OK
```

---

## 🎉 Después (FUNCIONA TODO)

1. **Recarga la app**
   - Presiona `Ctrl+F5` (forzar recarga)
   - O abre DevTools y borra cache

2. **Inicia sesión**
   - Con usuario que tenga rol **Admin** o **Support**
   - El menú **⚙ Administración Avanzada** debe aparecer

3. **Verifica en el navegador**
   - Abre DevTools (F12)
   - Ve a **Network**
   - Recarga página
   - Busca `/api/users/with-permissions`
   - Debe retornar **200** (no 404/500) ✅

---

## 🆘 Si algo sigue fallando

### Error: "Table doesn't exist"
- ❌ No ejecutaste el SQL en Supabase
- ✅ Vuelve a PASO 1

### Error: "Column user_id doesn't exist"
- ❌ El SQL se ejecutó parcialmente
- ✅ Ve a Supabase, elimina las tablas, y repite PASO 1

### Error: "HTTP 401"  
- ❌ SUPABASE_SERVICE_KEY no es válida
- ✅ Copia la correcta desde Supabase Dashboard > Settings > API

### Error: "Cannot find module '@supabase/supabase-js'"
```bash
npm install @supabase/supabase-js dotenv
```

### Los endpoints siguen dando 404
- Asegúrate que el backend en Render está actualizado
- El archivo `api.js` tiene los endpoints (líneas 1966-2020)
- Si no está en Render, haz push de nuevo:
  ```bash
  git push origin main
  ```

---

## 📊 Verificación Final

En tu navegador, abre DevTools (F12) → Console, y ejecuta:

```javascript
// Si ves datos, todo funciona ✅
fetch('/api/users/with-permissions')
  .then(r => r.json())
  .then(d => console.log('✅ FUNCIONA:', d))
  .catch(e => console.error('❌ ERROR:', e))
```

Salida esperada:
```
✅ FUNCIONA: Array(5)
  0: {id: 1, email: "admin@...", role: "Admin", permissions: {...}}
  1: {id: 2, email: "support@...", role: "Support", permissions: {...}}
  ...
```

---

## 📋 Checklist Rápido

- [ ] Ejecuté SQL en Supabase (CREATE_TABLES_NO_RESTRICTIONS.sql)
- [ ] Ejecuté `node SYNC_SUPABASE_AUTH_ROLES.mjs`
- [ ] Ejecuté `node VERIFY_ADMIN_SETUP.mjs` → todos ✅
- [ ] Recargué la app (Ctrl+F5)
- [ ] Endpoints retornan 200 (no 404/500)
- [ ] Menú "Administración Avanzada" aparece

---

## 🚀 Estás Listo

Una vez completados los 3 pasos, los errores desaparecerán y todo funcionará correctamente.

**¡Éxito! 🎉**
