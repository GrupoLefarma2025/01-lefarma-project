# Tareas — 00010 Ajustes post-cierre (fecha, hora y logística)

> Vinculada a: [[decisiones/00010_ajustes-post-cierre]]
> Misma división por fases que la decisión: 0 Revisión de diseño, 1 BD, 2 Backend, 3 Frontend, 4 Verificación.
> Dependencia: [[decisiones/00011_hospitales-extraordinarios]] usa este mecanismo para la visita extraordinaria.

## Fase 0 — Revisión de diseño

- [ ] **Revisión del usuario del ADR-00010** (este documento)
- [ ] Resolver los supuestos de Fase 0 del ADR:
  - [ ] Capacidad en modo ajuste: ¿avisa (propuesto) o bloquea?
  - [ ] ¿La fecha ajustada puede salir de la vigencia de la selección? (propuesto: sí, con aviso)
  - [ ] ¿El ajuste de taller toca recursos/costos? (propuesto: no)
  - [ ] ¿Alguien más además del CEM debe ajustar? (propuesto: solo CEM)
  - [ ] Historial de ajustes: botón "Ajustes" propio (propuesto)
  - [x] ¿Se audita también "Solicitar cambio" (cancelación de versión)? — **sí (2026-10-09)**: `CANCELAR_VERSION` en `ajustes_post_cierre`
  - [x] ¿Candados nuevos tipo `es_bloqueado` para rutas/talleres? — **no (2026-10-09)**: el estado final + el permiso bastan; `es_bloqueado` se mantiene como está (ADR-00007)
  - [x] ¿Flujo de autorización (solicitud → CEM aprueba) para ajustes pequeños? — **híbrido (2026-10-09, 3.ª ronda)**: con candado abierto se edita directo; con candado puesto o matriz fuera de captura el equipo **solicita** y el CEM resuelve; el CEM conserva el ajuste directo
  - [x] ¿Límite de tiempo para ajustar? — **`dias_limite_cambio` = 45 (2026-10-09)**, configurable en Parámetros
  - [x] ¿El ajuste de taller sincroniza la visita de ruta? — **sí, automático (2026-10-09)** con revalidación de capacidad
  - [x] ¿Dónde resuelve el CEM las solicitudes? — **Matriz General (2026-10-09)**: pendientes arriba con icono; sin bandeja nueva
  - [x] ¿Notificación de la solicitud? — **in-app (campana/SSE) + correo (2026-10-09)** al CEM y al solicitante (canales existentes)
  - [x] ¿Contenido y destacado de la solicitud? — **`datos_json` (2026-10-09)** + columnas mínimas (`id_solicitud`, `id_taller`, `estado`, auditoría); el destacado en Matriz usa `solicitudCambioPendiente` del DTO del taller (join)

## Fase 1 — Base de datos (script 0027)

- [x] Crear `0027_20261009-1200_educacion-medica_create-ajustes-post-cierre.lefarma.sql` (idempotente, transacción única, estilo 0016/0021)
  - [x] Tabla `educacion_medica.ajustes_post_cierre` con CHECK de `entidad_tipo` (`RUTA_VISITA`|`RUTA_VERSION`|`TALLER`) y `accion` (`MOVER_VISITA`, `EDITAR_HORAS`, `ALTA_VISITA`, `BAJA_VISITA`, `EDITAR_TALLER`, `CANCELAR_VERSION`)
  - [x] Índice `IX_ajustes_post_cierre_entidad (entidad_tipo, id_entidad)`
  - [x] `MS_Description` en tabla y columnas
  - [x] INSERT idempotente del parámetro `dias_limite_cambio` = `45` en `educacion_medica.parametros_modulo` (editable en Parámetros)
  - [x] Tabla `educacion_medica.taller_solicitudes_cambio` (`id_solicitud`, `id_taller` FK, `estado` CHECK `Pendiente|Aprobada|Rechazada|Cancelada`, `datos_json`, auditoría estándar, índices por taller y estado)
- [x] Validar sintaxis con `PARSEONLY` contra LefarmaDev2 (sin ejecutar) _(2026-10-10: PARSEONLY OK con `sqlcmd -f 65001`)_
- [x] **Revisión del usuario del script**
- [x] Ejecutar `0027` en **LefarmaDev2** _(ejecutado por el usuario; verificado por INFORMATION_SCHEMA en Fase 4)_ y en **Lefarma** (prod, con el usuario) _(prod pendiente)_

## Fase 2 — Backend

