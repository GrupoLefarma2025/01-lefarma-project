# viaticos-wizard-ruta-pi-busqueda - Work Plan

## TL;DR (For humans)

**Who this is for and what changes for them:** Cualquier especialista que tenga que salir puede capturar su propio viaje en un wizard de cuatro pasos, elegir entre buses, vuelos y hoteles con precios, links de compra y capturas reales, y enviarlo. Un administrador recibe todo en una tabla, lo autoriza una por una, ve incluso las opciones que el especialista descartó, y puede ajustar costos o cambiar de vuelo dejando rastro.

**What you'll get:** Un mapa donde se arma la ruta punto por punto, con dos formas de buscar destino (un buscador global, o la cascada por estado y municipio, ambas igual de válidas). Dos tablas comparables de vuelos y hoteles. Una bandeja de aprobación. Una vista de las opciones rechazadas con sus capturas. Un editor de costos con motivo obligatorio. Y el concentrado imprimible con el mismo formato exacto de los Excel de octubre.

**Why this approach:** Se reutiliza el selector de mapa y los dos buscadores que ya existen y ya tienen pruebas, en vez de rehacerlos. El concentrado se arma desde la base de datos, no desde lo que hay en pantalla, para que reimprimir mañana dé lo mismo. Y los precios nunca se presentan como reales cuando son estimados: cada fila dice de dónde salió.

**What it will NOT do:** No se conecta a Amadeus ni a Google Maps: la investigación la hace el agente `pi` con un prompt versionado, sin costo por consulta. No se raspa Booking niвало airlines. No se define todavía quién ve qué más allá del superadmin. Y no se toca el módulo de educación médica ni se commitea nada sin tu autorización.

**Effort:** XL
**Risk:** High - la solicitud toca cálculo, base de datos, impresión y permisos a la vez, y el concentrado impreso es un documento que va a firma de dirección.
**Decisions to sanity-check:** que el concentrado salga solo de solicitudes autorizadas; que los ajustes del administrador no borren el valor original del solicitante; que `pi` declare explícitamente qué transportistas no encontró en vez de dar por hecho que los cubrió.

Your next move: run the high-accuracy review, or start execution with `/ulw-execute`.

---

> TL;DR (machine): XL / High — 17 implementation todos en 5 olas + 4 verificadores finales; wizard, mapa con secuencia, cotizacion por agente, capturas, API, bandeja de aprobacion, editor con auditoria, print FOR-008 y ADR.

## Scope
### Affected user and ideal state

**Affected user:** (1) **el especialista solicitante** — cualquier empleado que deba salir; hoy no tiene ninguna herramienta, solo una calculadora tecnica de una pantalla. (2) **el perfil administrador** (hoy superadmin) — revisa, autoriza una por una y ajusta costos; hoy no hay bandeja ni aprobacion. (3) **`pi`** — agente externo al que se le pide la investigacion; hoy no existe en el repo. (4) **el siguiente programador** — hereda el codigo y el ADR.

| Row | Statement | Reason |
| --- | --- | --- |
| IS-1 | Cualquier especialista captura SU viaje en un wizard de 4 pasos sin ayuda externa | Pedido: "los especialistas o cualquiera dentro de la empresa que requiera salir, pueda meterse y cargar su destino" |
| IS-2 | La busqueda de destino tiene DOS caminos de primera clase: buscador global tipo Google Maps, y cascada opcional Estado -> Municipio -> Texto | Pedido literal: "la cascada es opcional. se puede buscar directamente con un buscador global, o con la cascada" |
| IS-3 | En un modal con mapa, el especialista arma la SECUENCIA de puntos: clic inserta el siguiente, marcadores numerados y polylinea los une en orden; puede reordenar, editar y eliminar | Pedido: "agregar la salida, despues agregar el siguiente punto"; "para que salga este modal con el mapa" |
| IS-4 | Al calcular ve TABLAS comparables de vuelos y hoteles de paso, cada opcion con link de compra y captura de pantalla | Pedido: "un boton de calcular... una tabla con los vuelos, caputras de pantalla, hoteles de paso" |
| IS-5 | El especialista ELIGE su opcion y la envia; su eleccion queda registrada con las alternativas que descarto | Pedido: "unos costos. el mismo pueda seleccionar el que deseee" |
| IS-6 | Lo enviado llega al admin en una tabla donde cada fila tiene al menos dos botones: Autorizar (uno por uno) y Ver opciones | Pedido: "una tabla con un par de botones, como autorizar uno por uno, y ver las opciones" |
| IS-7 | "Ver opciones" muestra TODO lo ofrecido a esa persona, incluido lo rechazado, con todas sus capturas | Pedido: "(las que rechazaron) con todo y las capturas" |
| IS-8 | El admin puede cambiar vuelo, cambiar costos, agregar partidas y quitarlas; cada cambio deja rastro de que, cuando y por que | Pedido: "puede cambiar el vuelo, o los costos, agregar algun costo extra, o quitar... cambiar por otros vuelos" |
| IS-9 | El concentrado se IMPRIME con formato identico a ASK-ADM-FOR-008: encabezado Nombre/Gerencia/Fecha, tabla de renglones No./Solicitante/Fecha/Origen/Destino/Transporte{Autobus,Avion}/Automovil propio/Hospedaje/Comida/Taxi/Total, fila de totales, bloque REVISOx3 + AUTORIZO | Pedido: "similar a los exceles, de hecho se va a imprimir un formato identico" |
| IS-10 | Todo persiste en SQL Server: solicitudes, opciones, seleccion, ajustes, estado de autorizacion | DECIDIDO por el usuario |
| IS-11 | Si un proveedor no responde, la fila lo dice explicitamente; nunca un precio inventado como real | Tracker T4: "Unknown prices remain unknown, not zero" |
| IS-12 | No se degrada nada de lo que ya funciona: print actual, ejemplos FOR-007/008, compartir viaje, 12 km/L, catalogo de municipios | AGENTS.md + trabajo T1-T4 ya verde |
| GAP-1 | No hay wizard: todo en un `Card` de 637 lineas | IS-1 |
| GAP-2 | La cascada vive colapsada dentro de `PuntoMapaPicker`; no es camino de primera clase | IS-2 |
| GAP-3 | El mapa esta embebido inline y solo admite UN punto; sin polylinea ni reordenamiento | IS-3 |
| GAP-4 | Vuelos y hoteles se renderizan como `<ul>` de texto; los vuelos son FABRICADOS (formula, sin proveedor) | IS-4 |
| GAP-5 | No existe ninguna captura de pantalla en el producto | IS-4 |
| GAP-6 | No existe prompt de pi ni contrato de intercambio | IS-4 |
| GAP-7 | El autocompletado actual viola la politica de Nominatim (prohibido en cliente) | IS-2 + riesgo verificable |
| GAP-8 | No existe flujo de solicitud: nada se guarda, nadie recibe nada, no hay identidad del solicitante | IS-1, IS-5, IS-10 |
| GAP-9 | No existe bandeja de autorizacion | IS-6 |
| GAP-10 | No hay vista de opciones rechazadas | IS-7 |
| GAP-11 | El administrador no puede editar nada | IS-8 |
| GAP-12 | El print actual no replica ASK-ADM-FOR-008 y se arma desde estado en memoria, no desde datos persistidos | IS-9 |

