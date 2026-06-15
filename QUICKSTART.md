# ⚡ INICIO RÁPIDO (5 MINUTOS)

## 📋 TODO DE UNA VEZ

### ✅ PASO 1: SQL (3 min)
1. Abre: https://app.supabase.com → Tu Proyecto → SQL Editor
2. Click: "New Query" 
3. Copia contenido de: `SYNC_ROLES_AND_PERMISSIONS.sql`
4. Pega en editor
5. Click: "Run" (botón azul)
6. Espera a que termine
7. Verifica que todos digan ✅

### ✅ PASO 2: Sync Roles (1 min)
```bash
node SYNC_SUPABASE_AUTH_ROLES.mjs
```
Debería mostrar:
```
✅ Rol actualizado a: Support
📊 Sincronizados correctamente: X/X
```

### ✅ PASO 3: Verificar (30 seg)
```bash
node VERIFY_ADMIN_SETUP.mjs
```
Debería mostrar:
```
✅ TODAS LAS VERIFICACIONES PASARON
```

### ✅ PASO 4: App (30 seg)
1. En navegador: **Ctrl+F5** (limpiar caché)
2. Inicia sesión como Support o Admin
3. Deberías ver: **"⚙ Administración Avanzada"** en sidebar
4. Click → Los tabs tienen contenido (✅ no vacío)

---

## 🐛 ALGO FALLÓ?

### No veo el botón
```bash
node SYNC_SUPABASE_AUTH_ROLES.mjs
# Luego Ctrl+F5 en navegador
```

### Veo botón pero vacío
```
Abre Supabase SQL Editor
Ejecuta nuevamente: SYNC_ROLES_AND_PERMISSIONS.sql
Ctrl+F5 en navegador
```

### Los scripts no funcionan
```bash
# Verifica Node.js
node --version  # debe ser v18+

# Verifica .env
cat .env  # debe tener VITE_SUPABASE_*

# Instala dependencias si falta
npm install
```

---

## 📞 MÁS AYUDA

- **Guía completa**: `FIX_ADMIN_COMPLETE_GUIDE.md`
- **Resumen ejecutivo**: `ADMIN_FIX_README.md`
- **Consola navegador**: F12 → Console (para ver errores)
- **Logs backend**: Supabase → Logs

---

## ✨ LISTO!

Si llegaste aquí y todo funciona: **¡Administración Avanzada está reparada!** 🎉
