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
  - `Features/Archivos/Settings/ArchivosEliminacionSettings.cs` y `appsettings.json` → `ArchivosEliminacion:CorreosAdicionales` (vacío) como **respaldo**.
  - Los correos adicionales se leen primero de la variable `cxp.eliminacion-archivos.correos` (`IConfiguracionRuntimeService`); si no existe o no es válida, se usa `appsettings`. La variable manda.
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

- [ ] Crear la variable `cxp.eliminacion-archivos.correos` en el módulo Configuración (tipo `array`, destino solo Backend) con los correos del negocio. En cuanto exista, manda sobre `appsettings`.
- [ ] Como respaldo, o si se prefiere no crear la variable todavía, capturar los correos en `appsettings` de cada ambiente (`ArchivosEliminacion:CorreosAdicionales`). Mientras ambos estén vacíos, el aviso solo llega al creador de la OC.
- [ ] Publicar y probar en dev: eliminar un archivo de una OC cuyo creador sea otro usuario y confirmar el correo; eliminar un archivo propio y confirmar que no se envía.
- [ ] Correo de muestra enviado el 2026-11-10 a 6@grupolefarma.com.mx generado con el código real (OC-2026-00099, usuario 71) para revisar el formato.

## Criterios de aceptación

- [x] No se envía aviso cuando quien elimina es el creador de la OC.
- [x] Se envía un correo por archivo eliminado (adjuntos de la orden y comprobantes).
- [x] El correo muestra quién eliminó, el nombre del archivo, la fecha y hora y el folio de la OC (cubierto por pruebas).
- [x] El borrado no espera al SMTP ni falla si el envío falla.
- [x] La lista de correos adicionales admite la variable del módulo Configuración y el respaldo de `appsettings`.
- [ ] Prueba real de envío en dev (pendiente, requiere correos y SMTP).
