# F1 — Auditoría de cumplimiento de plan

**Veredicto: BLOCK.** Ejecutada por un reviewer con acceso de solo lectura, escéptica por defecto.

## Hallazgos bloqueantes

- **P0 — El flujo nunca llega de `borrador` a `enviada`; la autorización es inalcanzable.**
  `SolicitudesController.cs:99` crea siempre en `borrador`; `GuardarOpciones` persiste opciones y evento pero NUNCA asigna `Estado`. No existe `Estado = "enviada"` en todo el backend. `AprobacionesController` exige `enviada` para autorizar/rechazar (409 si no). `AprobacionesBandejaTable.tsx` deja Autorizar deshabilitado. El frontend además MIENTE: `ImportarCotizacion.tsx:84` pone `estado:'enviada'` en el estado local, así que la UI dice "enviada" mientras la BD dice `borrador`. El test que lo cubre pasa porque el MOCK devuelve ese estado falso — el defecto está oculto por el propio test.

- **P1-1 — La lista blanca está vacía, así que el guardarraíl de "no scraping a Booking/Expedia" NO se cumple.**
  `appsettings.json:80` → `"WhitelistDomains": []`. `CapturasService.cs:131` solo valida si `Count > 0`. `captura-viaticos.mjs:52-56` lista comentada → `isUrlWhitelisted` devuelve `true` siempre.

- **P1-2 — "Ver opciones" abre un placeholder.** `ViaticosRoutes.tsx:22` monta `BandejaAprobacionesPage` sin `onVerOpciones`; `BandejaAprobacionesPage.tsx:222-241` muestra literalmente "se habilita en la entrega T14". `BandejaAprobacionesConDetalle.tsx` (el host correcto) existe y no lo importa nadie.

- **P1-3 — El editor de ajustes no está montado.** `EditorAjustes.tsx` completo con 16 tests, `grep` → solo se importa a sí mismo. El administrador no tiene ningún lugar desde donde ajustar.

- **P1-4 — El concentrado no sale de datos persistidos.** `ConcentradoViaticosPrint.tsx` NO existe. `CostosViaticosPrint.tsx:59-65,87` sigue recibiendo `respuesta` en memoria. No hay test de regresión de los 20 viajes contra $276,357.00.

- **IS-2 parcial — la cascada no es de primera clase.** `PuntoMapaPicker.tsx:270` la deja en `<details>` colapsada; `SelectorRutaModal.tsx:296-304` los dos tabs renderizan el MISMO componente, el tab es decorativo.

## Cumplido (verificado con archivo:línea)
IS-1, IS-3, IS-4, IS-10, IS-11, IS-12 verificados. IS-6 estructura verificada pero bloqueada en flujo por P0. IS-7 componente bien y probado pero no alcanzable. IS-8 API completa pero UI no montada.

## Guardarraíles
Respetados: educacion-medica (solo extracción de helper, sin cambio de comportamiento), viatico_tarifas, CalculoCostosRuta.cs, sin `[Authorize(Roles=)]`, sin dependencias npm nuevas, sin matriz de roles inventada.
Desviaciones: `Program.cs` (+38/-4, todo aditivo: using, HttpClient, DI, UseStaticFiles, `public partial class Program{}`), `appsettings.json` (sección CapturasSettings). El guardarraíl de no-scraping INCUMPLIDO por la whitelist vacía. appsettings.Development.json `LefarmaDev` = cambio previo del usuario, no de este trabajo.

## Otros
Índice único `(usuario, periodo, estado)` impide dos solicitudes del mismo usuario en el mismo mes. Dos scripts con prefijo `0003_` en la misma carpeta rompen la convención de orden. `playwright` importado sin declarar en package.json. Evidencia incompleta (faltan task-2, task-3, task-6, task-14, task-16).