### Must have
- Wizard de 4 pasos con barra de progreso, montado sobre `ViaticosPage.tsx`.
- `SelectorRutaModal` con Leaflet: marcadores numerados, `Polyline`, reordenar/editar/eliminar.
- Dos buscadores first-class en tabs: global y cascada, alimentando el mismo `PuntoSeleccion`.
- Sustitucion del autocompletado Nominatim-en-navegador por patron conforme a politica (proxy backend cacheado, User-Agent identificable, 1 req/s).
- Tablas comparables de vuelos y hoteles con columna `fuente`, link de compra y captura.
- Prompt versionado de `pi` en `lefarma.docs/viaticos/prompts/` + JSON Schema + importador pegable.
- Worker Playwright de capturas contra la URL de compra.
- SQL nuevo: solicitudes, opciones, seleccion, ajustes, estado; mas almacenamiento de capturas.
- API de solicitudes y de autorizacion.
- Bandeja de autorizacion para el perfil admin.
- Vista de opciones rechazadas con capturas.
- Edicion de costos/vuelo por admin con rastro de auditoria.
- Print ASK-ADM-FOR-008 generado desde datos persistidos.
- Permisos `viaticos.solicitar` / `.ver_todos` / `.autorizar` / `.ajustar` via `Permissions` + `TienePermiso`.
- ADR que reconcilia ADR-00003 con la capa de busqueda.
- Tests Vitest nuevos y actualizacion de los existentes.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- NO tocar el modulo `educacion-medica` (`RutasPage`, `HospitalesMap`, `BandejaAprobacionesPage`, `AprobacionesController`). Se LEEN como precedente, no se modifican.
- NO tocar `educacion_medica.viatico_tarifas` ni las tablas de catalogo existentes: el SQL nuevo solo AGREGA tablas.
- NO cambiar `CalculoCostosRuta.cs` mas alla de etiquetar `fuente` en los vuelos.
- NO modificar `Program.cs` globalmente (serializer, policies, reloj).
- NO usar `[Authorize(Roles = ...)]` ni `RequireAdministrator`: **no existen** (0 coincidencias en 724 archivos). Solo `Permissions` + `TienePermiso`.
- NO tocar `lefarma.backend/src/Lefarma.API/appsettings.Development.json`, `odd/tasks/costos-ruta-formulario.md` ni `pruebas de gastos/`.
- NO commits, push, PR ni tags sin OK explicito del usuario (el tracker dice "NO commits while iterating").
- NO scraping de Booking/Expedia/aerolineas: viola terminos de uso. Solo paginas publicas de resultado y deep-links de transportista.
- NO agregar `maplibre-gl`, `react-map-gl`, `@react-google-maps/api`, `@tanstack/react-query` ni proveedor de vuelos/hoteles en runtime.
- NO implementar la matriz completa "quien ve que" (pospuesta explicitamente por el usuario).
- NO refactor de `educacionMedicaApi.regiones` ni del catalogo de municipios.
- NO reducir el alcance a un "v1" o "MVP": el estado ideal completo es el objetivo, no un subconjunto.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: **tests-after** + Vitest 3.2.4 (framework ya instalado, `npm run test -- --reporter=verbose`). El tracker `odd/tasks/costos-ruta-formulario.md` declara TDD como UNCONFIRMED, asi que no se inventa TDD. Backend: xUnit via `dotnet test lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter FullyQualifiedName~<Clase>`.
- Evidencia: `.omo/evidence/` con `task-<N>-viaticos-wizard-ruta-pi-busqueda.<ext>` por todo (JUnit XML para backend, salida de vitest + capturas de Playwright para frontend).
- Dirty-worktree guard: antes de la ola 1, `git status --short` DEBE seguir mostrando exactamente tres rutas (`appsettings.Development.json`, `odd/tasks/costos-ruta-formulario.md`, `pruebas de gastos/`). Si aparece cualquier otra ruta modificada, el todo se detiene.
- F3 usa Playwright real (`@playwright/test ^1.58.2` ya instalado) contra `npm run dev -- --port 5180 --strictPort`, con el patron de `lefarma.frontend/tests/login.spec.ts` para el login.

## Execution strategy
### Parallel execution waves
- **Ola 1 (fundacion, 5 todos):** T1 permisos y constantes, T2 buscador global + cascada conforme a politica, T6 prompt de pi + JSON Schema, T7 worker Playwright de capturas, T12 script SQL de solicitudes. Sin dependencias entre si: son la base y no dependen entre si.
- **Ola 2 (nucleo de datos, 4 todos):** T3 modal de mapa con secuencia, T8 configuracion de Playwright en el proyecto + API de capturas, T9 API de solicitudes, T13 API de autorizacion y ajustes. Depende de ola 1.
- **Ola 3 (experiencia del especialista, 3 todos):** T4 wizard de 4 pasos, T5 tablas de vuelos y hoteles con fuentes, T10 importador del JSON de pi + seleccion y envio. Depende de olas 1-2.
- **Ola 4 (experiencia del admin, 3 todos):** T11 bandeja de autorizacion, T14 vista de opciones rechazadas con capturas, T15 editor de costos/vuelo con auditoria. Depende de olas 1-3.
- **Ola 5 (cierre, 2 todos):** T16 print ASK-ADM-FOR-008 desde datos persistidos, T17 ADR + fixtures de regresion contra los 20 viajes de octubre. Depende de todo.
- **Ola final:** F1-F4 en paralelo.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 permisos | - | T13, T14, T15 | T2, T6, T7, T12 |
| T2 buscadores | - | T3 | T1, T6, T7, T12 |
| T6 prompt pi | - | T5, T10 | T1, T2, T7, T12 |
| T7 worker capturas | - | T8 | T1, T2, T6, T12 |
| T12 SQL | - | T9, T13, T16 | T1, T2, T6, T7 |
| T3 modal mapa | T2 | T4 | T8, T9, T13 |
| T8 API capturas | T7 | T5, T14 | T3, T9, T13 |
| T9 API solicitudes | T1, T12 | T4, T10, T16 | T3, T8, T13 |
| T13 API autorizacion | T1, T12 | T11, T14, T15 | T3, T8, T9 |
| T4 wizard | T3, T9 | T5, T10 | T11 |
| T5 tablas | T6, T8 | T10 | T4 |
| T10 importador+envio | T4, T5, T9 | T11, T14 | - |
| T11 bandeja | T10, T13 | T14, T15 | T16 |
| T14 ver rechazadas | T11 | - | T15 |
| T15 editor admin | T11, T13 | T16 | T14 |
| T16 print FOR-008 | T15, T9 | - | T17 |
| T17 ADR + fixtures | T16 | - | - |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. Permisos `viaticos.*` y contexto del solicitante
  What to do / Must NOT do: Anadir clase `Viaticos` en `Shared/Constants/AuthorizationConstants.cs` con `Solicitar = "viaticos.solicitar"`, `VerTodos = "viaticos.ver_todos"`, `Autorizar = "viaticos.autorizar"`, `Ajustar = "viaticos.ajustar"`. Anadir el script SQL que inserta esos codigos en `app.Permisos` (fuente de verdad segun el comentario del archivo). Implementar helper `TienePermiso` reutilizando el patron de `AprobacionesController.cs:34`. Anadir `GetUserId(ClaimsPrincipal)` para leer la identidad del solicitante en el backend. Must NOT do: crear `[Authorize(Roles=...)]` ni policies nuevas en `Program.cs`; `RequireAdministrator` NO EXISTE en el codebase.
  Closes: GAP-8 (parcial: identidad), IS-10
  Parallelization: Wave 1 | Blocked by: - | Blocks: T9, T13
  References: `lefarma.backend/src/Lefarma.API/Shared/Constants/AuthorizationConstants.cs` (clases `Vacaciones` y `EducacionMedica` son el patron exacto: `public const string View = "rh.vacaciones.ver"`); `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/AprobacionesController.cs:34-39` (`TienePermiso(Permissions.EducacionMedica.BandejaVerTodos)` con mensaje 403); `lefarma.backend/src/Lefarma.API/Shared/Authorization/` (HasPermissionAttribute, PermissionHandler, DynamicPermissionPolicyProvider); `lefarma.backend/src/Lefarma.API/Features/Viaticos/CostosRutaController.cs:13` (hoy solo `[Authorize]`, sin identidad).
  Acceptance criteria (agent-executable): `dotnet build lefarma.backend/src/Lefarma.API/Lefarma.API.csproj` exit 0; un test xUnit que llame a `TienePermiso` con un principal que tiene el claim y otro que no, esperando true/false; el script SQL contiene los 4 codigos `viaticos.%` y es idempotente (puede ejecutarse dos veces sin error).
  QA scenarios: happy —permiso `viaticos.autorizar` presente devuelve true y el endpoint de bandeja responde 200; fallo — sin el claim devuelve 403 con el mensaje que nombra el permiso, y 403 tambien cuando el permiso falta en `app.Permisos`. Evidence `.omo/evidence/task-1-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N | el tracker declara "NO commits while iterating"
  Recommended task executor category: quick

- [x] 2. Buscadores global y cascada, ambos first-class y conformes a la politica de Nominatim
  What to do / Must NOT do: Extraer la cascada al nivel del wizard para que sea visible como camino de primera clase. Implementar `GET /api/viaticos/geocodificar` en backend como PROXY: cachea respuestas (los mismos patrones `costos-hoteles:*` y cache de 6h/1h ya existentes en `CalculoCostosRuta.cs`, reusar `IMemoryCache`), envia `User-Agent` identificable de la aplicacion, y limita a 1 req/s. El frontend llama al proxy, nunca a `nominatim.openstreetmap.org` directo. Preservar los 10 tests existentes de `PuntoMapaPicker.test.tsx` (mocks de `react-leaflet`, `leaflet`, `educacionMedica.api`, `municipios.api`). Must NOT do: agregar `maplibre-gl`, `react-map-gl` ni `@react-google-maps/api`; ni tocar `educacionMedicaApi.regiones`.
  Closes: GAP-2, GAP-7, IS-2
  Parallelization: Wave 1 | Blocked by: - | Blocks: T3
  References: `lefarma.frontend/src/apps/viaticos/components/PuntoMapaPicker.tsx:41-58` (`urlBusquedaGlobal` con `countrycodes=mx`, `urlBusquedaGuiada` con `state`/`city`/`street`), `:166-200` (carga de estados y municipios), ``:33-34` (DEBOUNCE_MS 400 / THROTTLE_MS 1000); `lefarma.frontend/src/apps/viaticos/components/PuntoMapaPicker.test.tsx:18-26` (mocks que deben seguir funcionando), `:51,61,75,104` (tests de cascada, debounce, throttle); `lefarma.frontend/src/apps/viaticos/services/municipios.api.ts`; `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs:208-240` (patron de cache con IMemoryCache a copiar).
  Acceptance criteria (agent-executable): `grep -r "nominatim.openstreetmap.org" lefarma.frontend/src` devuelve 0 coincidencias; `npm run test -- --reporter=verbose` en `lefarma.frontend` pasa los 10 tests preexistentes de PuntoMapaPicker sin modificarlos; test nuevo del proxy que verifica que dos llamadas identicas: la segunda solo golpea upstream una vez (cache).
  QA scenarios: happy — elegir Estado=`19` (CDMX) + Municipio=`015` + texto=`Zocalo` produce resultados; el proxy responde 200 desde cache en la segunda llamada. fallo — texto de menos de 3 caracteres no dispara peticion; respuesta 429/500 de upstream produce `errorBusqueda` visible y NO inventa coordenadas; el proxy respeta 1 req/s bajo carga.
  Evidence `.omo/evidence/task-2-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N | la prueba de nominado ya esta cubierta por tests existentes
  Recommended task executor category: unspecified-high

- [x] 6. Prompt versionado de `pi` + JSON Schema del contrato de cotizacion
  What to do / Must NOT do: Crear `lefarma.docs/viaticos/prompts/busqueda-viaticos.md` que instruya a `pi` a investigar vuelos y transportes que operan en Mexico para un origen/destino/fecha dados, y a devolver EXCLUSIVAMENTE un JSON con: `transportista`, `modo` (avion|autobus), `salida`, `llegada`, `precio`, `moneda`, `url_compra`, `capturas[]` (URLs o base64), `fuente`, `consultado_en`; mas `cobertura_declarada` (texto libre) y `transportistas_no_encontrados[]` (obligatorio, puede estar vacio pero DEBE existir). Crear `schemas/cotizacion-viajes.schema.json` con `additionalProperties: false` y campos requeridos. El prompt debe exigir link de compra por opcion. Must NOT do: prometer cobertura total de transportistas; el JSON debe poder declarar faltantes.
  Closes: GAP-6, IS-4, IS-11
  Parallelization: Wave 1 | Blocked by: - | Blocks: T5, T10
  References: patron de prompts del repo en `lefarma.docs/DOCUMENTATION_PROMPT.md`; `lefarma.docs/educacion-medica/decisiones/00003_estimador-viaticos-catalogo.md` (el ADR que este prompt reconcilia).
  Acceptance criteria (agent-executable): el schema valida con `ajv` o equivalente y RECHAZA un JSON sin `url_compra` o sin `fuente`; valida un JSON de ejemplo completo; un test de Vitest importa el schema y valida los fixtures de `pruebas de gastos/markdown/`.
  QA scenarios: happy — el JSON de ejemplo del schema pasa validacion y el importador de T10 lo acepta. fallo — un JSON con `precio: null` y `fuente: "estimado"` pasa pero la UI lo marca como estimado; un JSON sin `transportistas_no_encontrados` FALLA la validacion (fuerza la honestidad de cobertura).
  Evidence `.omo/evidence/task-6-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N | el prompt es documento, no codigo ejecutable
  Recommended task executor category: writing

