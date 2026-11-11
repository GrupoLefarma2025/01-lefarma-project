---
fecha_creacion: 2026-11-10
fecha_modificacion: 2026-11-10
resumen: Aviso por correo al creador de una orden de compra (y a correos adicionales configurables) cuando otra persona elimina un archivo de la orden, en CxP.
---

## Status

Accepted (acordado con el usuario el 2026-11-10 durante la planeación de K-28).

## Índice

1. [Contexto](#1-contexto)
2. [Decisión](#2-decisión)
3. [Reglas](#3-reglas)
4. [Implementación](#4-implementación)
5. [Correo](#5-correo)
6. [Consecuencias](#6-consecuencias)
7. [Anexo: evidencia](#7-anexo-evidencia)

## 1. Contexto

En CxP los archivos de una orden de compra se administran desde la bandeja de autorizaciones (`/cxp/ordenes/autorizaciones`): adjuntos de la orden (carpeta `ordenes-compra`) y comprobantes de gasto/pago (carpeta `comprobantes`). Cualquier usuario con acceso a la bandeja puede eliminar un archivo ajeno: el borrado es lógico (el registro queda `activo = 0` y el archivo físico se renombra a `_inactivo`) y el creador de la orden no se entera.

El usuario pidió avisar por correo al **creador** más los correos de una variable del nuevo sistema de configuración, al eliminar cualquier archivo y siempre que quien elimine no sea el creador. El correo debe mostrar de forma clara qué usuario eliminó qué archivo, a qué hora y de qué OC.

## 2. Decisión

1. **«Creador» = `OrdenCompra.IdUsuarioCreador`**: quien capturó la orden en `/cxp/ordenes/crear`, que la bandeja muestra como «Solicitante». No es el usuario que subió el archivo.
2. Si quien elimina es ese creador, **no se envía ningún correo** (ni siquiera a los correos adicionales), tal como se pidió.
3. **Un correo por archivo eliminado**, incluido el borrado masivo de comprobantes.
4. Los correos adicionales se leen del **módulo de variables de configuración** (`cxp.eliminacion-archivos.correos`, tipo `array` de correos, disponible solo para Backend). Mientras la variable no exista o no esté disponible, se usa como respaldo la lista de `appsettings` (`ArchivosEliminacion:CorreosAdicionales`); el usuario lo resumió como «de momento en el appsettings» el 2026-11-10. Si la variable existe, **manda** sobre appsettings (aunque esté vacía).
5. El aviso se dispara en el **único punto de borrado** (`ArchivoService.DeleteAsync`), que cubre tanto la bandeja como la eliminación de comprobantes.
6. El envío es **desacoplado del request** (fire-and-forget con scope propio): el borrado no espera al SMTP ni falla si el correo truena.

## 3. Reglas

- Solo archivos con `EntidadTipo = "OrdenCompra"` (adjuntos y comprobantes). Los demás módulos no generan aviso.
- Si no hay destinatarios (creador sin correo activo y lista adicional vacía) se registra el hecho y no se envía nada.
- Los correos adicionales se recortan, validan, deduplican y se topan a **10**: el registro de canal tiene un tope de 500 caracteres y el aviso no debe romper por una lista mal capturada.
- La variable `cxp.eliminacion-archivos.correos` se consulta con `IConfiguracionRuntimeService` (solo variables activas, disponibles para Backend y con caché de 5 minutos). Si no existe, no es del tipo esperado o la base falla, se usa la lista de `appsettings`.
- El **reemplazo** de archivo (`ReemplazarAsync`) no genera aviso: no elimina, solo inactiva el anterior.
- El correo no sustituye la bitácora: además queda el registro `app.Notifications` / `app.NotificationChannels` del envío.
- La hora del aviso es la hora local del servidor (`DateTime.Now`), igual que el renombrado actual de archivos.

## 4. Implementación

| Pieza | Archivo |
|---|---|
| Punto de enganche y captura del evento | `Features/Archivos/Services/ArchivoService.cs` |
| Regla de destinatarios y armado del correo | `Features/Archivos/Notifications/ArchivoEliminacionNotifier.cs` |
| Envío fuera del request | `Features/Archivos/Notifications/ArchivoEliminacionDispatch.cs` |
| Configuración de correos adicionales | `IConfiguracionRuntimeService` (variable `cxp.eliminacion-archivos.correos`) + `Features/Archivos/Settings/ArchivosEliminacionSettings.cs` y `appsettings.json` como respaldo |
| Soporte de correos explícitos en notificaciones | `Features/Notifications/DTOs/NotificationDTOs.cs` + `Features/Notifications/Services/NotificationService.cs` |
| Propagación del usuario que elimina | `Features/Archivos/Controllers/ArchivosController.cs` + `Features/Facturas/ComprobanteService.cs` |

Decisiones de implementación:

- **Un solo hook** evita duplicar la regla entre la bandeja y los comprobantes; cualquier flujo futuro que borre por `IArchivoService` queda cubierto.
- **El evento se captura antes del borrado** porque después la entidad queda inactiva y el `DbContext` del request se destruye; el notificador recibe datos planos y vuelve a consultar la orden y los usuarios en su propio scope.
- **El scope nuevo** evita usar el contexto de base de datos del request desde un hilo de fondo y aísla el fallo del envío.
- **La variable manda sobre appsettings** para que el negocio pueda cambiar destinatarios sin publicar; el respaldo mantiene el aviso funcionando mientras la variable no exista.

## 5. Correo

- **Asunto**: `Archivo eliminado — {folio}` (el folio ya incluye el prefijo `OC-`).
- **Cuerpo**: la frase del requisito («El usuario X eliminó el archivo Y el dd/mm/aaaa a las hh:mm hrs, de la orden de compra Z») más una tabla con archivo, tipo, quién eliminó, fecha y hora, quién lo subió y tamaño.
- **Layout**: el de correo del proceso `ORDEN_COMPRA` en `config.workflow_canal_templates` (encabezado, cuerpo, botón y pie de Grupo Lefarma), con un HTML de respaldo propio si el layout no existe. Nombres y archivo se codifican con `WebUtility.HtmlEncode`.
- **Enlace**: `{AppSettings:FrontendBaseUrl}/cxp/ordenes/autorizaciones?idOrden={idOrden}`. No se usa `url_button` de la plantilla porque en BD apunta a la ruta vieja `/autorizaciones?idOrden=`.
- **Remitente visible**: «Cuentas por Pagar»; categoría `cxp-archivo-eliminado`, tipo `warning`.

## 6. Consecuencias

**Positivas**

- El creador se entera de inmediato si alguien más borra evidencia de su orden, con los datos suficientes para reclamar o reponer el archivo.
- La regla vive en un solo lugar y cubre adjuntos y comprobantes sin cambios de frontend ni de base de datos.
- El borrado conserva su tiempo de respuesta aunque el SMTP esté lento o caído.

**Negativas**

- El borrado masivo de comprobantes genera un correo por archivo (decisión explícita del usuario), lo que puede producir ráfagas de correos.
- Los correos adicionales quedan vacíos hasta que se capten en la variable o en `appsettings`; mientras tanto el aviso solo llega al creador.
- Mientras se use el respaldo de `appsettings`, un cambio de destinatarios requiere publicar configuración en cada ambiente.

**Neutras**

- Si la variable no existe, el respaldo de `appsettings` mantiene el funcionamiento; cuando se cree la variable, toma el control sin tocar código.
- Si el layout de correo se edita en la base, el aviso cambia con él.
- Los errores de SMTP quedan en el log del API y no afectan la eliminación.

## 7. Anexo: evidencia

- `ArchivoService.DeleteAsync` es el único camino de borrado: lo llaman `ArchivosController.Delete` y `ComprobanteService.DesactivarArchivosComprobanteAsync` (este último desde eliminar comprobante, eliminar por orden y eliminar la última asignación).
- `AutorizacionesOC.tsx` muestra `solicitanteNombre` desde `idUsuarioCreador` (columna «Solicitante»), y el archivo se sube con `EntidadTipo = "OrdenCompra"` tanto en `ordenes-compra` como en `comprobantes`.
- Consulta de solo lectura del 2026-11-10: `config.variables` está vacío en `LefarmaDev` y en `Lefarma` (producción), así que la variable `cxp.eliminacion-archivos.correos` debe crearse desde el módulo Configuración (clave `cxp.eliminacion-archivos.correos`, tipo `array`, destino Backend). Mientras no exista, aplica el respaldo de `appsettings`.
- Consulta de solo lectura del 2026-11-10: `config.workflow_canal_templates` tiene el layout de correo de `ORDEN_COMPRA` y su `url_button` apunta a `/autorizaciones?idOrden={IdEntidad}` (ruta anterior a la reorganización `/cxp/...`).
- Decisiones del usuario que fijan el alcance: «quien creo la orden desde aqui /cxp/ordenes/crear», «el que dice solicitante aqui /cxp/ordenes/autorizaciones», «1 correo por archivo» y «de momento en el appsettings».
