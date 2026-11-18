---
fecha_creacion: 2026-11-13
fecha_modificacion: 2026-11-13
resumen: Bitácora inmutable de archivos eliminados o reemplazados (metadatos en SQL y binario en carpeta privada) para que el historial muestre quién y cuándo borró, con corrección del desfase UTC del aviso. Atiende el ticket Freshdesk #6987.
---

## Status

Accepted (elegido por el usuario el 2026-11-13: opción A, «metadatos en SQL y archivo en carpeta privada», y hacer todo junto con la corrección del ticket).

## Índice

1. [Contexto](#1-contexto)
2. [Decisión](#2-decisión)
3. [Reglas](#3-reglas)
4. [Implementación](#4-implementación)
5. [Consecuencias](#5-consecuencias)
6. [Anexo: evidencia](#6-anexo-evidencia)

## 1. Contexto

El ticket #6987 reporta que al eliminar un archivo «funciona el log de eliminación, pero la fecha/hora y usuario no son correctas». La investigación del 2026-11-12 y 13 encontró tres causas distintas:

- `archivos.Archivos` no tiene columnas de baja. El borrado solo pone `Activo = 0` y renombra el binario a `_inactivo` en la misma carpeta de `wwwroot`, que se sirve de forma anónima.
- El modal «Historial de cambios · Documentos adjuntos» muestra la fecha y el usuario de **subida**, no del borrado, porque no existe otro dato. El propio texto de la pantalla lo advertía.
- El correo de aviso sí conoce al eliminador (claim de la sesión) y la hora local del borrado, pero imprime la fecha de subida guardada en UTC sin convertir: en México se ve 6 horas adelantada.

No hay trigger, auditoría ni job que capture la baja: `logs.audit_logs` no tiene filas de `/archivos` porque el middleware solo audita eventos enriquecidos con `EntityType`, y `ArchivoService` no lo hace.

El usuario pidió conservar histórico de los archivos borrados «en binario» y eligió la opción A: metadatos en SQL y archivo en carpeta privada.

## 2. Decisión

1. Nueva tabla **`archivos.ArchivosEliminados`**, inmutable, con una fila por baja (eliminación o reemplazo). Guarda el contexto completo del archivo, la ruta histórica, el hash SHA-256, quién y cuándo subió, quién y cuándo eliminó, y el motivo. La fecha de baja admite `NULL`: las bajas migradas desde los archivos ya inactivos no tienen fecha conocida.
2. El binario se **mueve** a `{ArchivosSettings:PrivatePath}/eliminados/{aaaa}/{MM}/`, fuera de `wwwroot`, sin servicio estático anónimo. El binario **no** se guarda en SQL.
3. La baja lógica y la bitácora se guardan en el **mismo `SaveChanges`**.
4. `DownloadAsync` y `PreviewAsync` resuelven la ruta histórica desde la bitácora para los archivos eliminados; los borrados anteriores a este cambio siguen resolviéndose por el nombre `_inactivo` en `BasePath`.
5. El correo convierte la fecha de subida de UTC a la hora local del servidor.
6. El modal muestra «quién eliminó · fecha y hora», distingue «Eliminado» de «Reemplazado» y deja la subida como dato secundario.

## 3. Reglas

- Motivos: `Eliminacion` (DELETE del archivo, incluida la eliminación de comprobantes) y `Reemplazo` (subida de una nueva versión del mismo archivo).
- La bitácora no se actualiza ni se borra desde la aplicación.
- Si el binario ya no existe al momento de la baja, la fila se registra con `HashSha256` y `RutaHistorica` nulos y se deja advertencia en el log.
- Los borrados anteriores al cambio (225 al 2026-11-13, ~148 MB) no tienen usuario ni fecha recuperables; la pantalla los muestra como «Sin registro de quién lo eliminó».
- Para que esos archivos aparezcan en el historial, el script 061 copia sus metadatos con `FechaEliminacion` e `IdUsuarioElimina` en `NULL`; no se inventan fechas ni usuarios.
- La retención del histórico no se automatiza en esta entrega; la carpeta privada entra en el respaldo del servidor.
- El aviso por correo conserva sus reglas del ADR 00002 (solo OC, no avisa si elimina el creador).

## 4. Implementación

| Pieza | Archivo |
|---|---|
| Tabla y índice | `lefarma.database/060_alter_archivos_crear_bitacora_eliminados.sql` |
| Fecha nula y poblado histórico | `lefarma.database/061_alter_archivos_bitacora_poblar_eliminados.sql` |
| Entidad y mapeo | `Domain/Entities/Archivos/ArchivoEliminado.cs`, `Infrastructure/Data/Configurations/Archivos/ArchivoEliminadoConfiguration.cs` |
| Baja lógica + bitácora en una transacción | `Infrastructure/Data/Repositories/ArchivoRepository.cs` |
| Movimiento del binario, hash y resolución de ruta | `Features/Archivos/Services/ArchivoService.cs` |
| Datos para el historial | `Features/Archivos/DTOs/ArchivoListItemResponse.cs` |
| Conversión UTC → local del correo | `Features/Archivos/Notifications/ArchivoEliminacionNotifier.cs` |
| Pantalla | `lefarma.frontend/src/pages/ordenes/AutorizacionesOC.tsx`, `src/types/archivo.types.ts` |

## 5. Consecuencias

**Positivas**

- El historial ya tiene dato propio de la baja (usuario y fecha), que es exactamente lo que pedía el ticket.
- Los archivos eliminados antes del cambio también aparecen en el historial, con sus metadatos de subida y el enlace a su binario, aunque sin usuario ni fecha de baja.
- El binario eliminado deja de ser accesible por URL anónima; se sirve solo por los endpoints autenticados de descarga y previsualización.
- El hash permite verificar integridad y detectar alteraciones del histórico.
- La bitácora es autocontenida: sobrevive aunque la fila operativa cambie o se purge en el futuro.

**Negativas**

- Cambio de esquema en producción: el script debe aplicarse antes de publicar el backend.
- El disco del servidor crece con los históricos (~148 MB de los borrados actuales, sin política de retención definida).
- Los borrados previos quedan sin usuario ni fecha; no hay forma fiable de reconstruirlos.
- El binario se mueve antes del guardado: si la escritura en base falla, el archivo queda en la carpeta privada sin fila de bitácora y debe recuperarse a mano.

**Neutras**

- El reemplazo ahora también mueve el binario y genera bitácora; antes solo lo renombraba a `_inactivo`.
- La restauración desde la bitácora no se expone en la aplicación; se hace manual sobre la carpeta privada.
- El correo del ADR 00002 no cambia de reglas, solo de formato en el renglón «Subido por».

## 6. Anexo: evidencia

- Ticket Freshdesk #6987, actualizado el 2026-11-12T19:17:51Z: «Al eliminar un archivo en el sistema de órdenes perfectamente funciona el log de eliminación, pero la fecha/hora y usuario no son correctas».
- Producción, `archivos.Archivos` (solo lectura, 2026-11-12/13): 14 columnas sin campos de baja; 1626 filas, 225 inactivas, `SUM(TamanoBytes)` de inactivas = 154,874,274 bytes; sin triggers; primer inactivo 2026-06-12 15:46:25 y último 2026-11-12 17:58:53.
- Producción, `app.Notifications` Id 11068 (aviso real del 2026-11-12 18:52:51 UTC): muestra «Eliminado por Diego Angel Villaseñor Garduño … 12/11/2026 a las 12:52 hrs» (correcto) y «Subido por Marco Polo Narvaez Oropeza el 27/10/2026 18:23 hrs» cuando la hora local de subida era 12:23.
- `logs.audit_logs`: 0 filas con `ruta_endpoint` de `/archivos`; `WideEventLoggingMiddleware` solo persiste eventos con `EntityType` y `ArchivoService` no lo enriquece.
- `dbo.ordenes_compra_eliminadas` ya usa el patrón de snapshot con `fecha_eliminacion`; se usó como referencia de nomenclatura, sin copiar su enfoque de tabla duplicada.
