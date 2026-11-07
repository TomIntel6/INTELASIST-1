# Guía para revisar la configuración en Render

Usa esta guía para comprobar las variables del servicio y compartir el resultado sin revelar claves ni contraseñas.

## 1. Abrir la configuración del servicio

1. Entra al Dashboard de Render y abre el servicio web que publica Intel Asistencia.
2. Ve a **Environment**.
3. Comprueba los nombres indicados abajo. No copies los valores secretos a este documento, a capturas ni al chat.
4. Si agregas o corriges variables, guarda los cambios y espera a que Render termine el redeploy.

## 2. Variables del frontend

Estas variables se usan durante la compilación del frontend:

| Variable | Requerida | Qué verificar |
|---|---|---|
| `VITE_SUPABASE_URL` | Sí | URL del proyecto Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Sí para Realtime | Clave pública `anon`/`publishable` del proyecto. No uses una clave `service_role` aquí. |
| `VITE_API_BASE_URL` | Opcional | Si está definida, debe ser `https://intelasist.onrender.com`; si no, el frontend usa esa URL como valor predeterminado. |

Las variables con prefijo `VITE_` se incorporan al bundle del navegador. La clave `anon`/`publishable` es pública por diseño; nunca pongas una clave administrativa o `service_role` en una variable `VITE_`.

## 3. Variables privadas del backend

Estas variables deben configurarse en el entorno privado del servicio backend de Render, sin prefijo `VITE_`:

| Variable | Requerida | Qué verificar |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL correcta y accesible desde Render. No compartas su valor. |
| `JWT_SECRET` | Sí | Secreto aleatorio, fuerte y exclusivo de producción. No reutilices contraseñas ni lo compartas. |
| `SUPABASE_URL` | Para funciones administrativas de Supabase | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_KEY` | Para funciones administrativas de Supabase | Clave privada de servicio. El backend también acepta el nombre `SUPABASE_SERVICE_ROLE_KEY`. Nunca la compartas ni la pongas en el frontend. |

`FRONTEND_ORIGIN` es opcional: si se usa, debe ser el origen de producción de Vercel, sin una ruta como `/login`. `RENDER_EXTERNAL_URL` normalmente lo proporciona Render. No las cambies si ya están configuradas correctamente.

## 4. Comprobar el resultado después del redeploy

1. Abre `https://intelasist.onrender.com/api/health/auth`.
2. Si la respuesta indica `healthy`, la API pudo consultar la tabla de usuarios.
3. Si responde con error, abre **Logs** en Render y busca el registro del health check o del intento de inicio de sesión.
4. Prueba iniciar sesión desde la página normalmente; no incluyas la contraseña en el reporte.

## 5. Información que puedes enviarme

Copia y completa solo los estados, nunca los valores:

```text
VITE_SUPABASE_URL: configurada / falta
VITE_SUPABASE_ANON_KEY: configurada / falta
VITE_API_BASE_URL: configurada / falta / valor distinto del esperado
DATABASE_URL: configurada / falta
JWT_SECRET: configurada / falta
SUPABASE_URL: configurada / falta
SUPABASE_SERVICE_KEY o SUPABASE_SERVICE_ROLE_KEY: configurada / falta
Último redeploy: exitoso / fallido
GET /api/health/auth: healthy / error (código HTTP: ___)
Inicio de sesión después del redeploy: exitoso / error
```

Si el health check falla, comparte también unas pocas líneas relevantes de **Logs** de Render, con contraseñas, tokens, claves, cadenas de conexión, correos y otros datos personales redactados. No envíes una captura de la página **Environment**, porque muestra valores secretos.
