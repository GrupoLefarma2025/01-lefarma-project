# F2 — Revisión de calidad de código

**Veredicto: BLOCK.** El dato previo pedido: `grep -rE "FromSqlRaw|ExecuteSqlRaw|SqlQuery"` sobre 785 archivos → **0 coincidencias**. El refactor de SQL crudo a LINQ quedó limpio.

## Alta
1. **La transición `borrador → enviada` no existe.** (mismo hallazgo que P0 en F1) La UI además lo enmascara con `ImportarCotizacion.tsx:84` y `:240` (`?? 'enviada'`).

2. **SSRF + archivos servidos sin autenticación.** `CapturasService.cs:140` mete toda la validación dentro del `if (WhitelistDomains.Count > 0)`; con el default vacío no se valida esquema ni dominios. `captura-viaticos.mjs:70-73` también devuelve `true` con lista vacía, y Chromium resuelve `file://`. Las PNG se sirven con `UseStaticFiles` ANTES de `UseAuthentication` (Program.cs:561-575). Mitigaciones reales: requiere token válido, el nombre se sanea (sin traversal) y hay timeout de 120 s.

## Media-alta
3. **El ajuste del admin solo escribe bitácora: `valor_nuevo` no se aplica a nada.** `AprobacionesController.cs:355-390` inserta en `solicitud_ajustes` pero no toca `SolicitudOpcion.FueElegida`, `.Precio` ni `Solicitud.DatosJson`. "Cambiar el vuelo elegido" deja el vuelo anterior; el total del concentrado no se mueve. El test `Ajustar_ConMotivo_ConservaValorAnteriorAplicaValorNuevoYDejaEvento` solo afirma la fila insertada: pasaría igual con el bug.

4. **Índice único + creación de borrador en cada envío → 500 sin mensaje.** `ImportarCotizacion.tsx:70-79` crea un borrador nuevo cada envío sin `solicitudId`; `ViaticosPage.tsx:717` lo monta sin props, así que siempre va por ese camino. `Crear` no captura `DbUpdateException`. El repo tiene precedente en 15 servicios (ej. `SucursalService.cs:161`).

## Media
5. T14/T15 entregados pero inalcanzables (placeholder + editor no montado).
6. Dos `[Fact]` en `Lefarma.IntegrationTests` dependen de internet real (example.com, iana.org, httpbin.org) y Chromium, y su propio docstring dice que son manuales. Sin `[Trait]` ni `Skip`.
7. `url_compra` y `capturas` sin sanear llegan a `href`/`src`: un JSON con `javascript:...` queda persistido y se renderiza. React no filtra `javascript:` en href.
8. Proxy de Nominatim `[AllowAnonymous]` con cuota global de 1 req/s: un anónimo puede agotarla.

## Baja
9. Duplicación real: botón "sin URL" triplicado (TablaOpciones, TablaHoteles, DetalleSolicitudModal); lectura tolerante de `*_json` repetida 3 veces.
10. Comentarios: caracteres chinos en `captura-viaticos.mjs`; comentario de atomicidad en AprobacionesController que no aplica a `SolicitudesController.Crear` (dos SaveChangesAsync); eventos de tipo `enviada` documentados que el backend nunca emite.

## Lo que está bien
Cero SQL crudo. Patrones del repo respetados (ApiResponse, SwaggerOperation, mensaje 403 calcado del precedente). Traversal cerrado con `Path.GetFullPath` + prefijo. Identidad blindada (`GetUserId()` del token, con test de que el body no la sobreescribe). Sin `any`, `@ts-ignore` ni `console.*` en 50 fuentes. El único `eslint-disable` está justificado. Ningún camino devuelve 500 por fallo del script. Tests de backend que afirman sobre HTTP/JSON y estado persistido, con base InMemory propia por archivo.
