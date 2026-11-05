# Tareas — 00018 Candado por taller y solicitudes de cambio de matriz

> Vinculada a: [[decisiones/00018_candado-solicitudes-matriz]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend, 4 Verificación.
> Dependencias: [[decisiones/00006_workflow-seleccion-y-rutas]] (workflow), [[decisiones/00007_modulo-matriz-talleres]] (matriz), [[decisiones/00010_ajustes-post-cierre]] (solicitudes/ajustes), [[decisiones/00015_reparto-ejecutivo-rutas-especialista]] (ruta draft), [[decisiones/00016_calendario-planeacion-talleres]] (UI), [[decisiones/00017_tercera-gerencia-imss-bienestar]] (tercera gerencia).
> Sustituye el workflow de rutas como autorización; la selección y la matriz conservan su flujo.

## Diagramas

> Pendientes en `diagramas/` con numeración `000018_<tipo>_<nombre>`:

- [ ] `000018_flujo_candado_solicitud.html` — matriz autorizada → taller bloqueado → solicitud → aprobación/rechazo → actualización.
- [ ] `000018_estados_candado.html` — selección/ruta/matriz/taller.
- [ ] Opcional Mermaid `000018_flujo_candado_solicitud_mermaid.mmd/.svg`.

## Fase 0 — Planificación

- [x] Decisiones del usuario (2026-10-23): selección + matriz autorizadas; ruta draft; candado por taller; cambios por solicitud de taller.
- [x] Crear ADR-00018 y esta tarea.
- [ ] Revisión del usuario del ADR-00018.
- [ ] Confirmar:
  - [ ] Autorizador de la solicitud: ¿DC (default), GV, CA o el mismo paso final de la matriz?
  - [ ] ¿Se permite cambio de hospital? ¿Dentro de qué alcance? (ADR-00017).
  - [ ] ¿Se permite cambio de producto/cantidad? ¿Afecta costos?
  - [ ] Umbral de costo para exigir reautorización de matriz (default: sin umbral).
  - [ ] ¿La matriz guarda total persistido o se recalcula en lectura?
  - [ ] ¿La ruta/versión se conserva como histórico o se elimina? (propuesto: conservar).

## Fase 1 — Base de datos (script 0036)

> **Estado 2026-10-23:** script 0036 creado; `PARSEONLY` + `NOEXEC` exit 0. Se corrigió `CK_taller_solicitudes_cambio_tipo` moviéndolo a SQL dinámico (misma causa que 0035). Requiere 0035 aplicado (`parametros_modulo.tipo`/`valor_texto`). No ejecutado.

- [x] Crear `lefarma.database/educacion-medica/0036_20261023-1300_educacion-medica_candado-solicitudes-matriz.lefarma.sql` (idempotente).
- [x] `taller_solicitudes_cambio`:
  - [x] `id_matriz_general INT NULL` (trazabilidad; FK a `matrices_generales`).
  - [x] `tipo_solicitud VARCHAR(30)` (`CAMBIO_TALLER`, `CANCELAR_TALLER`, `EXTRAORDINARIO`, `CAMBIO_COSTO`).
  - [x] Índices por `id_matriz_general`/`tipo_solicitud`.
- [x] `matrices_generales`:
  - [x] `fecha_ultima_actualizacion DATETIME2 NULL`.
  - [x] `total_actualizado DECIMAL(18,2) NULL` (snapshot opcional; NULL = calcular en lectura).
- [x] Parámetros:
  - [x] `matriz_requiere_autorizacion` = `true` (sembrado en 0035).
  - [x] `bloqueo_taller_automatico` = `true` (sembrado en 0035).
  - [x] `umbral_cambio_costo_reautorizacion` = 0 (0 = sin umbral).
  - [x] `permite_cambio_hospital` = `true`.
  - [x] `permite_cambio_producto` = `true`.
- [x] `MS_Description` de columnas nuevas.
- [x] `PARSEONLY` exit 0.
- [ ] Revisión del usuario del script.
- [ ] Ejecutar en LefarmaDev2.
- [x] Actualizar `0016` para instalación limpia (columnas, FK, checks e índices).

## Fase 2 — Backend

- [ ] `TalleresService`:
  - [ ] DTO expone `bloqueado` y `solicitudCambioPendiente`.
  - [ ] `UpdateAsync` rechaza edición directa si bloqueado.
  - [ ] `POST /talleres/{id}/solicitudes-cambio` con `tipo_solicitud` y diff ampliado (fecha, hora, hospital, participantes, producto, cantidad).
  - [ ] `POST /talleres/solicitudes-cambio/{id}/resolver {aprobar|rechazar, motivo}`.
  - [ ] Al aprobar:
    - [ ] Aplicar cambio en `talleres`/`taller_recursos`.
    - [ ] Recalcular costo del taller.
    - [ ] Recalcular total de la matriz (o persistir snapshot).
    - [ ] Escribir `ajustes_post_cierre` (`EDITAR_TALLER`/`EDITAR_MATRIZ`).
    - [ ] Actualizar `fecha_ultima_actualizacion`/usuario.
    - [ ] Notificar al solicitante.
  - [ ] Al rechazar: solo motivo + notificación.
- [ ] `MatrizTalleresService`:
  - [ ] DTO con `bloqueado`, `solicitudCambioPendiente`, `deltaCosto`, `totalActualizado`.
  - [ ] Matriz general ordena pendientes arriba.
  - [ ] No reabre workflow.
- [ ] `CalendarioService`: expone `bloqueado`/`solicitudCambioPendiente`.
- [ ] `RutasService`: retirar workflow de rutas (ADR-00015); no hay `enviar-revision`/`firmar`/`cerrar`.
- [ ] `WorkflowService`: solo selección y matriz.
- [ ] Permisos:
  - [ ] `talleres.puede_solicitar_cambio`.
  - [ ] `matriz.puede_autorizar` / `matriz.puede_resolver_cambio`.
  - [ ] Reutilizar `talleres.puede_ajustar`/CEM para ajustes directos.
- [ ] Tests:
  - [ ] Taller bloqueado → edición directa rechazada.
  - [ ] Solicitud → aprobación → cambio aplicado + matriz/totales + auditoría.
  - [ ] Solicitud → rechazo → sin cambios + motivo.
  - [ ] Cambio de fecha no cae en sábado/domingo.
  - [ ] Cambio de hospital valida alcance de extraordinario.
  - [ ] Cambio de producto/cantidad recalcula costo.
  - [ ] Matriz sigue autorizada tras el cambio.
  - [ ] Cambio estructural exige nueva versión/reautorización.
  - [ ] No regresión de ADR-00010.

## Fase 3 — Frontend

> Detalle de implementación: el candado y las solicitudes se integran en [[tareas/00021_frontend-calendario-planeacion-unificado]] y [[tareas/00022_frontend-calendario-vista-tabla-matriz]].

- [ ] `PlaneacionPage`/inspector:
  - [ ] Candado visible en tarjeta/ficha.
  - [ ] “Editar” → “Solicitar cambio” si bloqueado.
  - [ ] Modal `SolicitarCambioModal` con campos permitidos, diff y motivo.
  - [ ] Estado de la solicitud (Pendiente/Aprobada/Rechazada).
- [ ] `MatrizTalleresPage`:
  - [ ] Pendientes arriba con icono.
  - [ ] Acción Resolver (aprobar/rechazar) con motivo.
  - [ ] Mostrar delta de costo y total actualizado.
  - [ ] Historial de cambios/ajustes.
- [ ] `MisTalleresPage`:
  - [ ] Botón “Solicitar cambio” contextual.
  - [ ] Badge de solicitud pendiente.
- [ ] `TallerFormModal`:
  - [ ] Modo bloqueado/solicitud.
  - [ ] Campos permitidos según parámetros.
- [ ] Notificaciones in-app (campana) y correo opcional.
- [ ] `npm run build` y `npm run lint`.

## Fase 4 — Verificación y cierre

- [ ] E2E: autorizar matriz → taller bloqueado → solicitar cambio de hora → aprobar → matriz actualizada y taller re-bloqueado.
- [ ] E2E: solicitar cambio de hospital/producto → validaciones → aprobar/rechazar.
- [ ] E2E: cambio estructural → nueva versión de matriz → reautorización.
- [ ] E2E: sin permiso → 403.
- [ ] `dotnet test`, `npm run build`, `npm run lint` en verde.
- [ ] Actualizar `reglas-negocio.md` §5.11/§5.12 y `presentacion-proceso.md`.
- [ ] Marcar ADR-00018 como `Accepted` al aprobarse.
- [ ] Actualizar diagramas de estados.

## Pendientes fuera de alcance

- [ ] SLA/recordatorio al autorizador si no responde.
- [ ] Reautorización automática por umbral de costo (si se decide).
- [ ] Historial de versiones de matriz con snapshot completo.
- [ ] Correo de notificación (reactivar cuando el área lo pida).