- [x] 7. Worker Playwright de capturas de pantalla
  What to do / Must NOT do: Crear `lefarma.frontend/scripts/captura-viaticos.mjs` que reciba un array de `{url, nombre}` y por cada uno: lance Chromium headless, espere `networkidle`, capture `fullPage: true`, guarde PNG en `lefarma.frontend/public/capturas/viaticos/`, y emita un JSON de resultado `[{url, archivo, ok, error}]` con timeout por captura (30s) y limite de concurrencia (2). Debe funcionar sin credenciales. Must NOT do: scrapear Booking/Expedia/aerolineas; solo paginas publicas de resultado y deep-links de transportista; no instalar dependencias nuevas (usar el `@playwright/test` ya presente).
  Closes: GAP-5, IS-4
  Parallelization: Wave 1 | Blocked by: - | Blocks: T8
  References: `lefarma.frontend/package.json` (`@playwright/test ^1.58.2`, `playwright` disponible); `lefarma.frontend/playwright.config.ts` (patron de arranque); `lefarma.frontend/tests/login.spec.ts` (patron de screenshot existente).
  Acceptance criteria (agent-executable): `node lefarma.frontend/scripts/captura-viaticos.mjs` contra una URL publica de prueba produce un PNG > 10KB en `public/capturas/viaticos/` y el JSON de salida lista `ok: true`; contra una URL inexistente emite `ok: false` con `error` y NO lanza excepcion no controlada.
  QA scenarios: happy — 2 URLs de transportista producen 2 PNG y 2 lineas de resultado. fallo — URL que no carga (timeout/DNS) produce `ok:false` con mensaje y el proceso sale 0; URL con redireccion a login produce PNG del login y `ok:false` (no se marca como captura valida).
  Evidence `.omo/evidence/task-7-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N | utileria, no se commithea sin OK
  Recommended task executor category: quick

- [x] 12. Script SQL de solicitudes, opciones, ajustes y capturas
  What to do / Must NOT do: Crear `lefarma.database/viaticos/0003_20261007-0000_viaticos_schema-solicitudes.aprobaciones.lefarma.sql` siguiendo la convencion del script 0002 existente (`-- Descripcion:`, guards `IF OBJECT_ID(...) IS NOT NULL AND ... IS NULL`, `EXEC('CREATE SCHEMA')`). Tablas en schema `viaticos`: `solicitudes` (id, id_usuario_solicitante, periodo `yyyy-MM`, gerencia, estado `borrador|enviada|autorizada|autorizada_con_ajustes|rechazada`, datos_json del wizard, creado_en), `solicitud_opciones` (id, id_solicitud, tipo `vuelo|hotel`, linea, datos_json, precio, moneda, url_compra, fuente, fue_elegida `BIT`, ruta_captura, capturada_en), `solicitud_ajustes` (id, id_solicitud, id_opcion, campo, valor_anterior, valor_nuevo, motivo `OBLIGATORIO`, id_usuario_admin, creado_en), `solicitud_eventos` (id, id_solicitud, tipo, payload_json, id_usuario, creado_en). Audit columns `activo`/`fecha_creacion`/`fecha_modificacion` solo en las tablas maestro; hijas con borrado fisico. Indice unico en `(id_usuario_solicitante, periodo, estado) ` para el concentrado. NOTAS: la regla del repo es `id_*` (no `codigo_*`) y `fecha DATE`. Must NOT do: tocar `viaticos.municipios_cat`, `viaticos.municipios_osm_staging`, los SP existentes, ni `educacion_medica.viatico_tarifas`; NO aplicar el script a ninguna base de datos (el usuario no lo pidio).
  Closes: GAP-8, IS-10
  Parallelization: Wave 1 | Blocked by: - | Blocks: T9, T13, T16
  References: `lefarma.database/viaticos/0002_20261005-1400_viaticos_schema-municipios-sp-job.lefarma.sql:2-15` (encabezado y comentario de fases), `:48` (`EXEC('CREATE SCHEMA viaticos;')`), `:56-67` (guards de transferencia), `:83-98` (`municipios_cat` con `id_municipio IDENTITY` y `UQ_municipios_cat_estado_nombre`), `:117-129` (`municipios_osm_staging`, tabla hija sin audit); AGENTS.md seccion "Database planning rules".
  Acceptance criteria (agent-executable): el archivo existe y `grep -c "CREATE TABLE viaticos\."` == 4; `grep "codigo_"` devuelve 0 (regla `id_*`); `grep "DATE"` no aparece como tipo de columna de fecha de negocio; el `motivo` de `solicitud_ajustes` es `NOT NULL`; NO se ejecuto `sqlcmd` ni `Invoke-Sqlcmd` (el ejecutor lo deja sin aplicar).
  QA scenarios: happy — el script pasa el validador de convenciones (schema `viaticos.`, prefijo `id_`, audit en maestro, FK fisicas). fallo — el ejecutor intenta aplicar el script y `sqlcmd` NO esta disponible/no se ejecuta: la QA registra que el script queda sin aplicar y el test pasa igual.
  Evidence `.omo/evidence/task-12-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N | el tracker prohíbe commits
  Recommended task executor category: quick


