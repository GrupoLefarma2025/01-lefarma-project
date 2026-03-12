---
status: completed
created: 2026-03-11
updated: 2026-03-12
assignee: Sisyphus
---

# Task-001: Sincronización de Usuario en Tiempo Real con SSE

## Descripción

Implementar un mecanismo de sincronización bidireccional entre el backend y frontend para mantener los datos del usuario actualizados en tiempo real. Cuando ocurran cambios en el nombre o permisos del usuario, el backend debe notificar al frontend mediante Server-Sent Events (SSE) para refrescar la información de inmediato.

## Problema Actual

El frontend almacena los datos del usuario en Zustand y localStorage, pero no existe un mecanismo para actualizar estos datos cuando cambian en el backend. Esto puede causar:
- Información desactualizada del usuario (nombre, avatar, etc.)
- Permisos obsoletos que no reflejan cambios recientes
- Necesidad de recargar la página para ver cambios

## Requisitos

### Backend

- [ ] Crear endpoint SSE para suscripción a eventos de usuario
- [ ] Implementar servicio de notificación de cambios de usuario
- [ ] Detectar cambios en:
  - Nombre del usuario
  - Permisos/roles asignados
  - Información de perfil
- [ ] Enviar eventos SSE cuando detecte cambios

### Frontend

- [ ] Implementar conexión SSE en el cliente
- [ ] Sincronizar datos en 2 pasos:
  1. **Paso 1**: Actualizar Zustand store (estado reactivo)
  2. **Paso 2**: Persistir en localStorage (persistencia)
- [ ] Manejar reconexión automática si se pierde la conexión SSE
- [ ] Actualizar UI inmediatamente al recibir eventos

## Criterios de Aceptación

- [ ] Cuando un administrador cambia el nombre de un usuario, el frontend del usuario afectado se actualiza sin recargar
- [ ] Cuando se modifican permisos de un usuario, su frontend refleja los nuevos permisos inmediatamente
- [ ] Los datos del usuario persisten en localStorage y se cargan al iniciar la aplicación
- [ ] La conexión SSE se reconecta automáticamente si falla
- [ ] El token JWT sigue siendo válido durante la sesión
- [ ] No hay parpadeos ni inconsistencias en la UI durante actualizaciones

## Flujo de Sincronización

```
┌─────────────┐      Cambio        ┌─────────────┐
│   Admin     │ ──────────────────>│   Backend   │
│  (Modifica) │                     │   (Detecta) │
└─────────────┘                     └──────┬──────┘
                                           │
                                           │ SSE Event
                                           ▼
                                    ┌─────────────┐
                                    │  Frontend   │
                                    │  (Recibe)   │
                                    └──────┬──────┘
                                           │
                        ┌──────────────────┼──────────────────┐
                        │                  │                  │
                        ▼                  ▼                  ▼
                 ┌──────────┐      ┌────────────┐     ┌──────────┐
                 │  Paso 1  │      │   Paso 2   │     │   Paso 3 │
                 │ Zustand  │─────>│ localStorage│────>│   UI     │
                 │  Update  │      │   Persist  │     │  Refresh │
                 └──────────┘      └────────────┘     └──────────┘
```

## Endpoints Propuestos

### Backend

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `api/auth/sse` | Conexión SSE para eventos de usuario |

### Eventos SSE

```json
{
  "event": "user.updated",
  "data": {
    "type": "profile" | "permissions",
    "user": {
      "id": "guid",
      "nombre": "string",
      "email": "string",
      "permisos": ["string"]
    }
  }
}
```

## Dependencias

- Ninguna (primera tarea)

## Estimación

- **Backend**: 4 horas
- **Frontend**: 3 horas
- **Testing**: 2 horas
- **Total**: ~9 horas

## Notas Técnicas

### Consideraciones

1. **Escalabilidad**: Considerar usar Redis Pub/Sub si hay múltiples instancias del backend
2. **Seguridad**: Validar que el usuario solo se suscriba a sus propios eventos
3. **Performance**: Usar heartbeat para mantener conexiones activas
4. **Fallback**: Si SSE no está disponible, usar polling como alternativa

### Tecnologías a Usar

- **Backend**: ASP.NET Core Server-Sent Events
- **Frontend**: EventSource API nativa del navegador

## Referencias

- [MDN: Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [ASP.NET Core SSE](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/signalr)
