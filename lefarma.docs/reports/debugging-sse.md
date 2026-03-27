# Guía de Debugging - Notificaciones SSE No Llegan

## Problema
Las notificaciones no se actualizan en tiempo real. Solo se ven después de recargar la página (F5).

## Diagnóstico Paso a Paso

### 1. Verificar que el Backend esté corriendo

```bash
# En la terminal del backend
cd lefarma.backend
fuser -k 5134/tcp 2>/dev/null; clear; dotnet run
```

Deberías ver logs como:
```
info: Lefarma.API.Features.Auth.SseService[0]
      SSE connection registered for user 54. Active connections: 1
```

### 2. Verificar Conexión SSE en el Frontend

Abre la consola del navegador (F12 → Console) y busca:

**Conexión exitosa:**
```
[Notifications SSE] Conectando a: http://localhost:5134/api/notifications/stream?token=***
[Notifications SSE] Conexión establecida
```

**Si ves error de conexión:**
```
[Notifications SSE] Error en la conexión
```

### 3. Verificar Eventos SSE en el Navegador

**Abre la pestaña Network (F12 → Network):**

1. Filtra por "stream" o "EventSource"
2. Haz clic en la conexión `/api/notifications/stream`
3. Ve a la pestaña "Event Stream"

Deberías ver eventos periódicos:
```
event: heartbeat
data: {"timestamp":"2026-03-24T..."}

event: connected
data: {"timestamp":"2026-03-24T..."}
```

### 4. Probar SSE Manualmente

**Desde el frontend:**

```typescript
// Abre la consola del navegador y ejecuta:
fetch('/api/notifications/test-sse', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
```

Deberías ver en la consola:
```
[Notifications SSE] Test event received: {...}
```

**Desde el backend (curl):**

```bash
# Reemplaza YOUR_TOKEN con tu JWT token
curl -X POST http://localhost:5134/api/notifications/test-sse \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Logs del Backend

Cuando envías una notificación, deberías ver:

```
info: Lefarma.API.Features.Notifications.Services.NotificationService[0]
      User notification created: UserId=54, NotificationId=123

info: Lefarma.API.Features.Auth.SseService[0]
      ✅ Sent notification event to user 54

info: Lefarma.API.Features.Auth.SseService[0]
      SSE notification sent to user 54 for notification 123
```

**Si ves:**
```
warn: No active SSE connection for user 54. Active users: [otro_id]
```

Significa que **tu usuario no tiene conexión SSE activa**.

### 6. Solución de Problemas Comunes

#### Problema A: "No active SSE connection"

**Causa:** El usuario no tiene una conexión SSE abierta.

**Solución:**
1. Verifica que estés logueado
2. Abre una nueva pestaña/incógnito
3. Logueate nuevamente
4. Busca en la consola: `[Notifications SSE] Conectando a:`

#### Problema B: Evento SSE llega pero no se actualiza la UI

**Causa:** El evento tiene un formato incorrecto.

**Verificar en la consola:**
```
[Notifications SSE] Notificación recibida: {...}
```

Si no ves este log, el evento no tiene el formato correcto.

**Formato esperado:**
```
event: notification
data: {
  "type": "notification",
  "data": {
    "id": 123,
    "notificationId": 456,
    "userId": 54,
    "isRead": false,
    "notification": {
      "id": 456,
      "title": "Test",
      "message": "...",
      ...
    }
  }
}
```

#### Problema C: El contador no se actualiza

**Causa:** `notificationStore.addNotification()` no se está llamando.

**Verificar:**
1. Abre Redux DevTools (o Zustand dev tools)
2. Busca el estado de `notificationStore`
3. Envía una notificación
4. El estado debería cambiar automáticamente

## Test Completo

### Paso 1: Iniciar Backend

```bash
cd lefarma.backend
fuser -k 5134/tcp 2>/dev/null; clear; dotnet run
```

### Paso 2: Iniciar Frontend

```bash
cd lefarma.frontend
npm run dev
```

### Paso 3: Abrir 2 Pestañas del Navegador

1. **Pestaña A:** Logueate como Usuario 1 (vos)
2. **Pestaña B:** Logueate como Usuario 2 (o incógnito)

### Paso 4: Verificar Conexiones SSE

**Ambas pestañas deberían mostrar en consola:**
```
[Notifications SSE] Conexión establecida
```

**Backend debería mostrar:**
```
SSE connection registered for user 54. Active connections: 2
```

### Paso 5: Enviar Notificación

Desde la **Pestaña A**, envía una notificación para el **Usuario 1**:

```typescript
fetch('/api/notifications/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    channels: [
      {
        channelType: 'in-app',
        userIds: [54]  // TU user ID
      }
    ],
    title: 'Test SSE',
    message: 'Si ves esto sin recargar, SSE funciona ✅',
    type: 'info',
    priority: 'normal',
    category: 'system'
  })
})
```

### Paso 6: Verificar Resultados

**En la Pestaña A (vos), deberías ver INMEDIATAMENTE:**

1. **Consola:**
```
[Notifications SSE] Notificación recibida: {id: 123, ...}
```

2. **UI:**
   - El contador de notificaciones se incrementa
   - La notificación aparece en la lista
   - NO necesitaste recargar

**En el Backend:**
```
info: User notification created: UserId=54, NotificationId=123
info: ✅ Sent notification event to user 54
info: SSE notification sent to user 54 for notification 123
```

## Si SIGUE sin Funcionar

### Checklist Completo:

- [ ] Backend corriendo en puerto 5134
- [ ] Frontend corriendo en puerto 5173
- [ ] Usuario logueado (token válido)
- [ ] Conexión SSE establecida (ver console.log)
- [ ] Logs del backend muestran "SSE connection registered"
- [ ] Logs del backend muestran "✅ Sent notification event"
- [ ] Network tab muestra eventos heartbeat
- [ ] No hay errores de CORS
- [ ] No hay errores de autenticación (401)

### Logs para Adjuntar:

1. **Backend Console:** Desde que inicias dotnet run hasta que envías la notificación
2. **Frontend Console:** F12 → Console (todos los logs)
3. **Frontend Network:** F12 → Network → Event Stream (captura de pantalla)

### Comando para Ver Logs SSE Específicos:

```bash
# Filtrar solo logs de SSE
dotnet run 2>&1 | grep -i "sse\|notification"
```

---

## Resumen

El flujo completo es:

```
Frontend envía POST /api/notifications/send
  ↓
Backend crea Notification en DB
  ↓
Backend crea UserNotification en DB
  ↓
Backend llama _sseService.NotifyAsync(userId, "notification", data)
  ↓
SseService busca la conexión SSE del usuario
  ↓
SseService ENVÍA el evento via HTTP
  ↓
Frontend EventSource RECIBE el evento
  ↓
Frontend llama addNotification()
  ↓
notificationStore se actualiza
  ↓
UI se re-renderiza automáticamente
  ↓
¡El contador se incrementa sin recargar!
```

Si alguna parte de este flujo falla, las notificaciones no llegan en tiempo real.
