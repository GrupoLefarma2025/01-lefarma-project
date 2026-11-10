# Tareas — ADR 00002: aviso por correo al eliminar archivos de una OC

Implementa [`decisiones/00002_aviso-eliminacion-archivos-oc.md`](../decisiones/00002_aviso-eliminacion-archivos-oc.md).

Estado al 2026-11-10: implementado y verificado de forma estática (build + tests unitarios). Faltan los correos adicionales y la publicación.

## Fase única — Aviso al eliminar archivos (CxP)

- [x] **T0.1 Soporte de correos explícitos en el canal de notificaciones**
  - `Features/Notifications/DTOs/NotificationDTOs.cs`: `NotificationChannelRequest.Emails`.
  - `Features/Notifications/Services/NotificationService.cs`: suma los correos explícitos validados y deduplica la lista final sin distinguir mayúsculas.
  - Verificación: build sin errores.

- [x] **T0.2 Notificador del aviso**
  - `Features/Archivos/Notifications/`: `ArchivoEliminadoEvento`, `IArchivoEliminacionNotifier`, `ArchivoEliminacionNotifier` y `ArchivoEliminacionDispatch` (fire-and-forget con scope propio).
  - `Features/Archivos/Settings/ArchivosEliminacionSettings.cs` y `appsettings.json` → `ArchivosEliminacion:CorreosAdicionales` (vacío).
  - Regla: solo `EntidadTipo = "OrdenCompra"`; omite si quien elimina es `IdUsuarioCreador`; destinatarios = correo del creador + lista configurada (máximo 10, validados y sin duplicados).
  - Correo con el layout de `ORDEN_COMPRA` de `config.workflow_canal_templates` (o respaldo propio), enlace a `/cxp/ordenes/autorizaciones?idOrden=…`, remitente «Cuentas por Pagar».
  - Verificación: build sin errores.

- [x] **T0.3 Enganche en el borrado**
  - `IArchivoService.DeleteAsync(id, usuarioId)`; `ArchivoService` captura el evento antes del borrado lógico y encola el aviso después.
  - `ArchivosController.Delete` pasa `GetUserId()`; `ComprobanteService` propaga `idUsuario` hasta `DesactivarArchivosComprobanteAsync` y al borrado de cada archivo del comprobante.
  - Verificación: build sin errores.

- [x] **T0.4 Tests unitarios**
  - `tests/Lefarma.UnitTests/Features/Archivos/ArchivoEliminacionNotifierTests.cs` (12 pruebas).
  - Verificación 2026-11-10: `dotnet test --filter FullyQualifiedName~ArchivoEliminacion` → 12/12 en verde (ejecutado en copia sombra porque un servidor local bloquea `bin\Debug`).

## Pendiente para operar

- [ ] Capturar los correos adicionales en `appsettings` de cada ambiente (`ArchivosEliminacion:CorreosAdicionales`). Mientras esté vacío, el aviso solo llega al creador de la OC.
- [ ] Publicar y probar en dev: eliminar un archivo de una OC cuyo creador sea otro usuario y confirmar el correo; eliminar un archivo propio y confirmar que no se envía.
- [ ] Si más adelante se migra la configuración al módulo de variables, cambiar solo la fuente de `CorreosAdicionales`.

## Criterios de aceptación

- [x] No se envía aviso cuando quien elimina es el creador de la OC.
- [x] Se envía un correo por archivo eliminado (adjuntos de la orden y comprobantes).
- [x] El correo muestra quién eliminó, el nombre del archivo, la fecha y hora y el folio de la OC (cubierto por pruebas).
- [x] El borrado no espera al SMTP ni falla si el envío falla.
- [ ] Prueba real de envío en dev (pendiente, requiere correos y SMTP).