- [x] 3. Modal de mapa con secuencia de puntos, marcadores numerados y polylinea
  What to do / Must NOT do: Crear `lefarma.frontend/src/apps/viaticos/components/SelectorRutaModal.tsx` que envuelve `PuntoMapaPicker` con tabs "Buscador global" / "Por estado y municipio" (ambos visibles, ninguno deshabilitado). Recibir `puntos: PuntoSeleccion[]` y `onChange`. Renderizar `MapContainer` con `Marker` numerados 1..N (divIcon con el numero) y un `Polyline` que los une en orden. Botones: agregar (del resultado actual o del ultimo clic), subir, bajar, editar, eliminar, recentrar. El clic en el mapa inserta el SIGUIENTE punto, no reemplaza el anterior. Integrar con `Modal` de `@/components/ui/modal` (patron de `ResumenSeleccionModal.tsx:246`). Must NOT do: anadir dependencias de mapa; no modificar la logica interna de `PuntoMapaPicker` (se reutiliza tal cual).
  Closes: GAP-3, IS-3
  Parallelization: Wave 2 | Blocked by: T2 | Blocks: T4
  References: `lefarma.frontend/src/apps/viaticos/components/PuntoMapaPicker.tsx` completo (props `value`/`onChange`/`onAgregar`/`disabled`, `iconoMarcador()` con `L.divIcon`, `ControladorMapa`, `ManejadorClick`); `lefarma.frontend/src/apps/viaticos/types/costosRuta.types.ts:3-7` (`PuntoSeleccion {nombre, latitud, longitud}`); `lefarma.frontend/src/apps/educacion-medica/components/HospitalesMap.tsx:37,47,57,148,232` (patron de `divIcon` y `MapContainer` a imitar); `lefarma.frontend/src/apps/educacion-medica/components/ResumenSeleccionModal.tsx:5,246,265` (patron de `Modal`); `lefarma.frontend/src/components/ui/modal.tsx`, `dialog.tsx`, `tabs.tsx` (primitivas disponibles).
  Acceptance criteria (agent-executable): `npm run test -- --reporter=verbose` pasa; test que monta el modal con 3 puntos y confirma que `Polyline` recibe 3 coordenadas en el orden dado (mock de `react-leaflet` ya existe en `PuntoMapaPicker.test.tsx:18`); test que confirma que un clic inserta indice `N+1`.
  QA scenarios: happy — agregar 3 puntos produce 3 marcadores numerados y una polylinea de 2 segmentos; el boton "Subir" reordena y la polylinea se redibuja. fallo — el boton Agregar esta deshabilitado sin punto seleccionado; con 0 puntos el mapa no crashea; cerrar el modal sin confirmar no muta la lista del padre.
  Evidence `.omo/evidence/task-3-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N | el tracker prohíbe commits
  Recommended task executor category: visual-engineering

- [x] 8. Endpoint de capturas y registro de archivos
  What to do / Must NOT do: Anadir en `Viaticos` un endpoint `POST /api/viaticos/capturas` que reciba `[{url, nombre}]`, invoque el worker de T7 (como servicio encapsulado o `Process` con timeout de 120s y limite de 10 URLs por llamada) y devuelva `[{url, archivo, ok, error}]`. Servir los PNG desde la ruta estatica ya existente `/api/media/archivos` o una subcarpeta `/api/viaticos/capturas`. Persistir `ruta_captura`/`capturada_en` en `solicitud_opciones` cuando se asocien. Must NOT do: bloquear el request mas de 120s; no aceptar URLs de Booking/Expedia (validar contra una lista blanca de dominios de transportista).
  Closes: GAP-5 (persistencia), IS-4
  Parallelization: Wave 2 | Blocked by: T7 | Blocks: T5, T14
  References: `lefarma.backend/src/Lefarma.API/Program.cs` (configuracion de archivos estaticos y `MapFallbackToFile`); AGENTS.md ("Static uploads are served under `/api/media/archivos`... Base path: `wwwroot/media/archivos`"); `lefarma.backend/src/Lefarma.API/Features/Viaticos/CostosRutaController.cs:11-31` (patron de controller del modulo).
  Acceptance criteria (agent-executable): `dotnet build` exit 0; test xUnit con un handler HTTP fake que verifica que una lista vacia devuelve `[]` sin error y que una URL fuera de la lista blanca se rechaza con 400; test que verifica el limite de 10 URLs.
  QA scenarios: happy — 2 URLs validas devuelven 2 rutas de archivo existentes bajo `wwwroot`. fallo — 11 URLs devuelven 400; una URL de `booking.com` se rechaza; un dominio que no resuelve devuelve `ok:false` y el endpoint responde 200 con el detalle del error (no 500).
  Evidence `.omo/evidence/task-8-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: unspecified-high

