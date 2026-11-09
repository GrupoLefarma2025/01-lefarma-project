# Tareas - 00014 Cotizaciones de viáticos por ruta (tabla liga por visita)

> Vinculada a: [[decisiones/00014_cotizaciones-por-ruta-viaticos]]
> Extiende la Fase 4 de [[decisiones/00013_planeacion-personal-viaticos]].
> Regla del usuario: **no tocar la BD**; los scripts quedan para revisión y aplicación posterior.

## Fase 0 - Plan y revisión

- [x] Decisión del usuario: **bloquear visitas** ya incluidas en otra cotización activa.
- [x] Decisión del usuario: **tabla liga** (relación por visita), ubicada en `viaticos`.
- [x] Decisión del usuario: **mostrar todas** las cotizaciones de la ruta.
- [x] Decisión del usuario: **dejar intacto** el borrador legado (no backfill; no tocar la BD).
- [x] Decisión del usuario: **incluir el costo** en esta fase (persistir opciones/total).
- [ ] Revisión del usuario del ADR, esta tarea y el script SQL.

## Fase 1 - Scripts SQL (revisión, sin aplicar)

- [x] Crear `0012_20261022-1200_viaticos_solicitud-origen-em-visita.lefarma.sql`:
  - [x] Tabla `viaticos.solicitud_origen_em_visita` (`id_solicitud` FK, `id_ruta`, `id_ruta_visita`, `id_seleccion_mensual`, `fecha_creacion`; PK `(id_solicitud, id_ruta_visita)`).
  - [x] Índices `(id_ruta, id_ruta_visita) INCLUDE (id_solicitud, id_seleccion_mensual)` y `(id_solicitud) INCLUDE (id_ruta, id_ruta_visita)`.
  - [x] Extended properties (MS_Description) de tabla/columnas.
  - [x] **Sin backfill, sin borrados y sin columnas nuevas en `educacion_medica`.**
- [x] Validar sintaxis con PARSEONLY (sin ejecutar).
- [ ] Revisión del usuario y aplicación en LefarmaDev2/prod (la hace el usuario).
- [x] Crear `0013_20261022-1400_viaticos_eliminar-cotizacion-duplicada.lefarma.sql` para el borrador legado 14 (soft delete con guards; no se aplica solo).
- [x] Validar 0013 con PARSEONLY.

> **Antes de probar el handoff o el panel de cotizaciones hay que aplicar 0012.** Sin la tabla liga, los endpoints nuevos responden error de SQL y el frontend cae a "Por cotizar".

## Fase 2 - Backend Viáticos

- [x] Entidad `SolicitudOrigenEmVisita` + configuración EF + DbSet.
- [x] `POST /api/viaticos/solicitudes/desde-educacion-medica`:
  - [x] Requiere `viaticos.solicitar`.
  - [x] Valida ruta/visitas y conjunto no vacío.
  - [x] Reutiliza un `borrador` de la ruta con el **conjunto exacto** de visitas.
  - [x] Bloquea visitas en cotizaciones activas (`borrador`, `enviada`, `autorizada`, `autorizada_con_ajustes`) → 409 con detalle (visita, solicitud, folio, estado).
  - [x] Crea solicitud + filas de liga con un solo `SaveChanges` dentro de una transacción `Serializable` en SQL Server (InMemory no la usa).
  - [x] Reutiliza la lógica actual de folio/personas.
  - [x] Respuesta `{ id_solicitud, folio, reutilizado }`.
- [x] `GET /api/viaticos/solicitudes/por-ruta/{idRuta}`:
  - [x] Devuelve **todas** las cotizaciones de la ruta (folio, estado, total, `num_puntos`, fecha, `id_ruta_visitas`).
  - [x] Solo dueño o `viaticos.ver_todos`.
- [x] `PUT /solicitudes/{id}/opciones`: persiste opciones y **total** en `datos_json.total`; transición a `enviada`.
- [x] Pruebas (`SolicitudesControllerTests`, 24/24):
  - [x] Dedupe exacto y creación de una segunda cotización con visitas distintas.
  - [x] Bloqueo con folio en el mensaje.
  - [x] Listado por ruta con total y `id_ruta_visitas`.
  - [x] Total persistido en `datos_json` junto con el resto del snapshot.

## Fase 3 - Frontend Viáticos (costo)

- [x] `solicitudesApi.guardarOpciones` calcula el **total cotizado** como la suma de las opciones con precio y lo envía en `cotizacion.total` (si no hay precios, se omite y queda "Sin cotización").
- [x] El backend lo persiste en `datos_json.total` sin perder el snapshot.
- [x] Lo usan los flujos existentes de cotización (`CalculosViajeModal` y `ImportarCotizacion`), que ya llamaban `guardarOpciones`.
- [ ] El asistente de la solicitud (`SolicitudPage`) sigue guardando solo el borrador; la cotización se envía desde **Mis viajes**. Si se quiere cotizar dentro del asistente, es un incremento posterior (no se duplica el cotizador en dos pantallas).

