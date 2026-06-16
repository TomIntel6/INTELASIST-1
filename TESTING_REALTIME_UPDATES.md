# Guía de Pruebas: Actualización en Tiempo Real de Permisos y Módulos

## Pre-requisitos

- Proyecto compilado: `npm run build` ✅
- Servidor ejecutándose: `npm run dev` o `npm start`
- Dos navegadores o dos pestañas con sesiones activas

## Prueba 1: Actualización de Permisos en Tiempo Real

### Setup
1. Abre la URL de la aplicación en **Navegador A**
2. Inicia sesión como usuario ADMIN
3. Navega a: `Admin Dashboard → Permisos`
4. Abre la URL de la aplicación en **Navegador B**
5. Inicia sesión como el **MISMO usuario admin** o un **usuario diferente**
6. Navega a: `Admin Dashboard → Permisos`

### Pasos
1. En **Navegador A**: 
   - Busca un usuario (ej: "agente@ejemplo.com")
   - Expande sus permisos (haz clic en el usuario)
   - Cambia una casilla de permiso (ej: marca/desmarca "Crear Reporte")
   - Haz clic en "Guardar Permisos"
   - Observa el toast: "Permisos guardados exitosamente"

2. En **Navegador B**: 
   - **Importante**: NO recargues la página
   - Busca el mismo usuario
   - Expande sus permisos
   - **Resultado esperado**: Las casillas se actualizan automáticamente
   - Deberías ver el permiso modificado SIN recargar

### Verificación en Consola
En **Navegador B**, abre las DevTools (F12) y ve la pestaña "Console":
```
[SSE] Notificación de permisos actualizada para usuario: <userId>
[Real-time] Permisos actualizados: {type: 'permissions-updated', userId: '...', ...}
```

### Resultado
✅ **ÉXITO**: Ambos navegadores muestran el mismo estado de permisos
❌ **FALLO**: La pestaña B no se actualiza o necesita recargar

---

## Prueba 2: Actualización de Módulos en Tiempo Real

### Setup
1. En **Navegador A**: Navega a `Admin Dashboard → Módulos`
2. En **Navegador B**: Navega a `Admin Dashboard → Módulos`

### Pasos
1. En **Navegador A**:
   - Busca un usuario
   - Expande acceso a módulos
   - Marca/desmarca un módulo (ej: "Reportes", "Usuarios", etc)
   - Haz clic en "Guardar"
   - Observa el toast: "Módulos actualizados para [email]"

2. En **Navegador B**:
   - **Importante**: NO recargues la página
   - Busca el mismo usuario
   - Expande acceso a módulos
   - **Resultado esperado**: Los módulos se actualizan automáticamente
   - El checkbox debería cambiar su estado SIN recargar

### Verificación en Consola
En **Navegador B**:
```
[SSE] Notificación de módulos actualizada para usuario: <userId>
[Real-time] Módulos actualizados: {type: 'modules-updated', userId: '...', ...}
```

### Resultado
✅ **ÉXITO**: Ambos navegadores muestran el mismo estado de módulos
❌ **FALLO**: La pestaña B no se actualiza o necesita recargar

---

## Prueba 3: Múltiples Usuarios Simultáneamente

### Setup
1. Abre 3+ navegadores con sesiones de diferentes usuarios
2. Todos navegan a `Admin Dashboard → Permisos`

### Pasos
1. Usuario A cambia permisos de Usuario X
2. Guarda los cambios
3. Verifica que **todos los navegadores** (B, C, D) reciben la actualización

### Resultado
✅ **ÉXITO**: Todos los navegadores se actualizan simultáneamente
❌ **FALLO**: Solo algunos navegadores se actualizan

---

## Prueba 4: Verificación de Eventos SSE en DevTools

### Pasos
1. Abre DevTools en Navegador A (F12)
2. Ve a **Network tab**
3. Filtra por tipo "EventSource" o busca `/events`
4. Deberías ver una conexión abierta: `GET /events`
5. El estado debe ser "101 Switching Protocols" o similar
6. En **Navegador B**, realiza cambios de permisos
7. En la Network tab de **A**, deberías ver los eventos SSE entrantes

### Verificación
- Haz clic en la conexión `/events`
- Ve a la pestaña **Messages**
- Deberías ver mensajes como:
```
event: permissions-updated
data: {"type":"permissions-updated","userId":"...","permissions":{...},"timestamp":"..."}
```

