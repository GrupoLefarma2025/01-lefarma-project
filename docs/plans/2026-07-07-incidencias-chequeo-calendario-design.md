# Diseño: Incidencias de Chequeo en el Calendario

## Resumen
Separar las incidencias de checado del endpoint `/calendario/laboral` y pintarlas en el calendario del frontend como badges independientes, con un modal de detalle al hacer clic. Ambos endpoints de calendario (`/solicitudes-personal/calendario` y `/api/rh/incidencias-checado`) obtendrán el usuario autenticado desde el backend.

## Cambios en el Backend

### 1. `/api/rh/incidencias-checado`
- El controlador leerá `idUsuario` desde `ClaimTypes.NameIdentifier` y lo pasará al servicio/repositorio.
- El request solo recibirá `anio` y `mes`; el backend calculará el rango de fechas (`fecha inicio de mes` a `fecha fin de mes`).
- El repositorio ya resuelve `idUsuario → correo → nómina`, por lo que no es necesario enviar nómina desde el frontend.

### 2. `/solicitudes-personal/calendario`
- El controlador leerá `idUsuario` desde claims.
- El servicio filtrará por `idUsuarioCreador` internamente.
- El frontend dejará de enviar `idUsuarioCreador` en el request.

### 3. `/calendario/laboral`
- `CalendarioService` dejará de consultar el repositorio de incidencias.
- `CalendarioLaboralResponse` perderá todos los campos relacionados con incidencias (`TieneIncidenciaEntrada`, `TieneIncidenciaSalida`, `IncidenciaEntrada`, `IncidenciaSalida`, `MsgError`, `Entrada`, `Salida`, `Entro`, `Salio`).
- Solo devolverá información de día laborable/no laborable.

## Cambios en el Frontend

### 1. Nuevos tipos y API
- Agregar `IncidenciaChecadoResponse` en `solicitudPersonal.types.ts` con los campos del backend.
- Crear `incidenciasChecadoApi.get({ anio, mes })` apuntando a `/api/rh/incidencias-checado`.

### 2. `MiCalendario.tsx`
- Realizar 3 llamadas en paralelo:
  - `/solicitudes-personal/calendario`
  - `/calendario/laboral`
  - `/api/rh/incidencias-checado`
- Indexar incidencias por fecha.
- Crear `IncidenciaBadge`: badge con ícono de alerta y texto breve, similar a `EventoBadge`.
- Crear `IncidenciaModal`: modal pequeño que muestra fecha, incidencia entrada/salida, horarios y mensaje de error.
- Eliminar el popover de incidencias anterior.

### 3. Limpieza de tipos
- Remover los campos de incidencia de `CalendarioLaboralResponse`.
- Remover `idUsuarioCreador` del request de calendario de solicitudes.

## Flujo de Datos
```
MiCalendario
  ├─ GET /solicitudes-personal/calendario?anio={a}&mes={m}   → eventos (badges de solicitud)
  ├─ GET /calendario/laboral?anio={a}&mes={m}                → días no laborables
  └─ GET /api/rh/incidencias-checado?anio={a}&mes={m}        → incidencias (badges de alerta)
```

Ambos endpoints de calendario leen el `idUsuario` del token JWT en el backend.

## Manejo de Errores
- Cualquiera de las 3 llamadas puede fallar independientemente; las otras dos se pintan igual.
- Se mantiene el toast de error actual para errores distintos a 403.

## Criterios de Éxito
- `/calendario/laboral` ya no incluye campos de incidencia.
- `/api/rh/incidencias-checado` devuelve incidencias filtradas por usuario autenticado y rango de mes.
- `/solicitudes-personal/calendario` filtra por usuario autenticado sin recibir `idUsuarioCreador`.
- El calendario muestra badges de incidencia con ícono de alerta y un modal de detalle.
- `dotnet build` y `npm run build` pasan sin errores.
