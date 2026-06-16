# Guía de Pruebas: Optimizaciones de Rendimiento

## Introducción

Este documento proporciona pasos detallados para verificar que las optimizaciones de rendimiento funcionan correctamente.

---

## Prueba 1: Optimización de PermissionsManagement

### Objetivo
Verificar que los cambios de permisos en la lista de usuarios se procesan rápidamente sin lag.

### Pasos

1. **Acceder al módulo**
   ```
   1. Abrir aplicación en http://localhost:5173
   2. Navegar a Admin Dashboard → Permisos
   3. O acceder directamente a /admin/permisos
   ```

2. **Abrir DevTools Profiler**
   ```
   1. Abrir DevTools (F12)
   2. Ir a tab "Profiler" (o instalar React DevTools extension)
   3. Hacer clic en "Record"
   ```

3. **Cambiar Permisos**
   ```
   1. Buscar un usuario en la caja de búsqueda
   2. Hacer clic para expandir la tarjeta del usuario
   3. Hacer clic en varios checkboxes de permisos
   4. Observar responsividad
   ```

4. **Analizar Resultados**
   ```
   1. Detener grabación en Profiler
   2. Buscar componente "PermissionsManagement"
   3. Observar que:
      - Render time < 100ms
      - Que los cambios son inmediatos (sin lag)
      - Que NO se re-renderizan todos los usuarios
   ```

### Criterios de Éxito
✅ El cambio de un checkbox es inmediato (sin delay)
✅ No hay lag visible al hacer varios cambios seguidos
✅ El Profiler muestra que solo se re-renderiza el componente afectado

---

## Prueba 2: Optimización de PermissionModules

### Objetivo
Verificar que el cambio de módulos es rápido y responsivo.

### Pasos

1. **Acceder al módulo**
   ```
   1. Navegar a Admin Dashboard → Módulos
   2. O acceder directamente a /admin/modulos
   ```

2. **Realizar Cambios**
   ```
   1. Expandir la tarjeta de varios usuarios
   2. Hacer clic en checkboxes de módulos
   3. Observar que todo es responsivo
   ```

3. **Guardar Cambios**
   ```
   1. Hacer clic en "Guardar" después de cambios
   2. Verificar que el guardado es rápido
   3. Verificar que el toast de éxito aparece
   ```

### Criterios de Éxito
✅ Cambios en módulos son inmediatos
✅ No hay lag al expandir múltiples usuarios
✅ Guardar toma < 1 segundo

---

## Prueba 3: Optimización de Dashboard

### Objetivo
Verificar que los cálculos de estadísticas son eficientes.

### Pasos

1. **Acceder al Dashboard**
   ```
   1. Navegar a /dashboard
   2. Abrir DevTools Console
   3. Abrir React DevTools Profiler
   ```

2. **Verificar Cálculos Iniciales**
   ```
   1. Observar que las tarjetas de estadísticas aparecen rápidamente
   2. Registrar el tiempo de render en el Profiler
   3. Tiempo esperado: < 200ms
   ```

3. **Cambiar Fecha (si aplica)**
   ```
   1. Si hay selector de fecha en el dashboard
   2. Cambiar la fecha seleccionada
   3. Observar que los números se actualizan sin lag
   ```

### Criterios de Éxito
✅ Tarjetas de estadísticas cargan en < 200ms
✅ Cambios de filtro son inmediatos
✅ No hay cálculos redundantes en el Profiler

---

## Prueba 4: Optimización de AdminDashboard (Tab Switching)

### Objetivo
Verificar que cambiar entre tabs en el Admin Dashboard es rápido.

### Pasos

1. **Acceder a Admin Dashboard**
   ```
   1. Navegar a /admin/dashboard
   2. Abrir DevTools Profiler
   ```

2. **Cambiar Entre Tabs**
   ```
   1. Hacer clic en tab "Resumen"
   2. Observar tiempo de carga
   3. Hacer clic en tab "Permisos"
   4. Hacer clic en tab "Módulos"
   5. Hacer clic en tab "Auditoría"
   ```

3. **Medir Performance**
   ```
   1. En el Profiler, buscar cambios de tabs
   2. Tiempo para cada cambio debe ser < 100ms
   3. Verificar que solo el contenido activo se renderiza
   ```

### Criterios de Éxito
✅ Tab switching es rápido (< 100ms)
✅ No hay parpadeo o retraso
✅ Los contenidos que no están visibles no se re-renderizan