- [x] 9. API de solicitudes (crear, listar, detalle)
  What to do / Must NOT do: Crear `lefarma.backend/src/Lefarma.API/Features/Viaticos/SolicitudesController.cs` con `[Authorize]` + permiso `viaticos.solicitar`. Endpoints: `POST /api/viaticos/solicitudes` (crea en estado `borrador` o `enviada`, tomando `id_usuario_solicitante` del token via el helper de T1, escribiendo `periodo` `yyyy-MM` y `gerencia` del perfil), `GET /api/viaticos/solicitudes/mis` (del usuario autenticado), `GET /api/viaticos/solicitudes/{id}` (detalle con opciones y eventos), `PUT /api/viaticos/solicitudes/{id}/opciones` (recibe el JSON de pi ya validado por el schema de T6 y persiste cada opcion con `fue_elegida`). Envolver en `ErrorOr` como el resto del modulo. Registrar en DI siguiendo el patron de `MunicipiosController`. Must NOT do: exponer solicitudes de otro usuario sin `viaticos.ver_todos`; no permitir que el cliente determine `id_usuario_solicitante`.
  Closes: GAP-8, IS-5, IS-10
  Parallelization: Wave 2 | Blocked by: T1, T12 | Blocks: T4, T10, T16
  References: `lefarma.backend/src/Lefarma.API/Features/Viaticos/MunicipiosController.cs:12-44` (patron de controller: `[Route("api/viaticos")]`, `[Authorize]`, `GetMunicipios`, envelope `success/data/message`); `lefarma.backend/src/Lefarma.API/Features/Viaticos/DTOs/MunicipioDtos.cs` y `CostosRutaDtos.cs` (patron de DTOs); `lefarma.backend/src/Lefarma.API/Shared/BaseService.cs` (base de servicios); `lefarma.frontend/src/apps/viaticos/services/costosRuta.api.ts` y `municipios.api.ts` (patron de cliente HTTP con el envelope `success/data/message`).
  Acceptance criteria (agent-executable): `dotnet build` exit 0; test xUnit del controller con `WebApplicationFactory` verifica que `POST` sin token devuelve 401, con token sin permiso devuelve 403, y con permiso devuelve 201 con `id_usuario_solicitante` igual al del token (no al del body); test de que un usuario sin `ver_todos` NO puede leer la solicitud de otro.
  QA scenarios: happy — crear solicitud persiste y devuelve 201 con id; el detalle devuelve las opciones con `fue_elegida` correcto. fallo — token de otro usuario sobre `GET /{id}` ajeno devuelve 403; `periodo` se deriva del servidor y no del body (test con body falsificado).
  Evidence `.omo/evidence/task-9-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: unspecified-high

- [x] 13. API de autorizacion y ajustes con auditoria
  What to do / Must NOT do: Anadir a `SolicitudesController` (o un `AprobacionesController` nuevo) con permiso `viaticos.autorizar` / `viaticos.ajustar`: `GET /api/viaticos/solicitudes?periodo=yyyy-MM&estado=&gerencia=` (bandeja; si el usuario NO tiene `ver_todos), filtrar a las propias — mismo patron que `AprobacionesController.cs:34`), `POST /api/viaticos/solicitudes/{id}/autorizar`, `POST /api/viaticos/solicitudes/{id}/rechazar` (motivo obligatorio), `POST /api/viaticos/solicitudes/{id}/ajustes` (cuerpo: `id_opcion`, `campo`, `valor_anterior`, `valor_nuevo`, `motivo` obligatorio). Cada ajuste escribe en `solicitud_ajustes` y `solicitud_eventos`, y cambiar a un estado con ajustes exige al menos un ajuste persistido. Al autorizar, la solicitud pasa a `autorizada` o `autorizada_con_ajustes`. Must NOT do: permitir autorizacion sin `viaticos.autorizar`; permitir un ajuste sin `motivo`; modificar destructivamente el valor original del solicitante.
  Closes: GAP-8, GAP-11, IS-8
  Parallelization: Wave 2 | Blocked by: T1, T12 | Blocks: T11, T14, T15
  References: `lefarma.backend/src/Lefarma.API/Features/EducacionMedica/AprobacionesController.cs:34-39` (`TienePermiso` y mensaje de403 a copiar textualmente); `lefarma.frontend/src/apps/educacion-medica/pages/taller/BandejaAprobacionesPage.tsx:74,146,266-288` (`usePermission`, filtro por `puedeVerTodos`, `accion`/`idAccion` del workflow).
  Acceptance criteria (agent-executable): `dotnet build` exit 0; test xUnit verifica que un ajuste sin `motivo` devuelve 400 con mensaje que nombra el campo; test que verifica que tras un ajuste el `valor_anterior` sigue intacto y `valor_nuevo` se aplica al concentrado; test que verifica que autorizar sin permiso devuelve 403.
  QA scenarios: happy — admin con `autorizar` autoriza una solicitud y el estado cambia con evento registrado; un ajuste con motivo persiste y la fila queda en `autorizada_con_ajustes`. fallo — intento de autorizar desde un usuario sin permiso devuelve 403; intento de ajustar sin motivo devuelve 400; un solicitante sin `ver_todos` solo ve las suyas en la bandeja.
  Evidence `.omo/evidence/task-13-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: unspecified-high


- [x] 4. Wizard de 4 pasos con barra de progreso
  What to do / Must NOT do: Convertir el `Card` de `ViaticosPage.tsx:255-520` en un wizard de 4 pasos con barra de progreso usando `Progress` y `Tabs` de `@/components/ui/`. Paso 1 "Persona y origen" (absorbe el formulario actual: nombre via `CatalogoSearchSelect`, entrada/salida, carro propio, gasolina, origen catalogo/mapa, y la lista de destinos). Paso 2 "Puntos" (boton que abre el `SelectorRutaModal` de T3). Paso 3 "Calcular" (llama a `costosRutaApi.calcular`). Paso 4 "Resultados" (tablas de T5 + selector de opcion + boton de envio que llama a T9). Mantener los checkboxes de opciones globales (`respetarHorarioLaboral`, `calcularHoteles`, `calcularViajesIntermedios`, `compartirViaje`) en el Paso 3. Preservar `VIAJES_EJEMPLO` y `cargarEjemplo`. Must NOT do: eliminar `CostosViaticosPrint` ni el portal de impresion (`ViaticosPage.tsx:694`); no cambiar `buildRouteRequest` (`costosRutaForm.ts:67`) ni su validacion.
  Closes: GAP-1, IS-1
  Parallelization: Wave 3 | Blocked by: T3, T9 | Blocks: T5, T10
  References: `lefarma.frontend/src/apps/viaticos/pages/costos/ViaticosPage.tsx:54-86` (`useState` actuales a preservar), `:255-345` (Card + ejemplo + porPersona), `:344-356` (toggle Catalogo/Mapa), `:358-372` (PuntoMapaPicker origen), `:381-400` (PuntoMapaPicker destino), `:421-437` (botones de destinos), `:462-480` (checkboxes), `:518` (boton de vista previa), `:694-700` (portal de impresion); `lefarma.frontend/src/apps/viaticos/pages/costos/costosRutaForm.ts:5-20` (`DestinationForm`, `PersonForm`), `:43` (`localTomorrow`), `:48` (`newPerson`), `:67` (`buildRouteRequest`); `lefarma.frontend/src/apps/viaticos/pages/costos/costosRutaEjemplos.ts:80,107` (`VIAJES_EJEMPLO`, `aplicarEjemplo`); `lefarma.frontend/src/components/ui/progress.tsx`, `tabs.tsx`, `select.tsx`.
  Acceptance criteria (agent-executable): `npm run build` (tsc + vite) exit 0; `npm run test -- --reporter=verbose` pasa TODOS los tests de `ViaticosPage.test.tsx` sin borrarlos; test que verifica que solo un paso es visible a la vez y que la barra avanza; test que verifica que "Siguiente" esta deshabilitado sin origen valido.
  QA scenarios: happy — completar paso 1->4 con un origen de catalogo y tres puntos muestra el flujo completo y el boton Calcular funciona. fallo — avanzar con origen vacio muestra error y no cambia de paso; retroceder conserva todo el estado ya capturado; el print sigue disponible al final.
  Evidence `.omo/evidence/task-4-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 5. Tablas comparables de vuelos y hoteles con fuente, link y captura
  What to do / Must NOT do: Reemplazar los `<ul>` de `ViaticosPage.tsx:626-666` (`t.opciones` y `r.hotelesPropuestos`) por dos `Table` de shadcn con columnas: `Linea/Transportista`, `Modo`, `Salida`, `Llegada`, `Precio`, `Fuente`, `Captura` (miniatura que abre la imagen), `Comprar` (`<a target="_blank">` al `comprar.url`). La columna `Fuente` DEBE distinguir visualmente las filas estimadas por formula de las cotizadas por `pi` (badge distinto). Anadir boton "Elegir" por fila que fija `seleccion[persona][tipo][tramo] = id`. Must NOT do: ocultar la `fuente`; presentar un estimado como si fuera real; quitar el link de compra (es requisito duro del usuario).
  Closes: GAP-4, IS-4, IS-11
  Parallelization: Wave 3 | Blocked by: T6, T8 | Blocks: T10
  References: `lefarma.frontend/src/apps/viaticos/pages/costos/ViaticosPage.tsx:621-666` (bloque exacto a reemplazar), `:571-620` (tabla de ruta existente como patron de `Table`/`TableHead`/imports en `:9-12`); `lefarma.frontend/src/apps/viaticos/types/costosRuta.types.ts` (`CostosRutaOferta` con `linea`/`salidaTxt`/`llegadaTxt`/`precioTxt`/`fuente`/`estimado`/`comprar.accion`/`comprar.url`, `CostosRutaHotel` con `lugar`/`ciudad`/`checkIn`/`checkOut`/`noches`/`fuente`/`link`); `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs:318-338` (`estimado`/`fuente` de los vuelos) y `:872-890` (hoteles reales + semilla); `lefarma.frontend/src/components/ui/table.tsx`, `badge.tsx`.
  Acceptance criteria (agent-executable): `npm run build` exit 0; test que renderiza la tabla con una oferta `estimado: true` y otra `estimado: false` y verifica que las fuentes se distinguen; test que verifica que cada fila tiene un `<a href>` no vacio; el DOM no contiene mas `<ul>` en ese bloque.
  QA scenarios: happy — con una cotizacion de `pi` importada, la tabla muestra filas con link funcional y miniatura de captura. fallo — una opcion sin `url_compra` muestra el boton Comprar deshabilitado con tooltip explicito, no un link roto; una opcion `estimado` muestra badge "Estimado" y su `Fuente` dice que no hay proveedor.
  Evidence `.omo/evidence/task-5-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 10. Importador del JSON de pi, seleccion y envio
  What to do / Must NOT do: Crear `lefarma.frontend/src/apps/viaticos/components/ImportarPiCotizacion.tsx`: textarea para pegar el JSON de `pi`, boton "Cargar cotizacion" que valida contra el schema de T6 (importando el JSON con `resolveJsonModule`), mapea cada opcion a `CostosRutaOferta`/`CostosRutaHotel` preservando `url_compra` y `capturas[]`, y las fusiona con las opciones existentes conservando la distincion estimado/real. Mostrar `cobertura_declarada` y `transportistas_no_encontrados` en una nota visible. Boton "Enviar solicitud" que llama a `PUT /solicitudes/{id}/opciones` + cambia el estado a `enviada`. Must NOT do: aceptar JSON que no valide; descartar `capturas`; ocultar los transportistas no encontrados.
  Closes: GAP-6, IS-5
  Parallelization: Wave 3 | Blocked by: T4, T5, T9 | Blocks: T11, T14
  References: `lefarma.frontend/src/apps/viaticos/services/costosRuta.api.ts` (patron de cliente); `lefarma.frontend/src/apps/viaticos/types/costosRuta.types.ts` (`CostosRutaOferta`, `CostosRutaHotel`); `lefarma.docs/viaticos/prompts/busqueda-viaticos.md` y el schema que crea T6; `lefarma.frontend/tsconfig.json` (confirmar `resolveJsonModule` antes de importar el schema).
  Acceptance criteria (agent-executable): `npm run build` exit 0; test del mapper: JSON valido de 2 vuelos + 1 hotel produce 3 filas con `url_compra` intacto; test que confirma que JSON invalido muestra error y NO muta el estado; test que confirma que las `capturas[]` sobreviven el round-trip. `npm run test` verde.
  QA scenarios: happy — pegar el JSON de ejemplo del prompt carga 3 filas, cada una con su link y su captura. fallo — JSON truncado muestra error legible y no borra la tabla; un vuelo sin `url_compra` aparece marcado como no comprable; `transportistas_no_encontrados: ["Volaris"]` se muestra en la nota de cobertura.
  Evidence `.omo/evidence/task-10-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: unspecified-high

