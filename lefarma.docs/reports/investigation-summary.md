# Resumen de Investigación - Bug de Notificaciones

## Fecha: 2026-03-23

## Problemas Encontrados

### 1. ✅ FIXED: Error "Cannot read properties of undefined (reading 'filter')"

**Ubicación:** `lefarma.frontend/src/store/notificationStore.ts:141`

**Causa:**
El backend devuelve responses que no son siempre arrays (errores, undefined), y el código intentaba hacer `.filter()` sin validar.

**Fix Aplicado:**
```typescript
const safeNotifications = Array.isArray(notifications) ? notifications : [];
const unreadCount = safeNotifications.filter((n) => !n.isRead).length;
```

### 2. ❌ IDENTIFICADO: Bucle Infinito de SSE

**Síntoma:**
```
[Notifications SSE] Conectando a: http://localhost:5134/api/notifications/stream?token=***
[Notifications SSE] Desconectando...
[Notifications SSE] Conectando a: http://localhost:5134/api/notifications/stream?token=***
[Notifications SSE] Desconectando...
```

**Logs del Backend:**
```
15:05:45 INF] SSE connection registered for user 21. Active connections: 1
15:05:46 INF] SSE connection removed for user 21. Active connections: 0
15:05:46 INF] SSE connection closed for user 21
15:05:46 INF] GET /api/notifications/stream - Establishing SSE connection for user 21
```

**Causa Raíz:**
En `lefarma.frontend/src/hooks/useNotifications.ts`:
- Las funciones `connect`, `disconnect`, `handleOpen`, `handleError` son `useCallback` con dependencias
- Estas dependencias cambian en cada render, recreando las funciones
- El useEffect en línea 269 tiene `[autoConnect, isAuthenticated, token]` como dependencias
- Cuando se re-ejecuta, hace cleanup primero (línea 267): `disconnectRef.current?.(false)`
- Esto cierra la conexión SSE
- Luego vuelve a llamar a `connectRef.current?.()`
- Bucle infinito

**Patrón de Reconexión:**
1. Conexión establecida (< 1 segundo)
2. Inmediatamente cerrada por cleanup del efecto
3. Reconectada inmediatamente
4. Repetición infinita

### 3. ✅ VALIDADO: Login Funciona Correctamente

**Usuario:** 54
**Password:** tt01tt
**Dominio:** Grupolefarma

**Endpoints Probados:**
- ✅ `/api/auth/login-step-one` - Devuelve dominios disponibles
- ✅ `/api/auth/login-step-two` - Genera token JWT válido
- ✅ `/api/notifications/user/21` - Devuelve array vacío `[]`
- ⚠️ `/api/notifications/stream` - Se conecta pero se cierra inmediatamente por el bug del frontend

## Próximos Pasos

### Para Arreglar el Bucle Infinito de SSE:

**Opción 1: Usar useRef para Referencias Estables**
```typescript
// En lugar de useCallback con dependencias, usar useRef
const connect = useCallback(() => {
  // Leer valores actuales de refs directamente
}, []); // Sin dependencias
```

**Opción 2: Quitar Token de las Dependencias del useEffect**
```typescript
useEffect(() => {
  if (autoConnect && isAuthenticated) {
    connectRef.current?.();
  }
  return () => {
    disconnectRef.current?.(false);
  };
}, [autoConnect, isAuthenticated]); // Quitar 'token'
```

**Opción 3: Usar una Flag para Evitar Reconexión Innecesaria**
```typescript
const hasConnectedRef = useRef(false);

useEffect(() => {
  if (autoConnect && isAuthenticated && !hasConnectedRef.current) {
    connectRef.current?.();
    hasConnectedRef.current = true;
  }
  return () => {
    hasConnectedRef.current = false;
    disconnectRef.current?.(false);
  };
}, [autoConnect, isAuthenticated]);
```

## Archivos Modificados

1. `lefarma.frontend/src/store/notificationStore.ts` - Fix validación de array
2. `lefarma.frontend/tests/login.spec.ts` - Test de Playwright (creado)
3. `lefarma.frontend/playwright.config.ts` - Config Playwright (creado)

## Recomendación

El bug del bucle infinito de SSE es CRÍTICO y debe arreglarse antes de continuar. El problema está en el archivo `lefarma.frontend/src/hooks/useNotifications.ts` líneas 66-269.

Se recomienda usar el **Opción 2** como solución más simple: quitar `token` de las dependencias del useEffect ya que el token se lee directamente del store dentro de la función `connect`.
