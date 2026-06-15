# 🚀 GUÍA COMPLETA: FIX ADMINISTRACIÓN AVANZADA

## ✅ LO QUE SE CORRIGIÓ

1. **permissions-context.tsx** - Validación de rol actualizada
2. **SQL Migration** - Tablas y permisos inicializados
3. **Supabase Auth Sync** - Roles sincronizados con Auth
4. **Verificación Completa** - Script para validar que todo funciona

---

## 📋 PASOS A EJECUTAR (EN ORDEN)

### PASO 1: Ejecutar Script SQL
**TIEMPO: 2-3 minutos**

1. Abre tu proyecto Supabase
2. Ve a **SQL Editor** → **New Query**
3. Copia el contenido de `SYNC_ROLES_AND_PERMISSIONS.sql`
4. Pega en el editor
5. Click en **Run** (botón azul)
6. Espera a que se complete
7. Verifica en los resultados que muestre ✅ en todas las columnas

**¿Qué hace este script?**
- ✅ Crea las tablas de permisos si no existen
- ✅ Inicializa registros en `user_activity_log`
- ✅ Inicializa registros en `user_permissions`
- ✅ Asigna todos los permisos a cada usuario según su rol

**Resultado esperado:**
```
usuario_id | activity_log | permissions | permission_count | modules_access
-----------|--------------|-------------|------------------|----------------
    1      |     ✅       |     ✅      |        29        |       ✅
    2      |     ✅       |     ✅      |        29        |       ✅
    3      |     ✅       |     ✅      |        29        |       ✅
```

---

### PASO 2: Sincronizar Roles con Supabase Auth
**TIEMPO: 1-2 minutos**

En tu terminal (en la raíz del proyecto):

```bash
# Asegúrate de tener las variables de entorno
# Verifica tu archivo .env tiene:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_ANON_KEY=eyJ...

# Ejecuta el script
node SYNC_SUPABASE_AUTH_ROLES.mjs
```

**¿Qué hace este script?**
- ✅ Lee todos los usuarios de la tabla `usuarios`
- ✅ Para cada usuario, obtiene su auth user en Supabase
- ✅ Actualiza los custom claims con el rol correcto
- ✅ Muestra un resumen de qué se sincronizó

**Resultado esperado:**
```
📧 tu-email@dominio.com:
   ✅ Rol actualizado a: Support

📊 RESUMEN:
  ✅ Sincronizados correctamente: 5/5
  ❌ Con errores: 0/5
```

---

### PASO 3: Verificar que Todo Funciona
**TIEMPO: 30 segundos**

En tu terminal:

```bash
node VERIFY_ADMIN_SETUP.mjs
```

**¿Qué verifica?**
- ✅ Que los usuarios existan
- ✅ Que las tablas de permisos tengan datos
- ✅ Que los endpoints del backend respondan
- ✅ Que todo esté sincronizado

**Resultado esperado:**
```
✅ Se encontraron 5 usuarios
✅ 5 registros en user_activity_log
✅ 5 registros en user_permissions
✅ 145 permisos registrados
✅ Endpoint /api/users/with-permissions funciona
✅ Endpoint /api/users/with-modules funciona
✅ Endpoint /api/users/statistics funciona

✅ TODAS LAS VERIFICACIONES PASARON
```

---

## 🧪 PRUEBA FINAL EN LA APP

Después de ejecutar los 3 pasos:

1. **Abre tu navegador**
   - Si la app estaba abierta, presiona **Ctrl+F5** (limpiar caché)
   - Si no, abre la app normalmente

2. **Inicia sesión con un usuario Support o Admin**
   - Deberías ver **"⚙ Administración Avanzada"** en el sidebar

3. **Haz click en el botón**
   - La página debería cargar SIN estar vacía
   - Deberías ver tabs: Resumen, Permisos, Módulos, Auditoría, etc.
   - Los tabs deberían tener contenido (usuarios, datos, etc.)

---

## ❌ SI ALGO NO FUNCIONA

### Problema: No veo el botón "Administración Avanzada"