- [x] 11. Bandeja de autorizacion con botones Autorizar y Ver opciones
  What to do / Must NOT do: Crear `lefarma.frontend/src/apps/viaticos/pages/aprobaciones/BandejaAprobacionesPage.tsx` siguiendo el patron de `educacion-medica/pages/taller/BandejaAprobacionesPage.tsx` (`usePermission` para `viaticos.ver_todos`, tabla de TanStack con `tableId` `viaticos-bandeja`, filtros de periodo/estado/gerencia). Cada fila: No., solicitante, periodo, destino, total, estado, y los dos botones `Autorizar` y `Ver opciones`. `Autorizar` llama a T13 y refresca la fila. Registrar la ruta en `ViaticosRoutes.tsx` (`/viaticos/bandeja`). Must NOT do: modificar `educacion-medica`; mostrar el boton Autorizar si el usuario no tiene `viaticos.autorizar`.
  Closes: GAP-9, IS-6
  Parallelization: Wave 4 | Blocked by: T10, T13 | Blocks: T14, T15
  References: `lefarma.frontend/src/apps/educacion-medica/pages/taller/BandejaAprobacionesPage.tsx:18` (import `usePermission`), `:74` (`usePermission({ require: PERMISO_VER_TODOS })`), `:146-162` (cambio de filtro segun permiso), `:266-288` (`accion`/`idAccion` + refetch), `:328,355,367,491-503` (layout condicional por permiso), `:653` (`acciones={seleccionado.acciones}`); `lefarma.frontend/src/apps/educacion-medica/components/BandejaTable.tsx:193` (`tableId`); `lefarma.frontend/src/apps/viaticos/ViaticosRoutes.tsx:18-21` (rutas actuales `dashboard`/`perfil`); `lefarma.frontend/src/components/ui/data-table.tsx`, `table.tsx`.
  Acceptance criteria (agent-executable): `npm run build` exit 0; test que renderiza la bandeja con 2 filas y verifica que cada una tiene exactamente los botones Autorizar y Ver opciones; test que verifica que sin `viaticos.autorizar` el boton no se renderiza; test que verifica que autorizar cambia el estado en la fila sin recargar la pagina.
  QA scenarios: happy — admin entra, filtra el periodo `2026-10`, autoriza la fila 3 y la fila pasa a `autorizada`. fallo — un solicitante sin `ver_todos` entra y solo ve sus propias solicitudes; `Autorizar` durante el refresh se deshabilita para evitar doble envio.
  Evidence `.omo/evidence/task-11-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 14. Vista de opciones rechazadas con capturas
  What to do / Must NOT do: Crear `lefarma.frontend/src/apps/viaticos/pages/aprobaciones/DetalleSolicitudModal.tsx`: al pulsar `Ver opciones`, mostrar TODO lo que se ofrecio a esa persona — vuelo y hotel — con `fue_elegida` marcado, las opciones descartadas agrupadas bajo el encabezado "Opciones no elegidas", y la captura de cada una en miniatura que abre en grande. Mostrar la nota de `cobertura_declarada`/`transportistas_no_encontrados`. Debe funcionar tambien para el propio solicitante. Must NOT do: filtrar las descartadas; mostrar una opcion como elegida si `fue_elegida` es falso.
  Closes: GAP-10, IS-7
  Parallelization: Wave 4 | Blocked by: T11 | Blocks: -
  References: `lefarma.frontend/src/apps/viaticos/pages/costos/CostosViaticosPrint.tsx:59-63` (patron de `Props` con `respuesta`/`seleccion`), `:80-84` (`selectedProposal`/`selectedCosts` a reusar); `lefarma.frontend/src/apps/viaticos/pages/costos/costosViaticosData.ts:5-42` (`selectedProposal`, `selectedCosts`); `lefarma.frontend/src/apps/educacion-medica/components/ResumenSeleccionModal.tsx:246-265` (patron de modal de detalle); `lefarma.frontend/src/apps/viaticos/types/costosRuta.types.ts` (`CostosRutaOferta.fuente`/`estimado`, `CostosRutaHotel.link`).
  Acceptance criteria (agent-executable): `npm run build` exit 0; test con una solicitud de 5 opciones (2 elegidas, 3 no) verifica que se renderizan 5 y que las 3 descartadas estan bajo el encabezado de no elegidas; test verifica que el total mostrado por la UI NO incluye las descartadas.
  QA scenarios: happy — el admin abre "Ver opciones" y ve las 5 con sus capturas; el solicitante ve su misma vista. fallo — una opcion con captura ausente muestra un placeholder, no una imagen rota; una solicitud con una sola opcion no muestra el encabezado de descartadas.
  Evidence `.omo/evidence/task-14-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 15. Editor de costos y vuelo por el administrador, con auditoria
  What to do / Must NOT do: Dentro de `DetalleSolicitudModal` o como vista aparte, permitir al admin (permiso `viaticos.ajustar`): cambiar el vuelo elegido por CUALQUIERA de las otras opciones recomendadas; editar el precio de una partida; agregar una partida extra (concepto libre + monto); quitar una partida. Cada accion abre un dialogo que exige `motivo` y confirma contra `POST /{id}/ajustes` de T13. Mostrar una linea de tiempo de los ajustes (quien, cuando, que cambio). Must NOT do: permitir guardar sin motivo; borrar el valor original del solicitante (debe quedar como `valor_anterior`); recalcular en silencio sin dejar registro.
  Closes: GAP-11, IS-8
  Parallelization: Wave 4 | Blocked by: T11, T13 | Blocks: T16
  References: `lefarma.frontend/src/components/ui/dialog.tsx`, `alert-dialog.tsx` (confirmacion), `input.tsx`; `lefarma.frontend/src/apps/educacion-medica/pages/taller/BandejaAprobacionesPage.tsx:266-288` (patron de accion de workflow con `idAccion`); la tabla `solicitud_ajustes` creada en T12.
  Acceptance criteria (agent-executable): `npm run build` exit 0; test que verifica que cambiar de vuelo escribe `valor_anterior` y `valor_nuevo` distintos y ambos persisten; test que verifica que el dialogo de ajuste no permite confirmar con `motivo` vacio; test de la linea de tiempo que verifica que aparecen los 3 ajustes hechos.
  QA scenarios: happy — el admin cambia el vuelo, sube el hospedaje y agrega una partida de taxi; las tres quedan en el registro y el total refleja las tres. fallo — intentar guardar sin motivo muestra error y no llama al endpoint; cambiar a un vuelo no recomendado deja constancia de que fue un cambio manual; sin `viaticos.ajustar` los controles de edicion no aparecen.
  Evidence `.omo/evidence/task-15-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: unspecified-high

- [x] 16. Print ASK-ADM-FOR-008 generado desde datos persistidos
  What to do / Must NOT do: Crear `ConcentradoViaticosPrint.tsx` que replica el layout de `pruebas de gastos/markdown/VIATICOS EDUCACION MEDICA OCTUBRE 2026.md`: encabezado `Concentrado de Viáticos` con `Nombre`, `Gerencia`, `Fecha`; tabla de dos filas de encabezado (`No. | Solicitante | Fecha | Origen | Destino | Transporte` con subcolumnas `Costo boleto Autobús` y `Costo boleto Avión`, mas `Automóvil propio`, `Hospedaje`, `Comida`, `Taxi`, `Total`); un renglon por solicitud AUTORIZADA del periodo; fila `Total` con sumas; bloque de firmas `REVISÓ` x3 (Coordinador Administrativo, Gerente General, Gerente de Administración y Finanzas) + `AUTORIZÓ` (Dirección Corporativa); pie `ASK-ADM-FOR-008 | Versió:01 | Prohibida su reproducción no autorizada`. Fuente de datos: consulta a T9, NO el estado en memoria. Generar tambien la solicitud de avion con el layout de `VUELOS EDUCACION MEDICA OCTUBRE 2026.md`. Must NOT do: incluir solicitudes no autorizadas; calcular totales en el cliente; alterar el print actual `CostosViaticosPrint.tsx`.
  Closes: GAP-12, IS-9
  Parallelization: Wave 5 | Blocked by: T15, T9 | Blocks: T17
  References: `pruebas de gastos/markdown/VIATICOS EDUCACION MEDICA OCTUBRE 2026.md` (layout completo: linea de encabezado con `Nombre: DANIEL PADILLA | Gerencia: EDUCACION MEDICA | Fecha: 2026-09-01`, las dos filas de columnas, los 20 renglones, la fila `Total` con `$16,481.00` autobus, `$137,630.00` avion, `$52,896.00` hospedaje, `$25,100.00` comida, `$44,250.00` taxi, `$276,357.00` total, el bloque `REVISÓ`/`AUTORIZÓ` con los cuatro nombres, y el pie `ASK-ADM-FOR-008`); `pruebas de gastos/markdown/VUELOS EDUCACION MEDICA OCTUBRE 2026.md` (layout de la solicitud de avion: Nombre completo, Puesto, Fecha de nacimiento, tabla ida/vuelta con Fecha, Hora planeada, Origen, Destino, Motivo); `lefarma.frontend/src/apps/viaticos/pages/costos/CostosViaticosPrint.tsx:59-117` (patron de estilos en linea de tabla); `lefarma.frontend/src/apps/viaticos/pages/costos/costosViaticosPrint.css` (portales de impresion a reusar).
  Acceptance criteria (agent-executable): `npm run build` exit 0; test de regresion que monta el concentrado con los 20 viajes de octubre extraidos de `pruebas de gastos/markdown/` y verifica: 20 filas, total igual a `$276,357.00`, las dos filas de encabezado, el bloque de 4 firmas y el pie `ASK-ADM-FOR-008`; test que verifica que una solicitud en estado `rechazada` NO aparece; test que verifica que el total viene del servidor.
  QA scenarios: happy — imprimir el periodo `2026-10` con las 20 solicitudes autorizadas reproduce el Excel de referencia renglon por renglon. fallo — una solicitud rechazada o en borrador no aparece ni cuenta en los totales; un periodo sin solicitudes autorizadas imprime el encabezado y un mensaje de periodo vacio, no una tabla de ceros.
  Evidence `.omo/evidence/task-16-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 17. ADR de reconciliacion y fixtures de regresion
  What to do / Must NOT do: Crear `lefarma.docs/educacion-medica/decisiones/00007_busqueda-cotizacion-viaticos.md` con frontmatter (`fecha_creacion`/`fecha_modificacion`/`resumen`), `## Status`, indice, Decision, Contexto, Fases, Modelo de datos, Endpoints y pantallas, Permisos, Consecuencias, y anexo de fuentes citadas textualmente. Marcar `00003_estimador-viaticos-catalogo.md` con `Status: Superseded by ADR-00007` en vez de reescribirlo. El ADR debe declarar explicitamente que ADR-00003 sigue mandando en el CALCULO de viaticos y que la nueva capa es solo cotizacion externa persistida, y que la matriz "quien ve que" queda pendiente. Anadir ademas un fixture de regresion con los 20 viajes de octubre en `lefarma.frontend/src/apps/viaticos/test/fixtures/octubre2026.ts`. Must NOT do: reescribir el cuerpo del ADR 00003; inventar una jerarquia de roles no decidida.
  Closes: IS-12 (documentado), GAP-12 (trazabilidad)
  Parallelization: Wave 5 | Blocked by: T16 | Blocks: -
  References: `lefarma.docs/educacion-medica/decisiones/00003_estimador-viaticos-catalogo.md` (frontmatter y `## Status` a copiar; la frase clave es "nunca como dependencia en tiempo de ejecución"); `lefarma.docs/educacion-medica/decisiones/00001_esquema-datos-educacion-medica.md` (formato del indice y las fases); AGENTS.md seccion "Planning a New Feature or Module" (estructura obligatoria `decisiones/` `tareas/` `diagramas/` `referencias/`, y `NNNNN_descripcion.md` de 5 digitos).
  Acceptance criteria (agent-executable): existen los dos archivos; `grep "Superseded by ADR-00007"` en 00003 devuelve una coincidencia y el resto de 00003 es identico al original (`git diff --stat` solo muestra la linea de Status); el fixture existe y los tests de T16 lo consumen; existe `lefarma.docs/educacion-medica/tareas/00007_*` sincronizado con el ADR.
  QA scenarios: happy — `grep -n "Superseded by ADR-00007" 00003` encuentra la linea y `git diff --stat` reporta 1 archivo con cambios minimos; el ADR 00004 cita el texto literal del 00003 que esta reconciliando. fallo — si un ejecutor intenta reescribir el cuerpo del 00003, la QA falla y lo reporta.
  Evidence `.omo/evidence/task-17-viaticos-wizard-ruta-pi-busqueda.xml`
  Commit: N
  Recommended task executor category: writing

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  What to do / Must NOT do: Verificar que los 16 todos existen, que cada uno cierra al menos una fila GAP, que cada IS row tiene un todo que la entrega, y que las guardarrailes de Must NOT have se respetaron. Comprobar que `git status --short` no muestra `lefarma.backend/src/Lefarma.API/appsettings.Development.json` como MODIFICADO por este trabajo (debe seguir con el cambio previo `LefarmaDev`), ni `odd/tasks/costos-ruta-formulario.md`, ni `pruebas de gastos/` trackeados. Must NOT do: modificar codigo para hacer pasar la auditoria.
  Acceptance criteria (agent-executable): un script cuenta 16 filas `- [ ] N.` y 4 filas `- [ ] F<N>.`; cada GAP-1..GAP-12 aparece en al menos un `Closes:`; `git status --short` no lista archivos fuera del conjunto permitido; ningun todo declara `Commit: Y`.
  QA scenarios: happy — el script imprime OK para las 6 comprobaciones. fallo — si un GAP no esta cerrado por ningun todo, F1 falla y nombra el GAP huerfano.
  Evidence `.omo/evidence/final-f1-viaticos-wizard-ruta-pi-busqueda.md`