## Fase 4 - Frontend Educación Médica

- [x] Handoff al nuevo endpoint `desde-educacion-medica`; se eliminó la dedupe por `misSolicitudes`/JSON.
- [x] Panel **"Cotizaciones de la ruta"**: todas, con folio, estado, destinos, costo y acción.
- [x] Columna **"Cotización"** por hospital: folio + estado; múltiples con `+N` y `title` con el detalle; "—" si no.
- [x] Modal:
  - [x] Visitas en cotización activa: checkbox deshabilitado + badge `En VIA-… (Estado)`.
  - [x] Checks de día y "Seleccionar todos" solo sobre visitas disponibles.
  - [x] Aviso de visitas bloqueadas con el folio que las contiene.
  - [x] Sin coordenadas sigue deshabilitado con aviso y "Copiar lista".
- [x] Botón "Cotizar viáticos": crea una nueva cotización si el conjunto es distinto; reutiliza el borrador exacto; maneja 409 mostrando el mensaje del backend.
- [x] Enlaces: borrador → `/viaticos/solicitud/:id`; enviada/autorizada → `/viaticos/mis-viajes`.
- [x] La métrica del encabezado muestra el conteo de cotizaciones (o "Por cotizar").

## Fase 5 - Verificación y cierre

- [ ] E2E visual (lo hace el usuario): ruta → 10 hospitales → cotización 1; otros 10 → cotización 2; repetir una visita → bloqueada; reintentar el mismo conjunto → reutiliza.
- [x] Folio/estado/costo visibles en el panel y por hospital (código; pendiente verificación visual).
- [x] `dotnet build`: 0 errores.
- [x] `SolicitudesControllerTests`: 24/24.
- [x] `npm run build`: correcto.
- [x] ESLint de los archivos modificados: sin errores.
- [x] `viaticosHandoff.test.ts`: 2/2.
- [x] Suite backend completa: 491/494 unitarias y 21/22 de integración; los 4 fallos son preexistentes (3 `RutasServiceTests` por fechas fijas vencidas y 1 `CapturasManualQa` por red).
- [x] Suite frontend completa: 399/405; los 6 fallos son preexistentes (`PermissionGuard`, `baseapp-routes`, `dashboard.smoke`) y hay 1 suite de script con error de sintaxis ajena a este cambio.
- [ ] Marcar ADR-00014 como `Accepted` (queda `Proposed` hasta la revisión del usuario).

## Limpieza del duplicado

- Script `0013_20261022-1400_viaticos_eliminar-cotizacion-duplicada.lefarma.sql`:
  - [x] Default `@IdSolicitud = 14` (legado, sin `origenEm`).
  - [x] Guards: activo, estado `borrador`, origen `educacion_medica`, sin `origenEm`, sin opciones cotizadas.
  - [x] Soft delete (`activo = 0`) + evento `eliminada`; reversible.
  - [x] PARSEONLY OK; **no aplicado**.
  - [ ] El usuario lo revisa y ejecuta.

## Prerrequisitos y riesgos

- **Permisos**: `viaticos.solicitar` para crear/consultar lo propio; `viaticos.ver_todos` para consultar ajenos. El usuario asignará la matriz.
- **0012 pendiente de aplicar**: la tabla liga no existe todavía en las bases; sin ella los endpoints nuevos fallan en runtime. No se aplicó por regla del usuario.
- **Borradores legados** (14/15): sin filas de liga; no participan en dedupe/bloqueo. El 14 se elimina con 0013; el 15 se conserva. El usuario decide si lo cotiza o lo elimina después.
- **Costo**: el total de la cotización es la suma de opciones con precio. Comidas/extras quedan en el snapshot y no se suman al total mostrado en el panel. Si se requiere el total de viaje completo, es un incremento posterior.
- **Cotización persistida**: el asistente guarda el borrador; la cotización se envía desde Mis viajes. Hasta que se cotice, el panel muestra "Sin cotización".
- **Bloqueo concurrente**: transacción `Serializable` en SQL Server; InMemory (pruebas) la omite.
- **Estados activos**: centralizados en el backend; si Viáticos agrega estados, revisar la regla.
- **No tocar la BD**: 0012 y 0013 no se aplicaron.

## Criterios de aceptación

- Una ruta puede tener 2+ cotizaciones con subconjuntos distintos.
- Reintentar el mismo conjunto reutiliza el borrador (sin duplicar).
- Una visita en cotización activa no se puede volver a cotizar (UI + backend).
- El panel muestra todas las cotizaciones con folio/estado/costo; la tabla marca la cotización por hospital.
- El costo aparece cuando la cotización se guarda; antes "Sin cotización".
- Sin cambios aplicados a la BD; scripts SQL listos para revisión.