---

## Prueba 5: Verificación de Real-time Updates

### Objetivo
Asegurar que las optimizaciones no rompieron la funcionalidad de real-time.

### Pasos

1. **Abrir Dos Sesiones**
   ```
   1. Abrir navegador en /admin/permisos con usuario Admin (Sesión A)
   2. Abrir incógnita en /admin/permisos con otro usuario (Sesión B)
   ```

2. **Cambiar Permiso en Sesión A**
   ```
   1. En Sesión A: Cambiar un permiso de un usuario
   2. Hacer clic en "Guardar"
   3. Verificar que aparece toast de éxito
   ```

3. **Verificar Actualización en Sesión B**
   ```
   1. En Sesión B: Debe recibir actualización en tiempo real
   2. Debe ver el cambio sin necesidad de recargar
   3. Los permisos deben cambiar automáticamente
   ```

### Criterios de Éxito
✅ Los cambios se propagan en tiempo real
✅ No hay necesidad de recargar página
✅ Todos los usuarios conectados ven la actualización
✅ No hay lag al mostrar cambios en tiempo real

---

## Prueba 6: Prueba de Estrés

### Objetivo
Verificar que el rendimiento se mantiene con muchos usuarios.

### Pasos

1. **Acceder a PermissionsManagement**
   ```
   1. Navegar a /admin/permisos
   2. Abrir DevTools Console
   3. Abrir Profiler
   ```

2. **Cambios Rápidos**
   ```
   1. Expandir varias tarjetas de usuarios
   2. Hacer clic rápidamente en múltiples checkboxes
   3. Observar que mantiene responsividad
   4. Registrar memoria en DevTools
   ```

3. **Analizar Memory**
   ```
   1. Tomar screenshot de memoria usada
   2. Hacer 50 cambios rápidos
   3. Tomar otro screenshot de memoria
   4. Verificar que memoria no crece excesivamente
   ```

### Criterios de Éxito
✅ Sistema mantiene responsividad con muchos cambios
✅ Memoria no crece más de 20% en prueba de estrés
✅ No hay crashes o freezes

---

## Herramientas Recomendadas

### React DevTools Profiler
```
1. Instalar: Chrome Web Store → "React Developer Tools"
2. Usar: Pestaña "Profiler" en DevTools
3. Grabar cambios y analizar render times
```

### Chrome Performance Tab
```
1. Abrir DevTools
2. Performance tab
3. Grabar durante cambios
4. Analizar: User Interaction → Rendering
```

### Lighthouse Audit
```
1. DevTools → Lighthouse
2. Run audit para "Performance"
3. Revisar scores antes/después de cambios
```

---

## Métricas a Monitorear

| Métrica | Objetivo | Herramienta |
|---------|----------|------------|
| Render Time | < 100ms | React Profiler |
| FCP (First Contentful Paint) | < 1s | Lighthouse |
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse |
| Memory Usage | Estable | DevTools Memory |
| FID (First Input Delay) | < 100ms | Lighthouse |

---

## Checklist de Validación

- [ ] PermissionsManagement cambios son inmediatos
- [ ] PermissionModules cambios son inmediatos  
- [ ] Dashboard estadísticas cargan rápido
- [ ] AdminDashboard tab switching es fluido
- [ ] Real-time updates funcionan correctamente
- [ ] Prueba de estrés sin problemas de memoria
- [ ] No hay mensajes de error en console
- [ ] Funcionalidad no está rota

---

## Reporte de Problemas

Si encuentras alguno de estos problemas:

### ❌ Lag al cambiar permisos
**Causa probable**: UserPermissionCard no se memoizó correctamente
**Solución**: Verificar que React.memo esté aplicado con comparación personalizada

### ❌ Números incorrectos en Dashboard
**Causa probable**: useMemo no se reinicia cuando debe
**Solución**: Verificar dependencias en array de useMemo

### ❌ Tab switching lento
**Causa probable**: LoadingFallback se renderiza múltiples veces
**Solución**: Verificar que está fuera del render loop

### ❌ Real-time no funciona
**Causa probable**: Event listeners no se limpian correctamente
**Solución**: Verificar cleanup en useEffect return

---

## Conclusión

Estas pruebas validan que las optimizaciones están funcionando correctamente. Realizar estas pruebas regularmente asegura que el rendimiento se mantiene óptimo.

**Tiempo estimado de pruebas completas**: 30-45 minutos