- [ ] F2. Code quality review
  What to do / Must NOT do: Revisar los archivos tocados contra los patrones del repo: envelope `success/data/message`, `ErrorOr`, `IMemoryCache` con timeout, `TienePermiso` en vez de roles, pruebas inyeccionadas en vez de `new`, componentes shadcn en vez de HTML crudo. Verificar que no hay `any` implicito, ni dependencias nuevas no permitidas (`package.json` solo puede haber cambiado si T2 justifico algo; en cuyo caso debe justificarse). Must NOT do: reescribir codigo; reportar solo.
  Acceptance criteria (agent-executable): `npm run lint` (eslint, `--max-warnings 0`) exit 0; `dotnet build` exit 0 sin warnings nuevos; la revision confirma o refute cada patron con `ruta:linea`.
  QA scenarios: happy — lint y build limpios y cada patron confirmado con cita. fallo — un `console.log`, un `any` o un endpoint sin `TienePermiso` hace fallar F2.
  Evidence `.omo/evidence/final-f2-viaticos-wizard-ruta-pi-busqueda.md`

- [ ] F3. Real manual QA con Playwright
  What to do / Must NOT do: Levantar el stack (`npm run dev -- --port 5180 --strictPort` en `lefarma.frontend`, backend en 5174) siguiendo el patron de `lefarma.frontend/tests/login.spec.ts`. Recorrer con un superadmin y con un solicitante: (1) el especialista completa el wizard, (2) elige punto por buscador global, (3) elige punto por cascada, (4) agrega 3 puntos y ve la polylinea, (5) calcula, (6) pega el JSON de pi y ve las tablas con link y captura, (7) envia, (8) el admin autoriza, (9) el admin ve las rechazadas con capturas, (10) el admin cambia vuelo y agrega costo con motivo, (11) se imprime el concentrado. Capturar screenshot en cada paso. Must NOT do: declarar exito sin haber corrido el flujo completo; dejar el servidor vivo (matarlo en `finally`).
  Acceptance criteria (agent-executable): un spec de Playwright cubre los 11 pasos y pasa en una corrida; los 11 screenshots existen en `.omo/evidence/final-f3-*.png`; el proceso del servidor se termina al final (assertion sobre el puerto libre).
  QA scenarios: happy — el recorrido completo deja una solicitud autorizada y el concentrado impreso con la fila. fallo — si un paso falla, F3 reporta exactamente en que paso y con que mensaje, sin maquillar el resultado.
  Evidence `.omo/evidence/final-f3-viaticos-wizard-ruta-pi-busqueda.md`