- [x] `RutasService`: `mover visita` acepta versión `Cerrada` con `rutas.puede_ajustar` + `motivo`; escribe `ajustes_post_cierre` (`MOVER_VISITA`) en la misma transacción
- [x] `PUT /{idRuta}/visitas/{idVisita}/horas` (nuevo: `horaSalida`/`horaLlegada`; normal en `Creada`, auditado en `Cerrada`)
- [x] `POST /{idRuta}/visitas` y `DELETE .../visitas/{idVisita}` extendidos a `Cerrada` con permiso de ajuste + motivo (`ALTA_VISITA`/`BAJA_VISITA`)
- [x] `RutasService.CancelarAsync`: registra `CANCELAR_VERSION` (entidad `RUTA_VERSION`, motivo del request) en `ajustes_post_cierre` sin cambiar el bypass del motor
- [x] Respuesta con `avisos` de capacidad no bloqueantes en modo ajuste
- [x] `TalleresService.UpdateAsync`: `Autorizado`/`Programado` + `talleres.puede_ajustar` + motivo → solo `FechaTaller`, `HoraTaller`, `Lugar`, `NumeroParticipantes`; audita `EDITAR_TALLER`
- [x] Límite temporal en ambos servicios: `dias_limite_cambio` contra la fecha original del taller/visita (fuera del plazo → error explicativo)
- [x] Sincronización taller → ruta al ajustar `FechaTaller`: mueve la visita de la ruta activa (misma `id_seleccion_hospital`; extraordinaria por `id_hospital`) en la misma transacción, revalidando 3/día y 8/semana; conflicto → error y rollback
- [x] `GET /api/educacion-medica/ajustes?entidadTipo=&idEntidad=` (permiso de ver del módulo)
- [x] Solicitudes de cambio: `POST /talleres/{id}/solicitudes-cambio` (equipo/captura asistida; `datos_json`; notifica al CEM) y `POST /talleres/solicitudes-cambio/{id}/resolver {aprobar|rechazar, motivo}` (CEM; al aprobar reutiliza ajuste + sincronización + auditoría; notifica al solicitante); el DTO del taller expone `solicitudCambioPendiente` (join) para ordenar/destacar sin endpoint de listado
- [x] Notificaciones por **in-app + correo** con `INotificationService` (patrón `IncidenciasChecadoNotificacionService`; canal email existente) al crear y resolver _(2026-10-10: **correo deshabilitado temporalmente** — solo in-app; líneas comentadas en `TalleresService` para reactivar)_
- [x] DTOs: `motivo` obligatorio solo en modo ajuste; `avisos` en respuesta
- [x] `[HasPermission]` de los permisos de ajuste en controllers (validación fina en servicio)
- [x] Pruebas unitarias: mover en `Cerrada` con/sin permiso; motivo obligatorio; auditoría antes/después; taller en `Programado` ajustable y `EnCurso` rechazado; límite temporal; sincronización con conflicto → rollback; solicitud crear/resolver (aprobar aplica + sincroniza; rechazar no aplica; notificación emitida); no-regresión en `Creada`
- [x] `dotnet build` 0 errores + `dotnet test` en verde

## Fase 3 — Frontend

- [x] `RutasPage`: banner "documento cerrado" + switch **"Modo ajuste"** visible solo con `rutas.puede_ajustar` en versión `Cerrada`
- [x] Diálogo de motivo por cambio (mover, quitar, agregar, horas) dentro del modo ajuste
- [x] Edición de horas por visita (`horaSalida`/`horaLlegada`)
- [x] Botón **"Ajustes"**: historial de `ajustes_post_cierre` de la versión
- [x] `TallerFormModal`/detalle: edición de fecha/hora/lugar/participantes en `Autorizado`/`Programado` con motivo; badge "Ajustado"; historial de ajustes _(historial de ajustes por fila en Mis talleres; el badge "Ajustado" queda como follow-up: requiere exponer el conteo en el DTO)_
- [x] Aviso al cambiar fecha: "Se moverá la visita de ruta del {origen} al {destino}"; manejo de error por capacidad y por límite de plazo
- [x] `MatrizTalleresTable`/`MisTalleresPage`: indicador discreto de ajustes _(acción "Ajustes" por fila + badge de solicitud pendiente)_
- [x] `MisTalleresPage`: botón contextual **"Solicitar cambio"** cuando el candado está puesto/matriz fuera de captura (modal con diff hacia `datos_json` + motivo) y estado de la solicitud del taller
- [x] `MatrizTalleresPage`: **pendientes arriba con icono** (campo `solicitudCambioPendiente` del DTO) + acción Resolver (Autorizar/Rechazar con motivo); panorama de estados por taller/equipo
- [x] API/tipos: `ajustes.listar`, `solicitudesCambio.*`, parámetros `motivo`/`avisos`
- [x] `tsc` limpio; ESLint en archivos tocados; `vite build` OK