### Resultado
✅ **ÉXITO**: Los eventos SSE aparecen en la Network tab
❌ **FALLO**: No hay eventos o la conexión se cierra

---

## Troubleshooting

### Problema: Los cambios no aparecen en tiempo real

**Posibles causas y soluciones**:

1. **El servidor no está enviando eventos**
   - Verifica en la consola del servidor si ves logs de `[SSE]`
   - Reinicia el servidor: `npm run dev`

2. **La conexión SSE no está activa**
   - Abre DevTools → Network → busca `/events`
   - Si no existe, recarga la página
   - Verifica que el estado sea "101" o similar

3. **Los listeners no están configurados**
   - Abre Console en DevTools
   - Ejecuta: `window.addEventListener('permissions-changed', console.log)`
   - Realiza un cambio de permisos desde otra pestaña
   - Deberías ver el evento logueado

4. **CORS o problemas de conexión**
   - Verifica que `API_BASE_URL` sea correcto
   - Abre Console y busca errores de CORS

### Comando de Debugging

En la consola del navegador, ejecuta:
```javascript
// Ver si hay listeners activos
console.log('Listeners activos:', window._eventListeners)

// Simular un cambio de permisos (para testing)
window.dispatchEvent(new CustomEvent('permissions-changed', {
  detail: { userId: 'test', permissions: {} }
}))

// Ver eventos SSE en tiempo real
const es = new EventSource('http://localhost:3000/events')
es.addEventListener('permissions-updated', (e) => {
  console.log('Evento recibido:', JSON.parse(e.data))
})
```

---

## Checklist de Validación

- [ ] El servidor inicia sin errores
- [ ] La aplicación compila sin warnings relevantes
- [ ] La conexión SSE se establece al cargar la página
- [ ] Los cambios de permisos se aplican en tiempo real
- [ ] Los cambios de módulos se aplican en tiempo real
- [ ] Los toasts de notificación aparecen
- [ ] No hay errores en la consola del navegador
- [ ] No hay errores en la consola del servidor
- [ ] Múltiples usuarios ven actualizaciones simultáneas
- [ ] Los eventos SSE aparecen en Network tab

---

## Reporte de Resultados

Después de ejecutar todas las pruebas, completa este reporte:

**Fecha**: _______________
**Tester**: _______________

| Prueba | Estado | Observaciones |
|--------|--------|---------------|
| Permisos en tiempo real | ✅ / ❌ | |
| Módulos en tiempo real | ✅ / ❌ | |
| Múltiples usuarios | ✅ / ❌ | |
| Eventos SSE en Network | ✅ / ❌ | |
| Consola sin errores | ✅ / ❌ | |

**Resultado General**: ✅ EXITOSO / ⚠️ CON ADVERTENCIAS / ❌ FALLÓ

**Notas Adicionales**:
```
[Escribe aquí cualquier observación o problema encontrado]
```

---

## Pruebas Automáticas (Opcional)

Para automatizar estas pruebas, puedes crear un script:

```javascript
// test-realtime.js
async function testRealtimeUpdates() {
  console.log('Iniciando pruebas de actualización en tiempo real...')
  
  // Conectar al EventSource
  const es = new EventSource('/events')
  let permissionsReceived = false
  let modulesReceived = false
  
  es.addEventListener('permissions-updated', () => {
    permissionsReceived = true
    console.log('✅ Evento permissions-updated recibido')
  })
  
  es.addEventListener('modules-updated', () => {
    modulesReceived = true
    console.log('✅ Evento modules-updated recibido')
  })
  
  // Simular cambios
  console.log('Simulando cambios...')
  // Aquí iría la lógica para realizar cambios
  
  // Esperar y verificar
  await new Promise(r => setTimeout(r, 5000))
  
  console.log(`
  Resultado:
  - Permisos: ${permissionsReceived ? '✅' : '❌'}
  - Módulos: ${modulesReceived ? '✅' : '❌'}
  `)
  
  es.close()
}

testRealtimeUpdates()
```

---

## Contacto y Soporte

Si encuentras problemas o tienes preguntas:

1. Verifica los logs del servidor
2. Revisa la consola del navegador (F12)
3. Consulta el archivo `REALTIME_UPDATES_SOLUTION.md` para detalles técnicos
4. Abre un issue con detalles del problema

¡Gracias por probar!