- [ ] F4. Ideal-state fidelity
  What to do / Must NOT do: Contrastar el comportamiento entregado contra las 12 filas IS una por una, con evidencia. Prestar atencion especial a IS-2 (ambos buscadores usables), IS-7 (las rechazadas visibles con capturas), IS-8 (ajustes con rastro) e IS-11 (ningun estimado vestida de real). Una fila IS sin QA que la demuestre se convierte en una nueva `- [ ] N.`, nunca en una nota. Must NOT do: dar por buena una IS por analogia; exigir el 100% de cobertura de transportistas (es una limitacion declarada).
  Acceptance criteria (agent-executable): una tabla de 12 filas IS con el todo que la entrega, el escenario QA que la prueba y la ruta de evidencia; cero filas IS sin evidencia.
  QA scenarios: happy — las 12 filas tienen evidencia. fallo — IS-7 sin evidencia (p.ej. las rechazadas no se ven) genera un todo nuevo `- [ ] N.` y F4 no aprueba.
  Evidence `.omo/evidence/final-f4-viaticos-wizard-ruta-pi-busqueda.md`

## Commit strategy

**Ningun commit automatico.** `odd/tasks/costos-ruta-formulario.md` declara literalmente "NO commits while iterating" y "No stage, reset, commit, push, remote calls, or PR creation". Cada todo lleva `Commit: N`.

Cuando el usuario autorice commits, la unidad es **un todo = un commit** (implementacion + test juntos, nunca separados por tipo de archivo), mensajes en espanol, sin atribucion de IA:

1. `feat(viaticos): permisos de solicitud, autorizacion y ajuste`
2. `fix(viaticos): mover el geocodificado a un proxy conforme a la politica de Nominatim`
3. `feat(viaticos): buscador global y cascada como caminos de primera clase`
4. `feat(viaticos): modal de mapa con secuencia de puntos y polylinea`
5. `feat(viaticos): endpoint de capturas de pantalla con lista blanca de dominios`
6. `feat(viaticos): API de solicitudes con identidad del solicitante`
7. `feat(viaticos): API de autorizacion y ajustes con registro de auditoria`
8. `chore(db): esquema de solicitudes, opciones, ajustes y eventos`
9. `docs(viaticos): prompt de pi y esquema de la cotizacion de viajes`
10. `feat(viaticos): capturas de pantalla con Playwright`
11. `feat(viaticos): wizard de cuatro pasos para capturar el viaje`
12. `feat(viaticos): tablas comparables de vuelos y hoteles con fuente y captura`
13. `feat(viaticos): importar la cotizacion de pi y enviar la solicitud`
14. `feat(viaticos): bandeja de autorizacion con acciones por solicitud`
15. `feat(viaticos): ver opciones no elegidas con sus capturas`
16. `feat(viaticos): ajustar costos y vuelo con motivo obligatorio`
17. `feat(viaticos): concentrado con formato ASK-ADM-FOR-008`
18. `docs(viaticos): ADR-00004 y fixtures de regresion de octubre`

## Success criteria

| IS | Delivering todo(s) | Proving QA scenario | Evidence |
| --- | --- | --- | --- |
| IS-1 | T4 | Wizard recorre los 4 pasos con origen valido; no avanza sin origen | `.omo/evidence/task-4-*.xml` + `final-f3-*.png` pasos 1-2 |
| IS-2 | T2, T3 | Buscador global y cascada y global responden cada uno; ambos tabs visibles | `.omo/evidence/task-2-*.xml`, `task-3-*.xml` + F3 pasos 2-3 |
| IS-3 | T3 | 3 puntos producen 3 marcadores numerados y polylinea de 2 segmentos; clic inserta N+1 | `.omo/evidence/task-3-*.xml` + F3 paso 4 |
| IS-4 | T5, T6, T7, T8, T10 | Tabla de vuelos y hoteles con link funcional, miniatura y columna fuente | `.omo/evidence/task-5-*.xml`, `task-10-*.xml` + F3 pasos 6-7 |
| IS-5 | T9, T10 | La opcion elegida persiste con `fue_elegida`; las descartadas tambien | `.omo/evidence/task-9-*.xml`, `task-10-*.xml` |
| IS-6 | T11 | Cada fila tiene Autorizar y Ver opciones; sin permiso el boton no existe | `.omo/evidence/task-11-*.xml` + F3 paso 8 |
| IS-7 | T14 | 5 opciones se ven las 5; las 3 descartadas bajo su encabezado y fuera del total | `.omo/evidence/task-14-*.xml` + F3 paso 9 |
| IS-8 | T13, T15 | Cambiar vuelo y agregar partida exigen motivo y dejan `valor_anterior`/`valor_nuevo` | `.omo/evidence/task-13-*.xml`, `task-15-*.xml` + F3 paso 10 |
| IS-9 | T16 | Concentrado de 20 filas reproduce el Excel: total `$276,357.00`, 4 firmas, pie `ASK-ADM-FOR-008` | `.omo/evidence/task-16-*.xml` + F3 paso 11 |
| IS-10 | T1, T9, T12 | Solicitud guardada con `id_usuario_solicitante` del token y `periodo` derivado del servidor | `.omo/evidence/task-9-*.xml`, `task-12-*.xml` |
| IS-11 | T5 | Oferta `estimado:true` y `estimado:false` se distinguen por badge y `fuente` visible | `.omo/evidence/task-5-*.xml` |
| IS-12 | T4, T17 | Tests preexistentes de `ViaticosPage` y `PuntoMapaPicker` siguen verdes sin borrarlos | `.omo/evidence/task-4-*.xml`, `task-17-*.xml` |