## Fase 4 — Verificación y cierre

- [x] E2E: cerrar rutas → mover visita con motivo → sigue `Cerrada`, auditada y visible en asignaciones/impresión
  _(en vivo 2026-10-10: mover/editar horas/alta/baja sobre la versión Cerrada del escenario, 25/25 checks API + filas en `ajustes_post_cierre`; asignaciones leen la misma visita movida — la impresión no se re-ejecutó visualmente)_
- [ ] E2E: "Solicitar cambio" → el motivo queda persistido (`CANCELAR_VERSION`) y la versión habilita regenerar
  _(cubierto por prueba unitaria `CancelarAsync_Debe_PersistirMotivoEnAjustesPostCierre`; no se ejecutó en vivo para no destruir la versión Cerrada del escenario)_
- [x] E2E: ajustar taller `Autorizado` y `Programado`; verificar rechazo en `EnCurso`/`Realizado`
  _(en vivo: ajuste directo y solicitud aprobada sobre taller `Programado` + cancelación con motivo + historial; el rechazo en `EnCurso`/`Realizado` está cubierto por unit tests)_
- [x] E2E: cambio de fecha de taller dentro de plazo mueve la visita de ruta; fuera de `dias_limite_cambio` → rechazo; conflicto de capacidad → sin cambios parciales
  _(en vivo: límite de 45 días rechazado con mensaje explicativo sobre una visita de ruta; sincronización taller→ruta y conflicto de capacidad cubiertos por unit tests con rollback)_
- [x] E2E: equipo con candado puesto solicita cambio → campana al CEM → taller **arriba con icono** en Matriz General → aprobar aplica (con sincronización si es fecha) y rechazar no cambia nada; el solicitante recibe aviso
  _(en vivo: 28/28 checks; notificaciones in-app verificadas en `app.Notifications`/`app.UserNotifications` (4 filas, categoría `educacion-medica-solicitud-cambio`); el join `solicitudCambioPendiente` visible en el DTO de la Matriz; aprobar aplicó hora + auditoría, rechazar no cambió nada)_
- [x] 403 sin permiso de ajuste (usuario GV/EP normal)
  _(en vivo: usuario sin permisos del módulo → 403 en los 6 endpoints nuevos verificados)_
- [x] Sincronizar `reglas-negocio.md` (§5.5/§5.6, regla de ajustes) y diagramas si aplica
  _(§5.11 nueva + referencias en §5.5/§5.6 + §6.4/§6.5 + §7 `dias_limite_cambio` + glosario JSON; el flujo 000008 incluye las notas de ajuste/solicitud)_
- [x] Marcar ADR-00010 como `Accepted` al aprobarse
  _(aprobado por el usuario el 2026-10-10)_

### Lecciones registradas (2026-10-10)

1. **Encoding de scripts SQL**: la verificación de Fase 4 descubrió que los seeds de permisos (0017/0021/0029) se ejecutaron con codepage equivocado y las concesiones por nombre de rol acentuado no se aplicaron en LefarmaDev2 (solo SuperAdministrador tiene permisos). Los scripts son correctos: deben ejecutarse como UTF-8 (`sqlcmd -f 65001`; en DBeaver, conexión/carga UTF-8). Pendiente decidido por el usuario: no reparar el dev; **re-ejecutar 0017/0021/0029 con UTF-8 al desplegar en Lefarma (prod)**.
2. **Drift preexistente detectado**: `0018` actualiza los defaults de estado de selecciones/rutas_versiones/talleres pero omitió `DF_rutas_estado` de `rutas` (queda `'Draft'` en BD antiguas, valor que el CHECK ya no permite). `0016` sí lo declara `'Creada'`. Corregir con un script puntual si se desea alinear la BD existente.
3. **Verificación 0016 vs incrementales**: en BD vacía `0016` produce el mismo esquema (29 tablas, 0 diferencias de índices/FKs/constraints; 338 `MS_Description` idénticas); únicas diferencias: orden textual de un CHECK (equivalente) y el default `DF_rutas_estado` (0016 correcto).
4. **Sincronización taller→ruta**: mantener la revalidación de capacidad en la misma transacción es lo que evita sobrecupos silenciosos; el aviso de capacidad en modo ajuste de rutas (no bloqueante) quedó bien diferenciado del rechazo duro de la sincronización.
5. **Reutilización de la lógica del ajuste** para resolver solicitudes: un solo camino (`AplicarAjusteAsync`) garantiza auditoría y sincronización idénticas; evitar duplicar reglas.
