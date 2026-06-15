# 🔧 Solución: Habilitar Permiso CREATE_REPORTS para Todos los Usuarios

El problema es que los permisos no estaban correctamente inicializados en la base de datos. He creado dos soluciones:

## ✅ Solución Recomendada (Opción 1): Ejecutar SQL en Supabase

### Pasos:

1. **Abre la consola de Supabase**
   - Ve a: https://app.supabase.com
   - Selecciona tu proyecto `ceowmvfxjgrgwrespcrb`

2. **Abre el SQL Editor**
   - En el menú izquierdo, haz clic en "SQL Editor"
   - Crea una nueva consulta

3. **Copia y pega el contenido del archivo:**
   - Abre el archivo: `FIX_PERMISSIONS_CREATE_REPORTS.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor de Supabase

4. **Ejecuta la consulta**
   - Haz clic en el botón "▶ Execute" o presiona `Ctrl+Enter`
   - Espera a que se complete

5. **Verifica los resultados**
   - Al final del script, verás una tabla que muestra:
     - Email del usuario
     - Rol del usuario
     - Total de permisos habilitados
     - Estado de create_reports (debe mostrar ✅ create_reports: HABILITADO)

---

## 🤖 Solución Alternativa (Opción 2): Usar Node.js Script

Si prefieres ejecutar desde la terminal:

1. **Obtén la Service Role Key de Supabase**
   - Ve a: https://app.supabase.com
   - Selecciona tu proyecto
   - Ve a Settings → API
   - Copia la "Service Role Key" (la clave grande, no la anon key)

2. **Actualiza el archivo .env**
   ```
   SUPABASE_SERVICE_KEY=<pega_aqui_la_service_role_key>
   ```

3. **Ejecuta el script**
   ```powershell
   cd "c:\Users\Jose Rodriguez\Pictures\Screenshots\INTELASIST"
   node fix-create-reports-permission.mjs
   ```

---

## 🔍 Qué hace el script:

1. ✅ Asegura que todos los usuarios tengan registros en `user_permissions`
2. ✅ Asegura que todos los usuarios tengan registros en `user_activity_log`
3. ✅ **Habilita `create_reports: true` para TODOS los usuarios**
4. ✅ Inicializa todos los permisos según el rol del usuario
5. ✅ Verifica que los cambios se aplicaron correctamente

---

## 📝 Cambios Realizados:

### 1. Migración SQL (`MIGRATION_1_SOLO_SQL.sql`)
- ✅ Agregado `create_reports: true` al JSON de permisos por defecto
- ✅ Actualizada la inicialización de datos para incluir el nuevo permiso
- ✅ Agregada política RLS para permitir que todos creen informes

### 2. Script de Reparación (`fix-create-reports-permission.mjs`)
- Actualiza los registros existentes en la base de datos
- Puede ejecutarse desde Node.js con las variables de entorno correctas

### 3. Script SQL (`FIX_PERMISSIONS_CREATE_REPORTS.sql`)
- Ejecutable directamente en Supabase sin necesidad de configurar variables de entorno
- **RECOMENDADO:** Esta es la forma más fácil y rápida

---

## ✨ Después de ejecutar:

- Todos los usuarios tendrán permiso para crear informes (`create_reports: true`)
- El error "No tienes permisos para crear informes" debería desaparecer
- Los permisos se cargarán correctamente la próxima vez que inicies sesión

---

## ⚠️ Si aún tienes problemas:

1. **Recarga la página** (Ctrl+F5 o Cmd+Shift+R para limpiar caché)
2. **Cierra sesión y vuelve a iniciar sesión**
3. **Abre las herramientas de desarrollador** (F12) y revisa la consola para errores

---

## 🆘 Soporte:

Si necesitas ayuda, proporciona:
- Los resultados de la tabla final del script SQL
- Mensaje de error exacto que ves
- Tu correo y rol de usuario