**Solución:**
1. Verifica que tu usuario tiene rol `Support` o `Admin`
2. En Supabase → Auth → Tu usuario → View user
3. Busca "Custom Claims" o "User Metadata"
4. Debería tener: `{"role": "Support"}`
5. Si no tiene esto, ejecuta nuevamente: `node SYNC_SUPABASE_AUTH_ROLES.mjs`
6. Recarga la página con **Ctrl+F5**

---

### Problema: Veo el botón pero la página está vacía

**Solución:**
1. Abre la consola (F12) → Tab **Console**
2. Deberías ver logs de carga
3. Si ves errores, cópialos y verifica:
   - ¿Los endpoints del backend responden? Ejecuta: `node VERIFY_ADMIN_SETUP.mjs`
   - ¿La base de datos tiene datos? Ejecuta: `node VERIFY_ADMIN_SETUP.mjs`
4. Recarga la página con **Ctrl+F5**

---

### Problema: Los scripts no ejecutan

**Solución:**
1. Verifica que tienes Node.js instalado:
   ```bash
   node --version
   ```
   Debería mostrar v18 o superior

2. Verifica que tienes las dependencias:
   ```bash
   npm list @supabase/supabase-js
   ```
   Si no está instalado:
   ```bash
   npm install
   ```

3. Verifica que tienes variables de entorno:
   ```bash
   cat .env
   ```
   Debería mostrar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

---

## 📊 ESTRUCTURA DE DATOS DESPUÉS DEL FIX

```
tabla usuarios
├── id: integer (PK)
├── correo: text
├── nombre: text
└── rol: text (Agente, Gerente, Support, Admin)

tabla user_permissions (1 por usuario)
├── id: bigint (PK)
├── user_id: integer (FK → usuarios.id)
├── modules_access: jsonb
├── created_at: timestamp
└── updated_at: timestamp

tabla user_permission_details (N por usuario)
├── id: bigint (PK)
├── permission_id: bigint (FK → user_permissions.id)
├── permission_key: text (create_reports, view_users, etc)
├── granted: boolean
├── created_at: timestamp
└── updated_at: timestamp

tabla user_activity_log (1 por usuario)
├── id: bigint (PK)
├── user_id: integer (FK → usuarios.id)
├── reports_created: integer
├── last_login: timestamp
├── last_activity: timestamp
├── is_suspended: boolean
└── updated_at: timestamp
```

---

## 🎯 PERMISO POR ROL

### Agente
- ✅ Crear informes
- ✅ Ver informes propios
- ✅ Editar informes propios
- ✅ Subir/descargar evidencias
- ✅ Agregar actualizaciones

### Gerente
- ✅ Todos los de Agente +
- ✅ Ver todos los informes
- ✅ Cambiar estado de informes
- ✅ Asignar informes
- ✅ Exportar informes
- ✅ Ver usuarios
- ✅ Ver alertas
- ✅ Ver auditoría

### Support / Admin
- ✅ **TODOS LOS PERMISOS** (29 en total)
- ✅ Acceso completo a Administración Avanzada

---

## 📞 TROUBLESHOOTING RÁPIDO

| Problema | Solución |
|----------|----------|
| No veo "Administración Avanzada" | Ejecuta `SYNC_SUPABASE_AUTH_ROLES.mjs` |
| El menú aparece pero vacío | Ejecuta `VERIFY_ADMIN_SETUP.mjs` |
| Los scripts dan error | Ejecuta `npm install` y verifica `.env` |
| La página se carga lentamente | Los endpoints son lentos, verifica backend |
| Ves datos pero parciales | Ejecuta SQL migration nuevamente |

---

## ✅ CONFIRMACIÓN DE ÉXITO

Sabrás que todo está correcto cuando:

- ✅ Ves el botón "⚙ Administración Avanzada" en la sidebar
- ✅ Haces click y la página carga sin estar vacía
- ✅ Los tabs (Resumen, Permisos, Módulos, Auditoría, etc.) tienen contenido
- ✅ Puedes ver usuarios con sus permisos en el tab de Permisos
- ✅ Puedes ver módulos asignados en el tab de Módulos
- ✅ El tab de Resumen muestra estadísticas

🎉 **¡Administración Avanzada completamente funcional!**
