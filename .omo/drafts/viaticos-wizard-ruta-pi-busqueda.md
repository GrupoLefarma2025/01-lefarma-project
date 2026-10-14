---
slug: viaticos-wizard-ruta-pi-busqueda
status: awaiting-approval
intent: clear
review_required: true
plan_path: .omo/plans/viaticos-wizard-ruta-pi-busqueda.md
plan_sha256: null
review_round_id: null
review_round_limit: 5
pending-action: write and review .omo/plans/viaticos-wizard-ruta-pi-busqueda.md
approach: Solicitud + concentracion + aprobacion. Wizard de 4 pasos donde CUALQUIER especialista captura su destino, ve costos reales (JSON de pi), elige su opcion y envia. El concentrado se imprime con formato identico a ASK-ADM-FOR-008 y en UI es tabla con Autorizar uno por uno. El perfil administrador (superadmin) ve todas las opciones incluso rechazadas con capturas, y puede cambiar vuelo/costos, agregar o quitar partidas. Todo persistido en SQL Server. Busqueda: buscador global O cascada estado->municipio->texto, ambosfirst-class.
---

# Draft: viaticos-wizard-ruta-pi-busqueda

## Affected user and ideal state

**Quien:**
1. **El especialista solicitante** (cualquiera de la empresa que requiera salir). Hoy no tiene ninguna herramienta: solo existe `ViaticosPage`, que es una calculadora técnica de una sola pantalla.
2. **El perfil administrador** (hoy superadmin; el usuario dijo "despues nos hacemos pelotas de quien puede ver que cosa"). Revisa, autoriza una por una y ajusta costos.
3. **`pi`**, agente externo al que se le pide la investigacion de vuelos y transportes.
4. **El siguiente programador** del modulo.

**Como usan hoy:** (1) no existe flujo de solicitud; (2) el print concentrado (`CostosViaticosPrint.tsx`) imprime concentrados/solicitud pero no hay bandeja ni aprobacion; (3) `pi` no aparece en el repo; (4) `ADR-00003` contradice toda busqueda en runtime.

**IS-n | propiedad del estado ideal | razon**
- IS-1 | Cualquier especialista entra al modulo y captura SU viaje en un wizard de 4 pasos sin ayuda externa. | Pedido: "los especialistas o cualquiera dentro de la empresa que requiera salir, pueda meterse y cargar su destino".
- IS-2 | La busqueda de destino tiene DOS caminos de primera clase y ambos funcionan: (a) buscador global tipo Google Maps, (b) cascada Estado -> Municipio -> Texto. Elige el que quiera. | Pedido literal: "la cascada es opcional. se puede buscar directamente con un buscador global, o con la cascada".
- IS-3 | En un modal con mapa, el especialista arma la SECUENCIA de puntos: clic en el mapa inserta el siguiente punto, marcadores numerados y polylinea los une en orden; puede reordenar, editar y eliminar. | Pedido: "para que salga este modal con el mapa y poder ir buscando"; "agregar la salida, despues agregar el siguiente punto".
- IS-4 | Al calcular, el especialista ve TABLAS comparables de vuelos y de hoteles de paso, cada opcion con su link de compra y su captura de pantalla. | Pedido: "un boton de calcular... y que nos de una tabla con los vuelos, caputras de pantalla, hoteles de paso".
- IS-5 | El especialista ELIGE la opcion que quiere y la envia. Su eleccion queda registrada con las alternativas que descarto. | Pedido: "unos costos. el mismo pueda seleccionar el que deseee".
- IS-6 | Lo enviado llega al perfil administrador en una tabla donde cada fila tiene al menos dos botones: **Autorizar** (uno por uno) y **Ver opciones**. | Pedido: "en la ui una tabla con un par de botones, como autorizar uno por uno, y ver las opciones que le avia dado a cada uno".
- IS-7 | "Ver opciones" muestra TODO lo que se le ofrecio a esa persona, **incluido lo que rechazo**, con todas sus capturas de pantalla. | Pedido: "(las que rechazaron) con todo y las capturas".
- IS-8 | El administrador puede cambiar el vuelo por otro, cambiar costos, agregar partidas extra y quitar partidas. Cada cambio deja rastro de que, cuando y por que. | Pedido: "puede cambiar el vuelo, o los costos, agregar algun costo extra, o quitar o de plano cambiar por otros vuelos".
- IS-9 | El concentrado se IMPRIME con formato identico a los Excel reales (ASK-ADM-FOR-008): encabezado con Nombre/Gerencia/Fecha, tabla de 20 renglones con No./Solicitante/Fecha/Origen/Destino/Transporte/Automovil propio/Hospedaje/Comida/Taxi/Total, fila de totales, y bloque de firmas REVISOx3 + AUTORIZO. | Pedido: "el concentrado (similar a los exceles, de hecho se va a imprimir un formato identico)".
- IS-10 | Todo se persiste en SQL Server: solicitudes, opciones ofrecidas, opciones elegidas, cambios del administrador, estado de autorizacion. | DECIDIDO por el usuario en la ronda anterior.
- IS-11 | Si un proveedor no responde, la fila lo dice explicitamente y nunca muestra precio inventado como real. | Tracker T4 ya lo exige: "Unknown prices remain unknown, not zero".
- IS-12 | Nada de lo que ya funciona se degrada: print actual, ejemplos FOR-007/FOR-008, compartir viaje, 12 km/L, catalogo de municipios. | AGENTS.md + trabajo T1-T4 ya verde.

**GAP-n | diferencia entre IS-n y hoy | razon | cerrada por todo(s)**
- GAP-1 | No hay wizard: todo en un `Card` de 637 lineas. | IS-1 | T1
- GAP-2 | No hay modal con mapa; el mapa esta embebido inline y solo admite UN punto. | IS-3 | T3
- GAP-3 | La cascada vive colapsada dentro de `PuntoMapaPicker` y no es un camino de primera clase. | IS-2 | T2
- GAP-4 | No hay secuencia de puntos con polylinea ni reordenamiento. | IS-3 | T3
- GAP-5 | Vuelos y hoteles se renderizan como `<ul>` de texto, no como tablas; y los vuelos son FABRICADOS. | IS-4 | T5, T6
- GAP-6 | No existe ninguna captura de pantalla. | IS-4 | T7 |
- GAP-7 | No existe prompt de pi ni contrato de intercambio. | IS-4 | T6
- GAP-8 | El autocompletado actual viola la politica de Nominatim. | IS-2 + riesgo verificable | T2 |
- GAP-9 | No existe flujo de solicitud: nada se guarda, nadie recibe nada. | IS-1, IS-5, IS-10 | T8, T9 |
- GAP-10 | No existe bandeja de autorizacion. | IS-6 | T9 |
- GAP-11 | No hay vista de "opciones rechazadas". | IS-7 | T10 |
- GAP-12 | El administrador no puede editar nada. | IS-8 | T11 |
- GAP-13 | El print actual no replica ASK-ADM-FOR-008. | IS-9 | T12 |

## Components (topology ledger)

| id | outcome | status | evidence path |
|---|---|---|---|
| C1 | Wizard de 4 pasos | active | `pages/costos/ViaticosPage.tsx:255-520` |
| C2 | Buscador global Y cascada, ambos first-class | active | `components/PuntoMapaPicker.tsx:41-58,166-200` |
| C3 | Modal de mapa con secuencia, marcadores numerados y polylinea | active | nuevo `components/SelectorRutaModal.tsx` |
| C4 | Tablas de vuelos y hoteles con link + captura | active | `ViaticosPage.tsx:626-666` |
| C5 | Capturas con Playwright | active | nuevo script de captura |
| C6 | Prompt de pi + JSON Schema + importador | active | nuevo `lefarma.docs/viaticos/prompts/` |
| C7 | Modelo de datos de solicitudes/opciones/autorizacion | active | nuevo `lefarma.database/viaticos/0003_*.sql` |
| C8 | API de solicitudes (crear, listar, detalle) | active | nuevo `Features/Viaticos/SolicitudesController.cs` |
| C9 | Bandeja de autorizacion (admin) | active | precedente `educacion-medica/pages/taller/BandejaAprobacionesPage.tsx` |
| C10 | Vista de opciones rechazadas con capturas | active | nuevo |
| C11 | Edicion de costos/vuelo por admin | active | nuevo |
| C12 | Print ASK-ADM-FOR-008 | active | `pages/costos/CostosViaticosPrint.tsx` |
| C13 | Permisos `viaticos.*` | active | `Shared/Constants/AuthorizationConstants.cs` |
| C14 | ADR que reconcilia ADR-00003 | active | `lefarma.docs/educacion-medica/decisiones/` |

## Open assumptions (announced defaults)

| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| Que es "pi" | Agente externo cuyo JSON se pega en la UI | DECIDIDO por el usuario. No hay ninguna referencia a `pi` en el repo. | si |
| Alcance del buscador | Ambos caminos (global y cascada) visibles como tabs, sin que uno sea "el correcto" | DECIDIDO por el usuario: "la cascada es opcional". | si |
| Agrupacion del concentrado | Por periodo mensual + gerencia, que es como esta el Excel real | El Excel agrupa por mes y repite "Gerencia" en el encabezado. | si |
| Estados de una solicitud | `borrador` -> `enviada` -> `autorizada` / `rechazada`, mas `autorizada_con_ajustes` | El flujo pedido es: envia, admin revisa, autoriza o ajusta. | si |
| Quién autoriza | superadmin, hardcodeado, sin matriz de permisos completa | El usuario dijo: "de momento el superadmin vamos a programar con el... despues nos hacemos pelotas de quien puede ver que cosa". | si |
| Adjustment trace | Toda edicion del admin guarda actor, timestamp, valor anterior y nuevo | Un ajuste de costo sin rastro no es auditable y el concentrado impreso deja de ser defendible. | no (debe ser asi) |
| Cobertura de "todos los vuelos y transportes" | El prompt EXIGE cobertura; el JSON declara `cobertura_declarada` y `transportistas_no_encontrados`. NO se promete 100%. | Ni `pi` ni Playwright pueden probar exhaustividad. | n/a |
| Origen del concentrado | Se arma de las solicitudes AUTORIZADAS del periodo, no de todas las enviadas | El Excel es un instrumento de gasto autorizado; mezclar rechazadas falsearia el total. | si |
| Idioma | Todo en espanol (UI, prompt, SQL, docs) | AGENTS.md y estado actual del modulo. | si |

## Findings (cited - path:lines)

1. **El mapa y la cascada YA EXISTEN, y ya hacen los dos caminos.** `PuntoMapaPicker.tsx:43` `urlBusquedaGlobal(texto)` (Nominatim `q=`) y `:49` `urlBusquedaGuiada(estado, municipio, direccion)` (Nominatim `state`/`city`/`street`). Es exactamente "buscador global o cascada". Se usan en origen (`:358`) y destino (`:388`). 10 tests cubren cascada, debounce, throttle y fallo de red. **GAP-2 y GAP-3 son problemas de UI, no de construccion.**
2. **No hay polylinea ni multipunto.** `tool.grep` de `polyline|Polyline|dragend` en `RutasPage.tsx` -> 0. Leaflet trae `Polyline` nativo; no hace falta dependencia.
3. **Vuelos FABRICADOS.** `CalculoCostosRuta.cs:318-338`: `ft = 0.5 + kmAerea/760.0`, `base_ = 690 + kmAerea*1.45`, multiplicadores Viva 0.82 / Volaris 0.90 / Aeromexico 1.32, `fuente = "estimado fase 1 (sin proveedor; interfaz IVuelosClient lista)"`.
4. **Hoteles reales pero sin precio ni foto.** `:208-240` Overpass `node(around:9000)["tourism"="hotel"]` da nombre+distancia; el precio sale de `Viaticos[key].HospedajeNoche` (seed). `grep wikidata|image|foto|photo|commons` -> **0 coincidencias**.
5. **Conectores reales ya establecidos:** OSRM `:165`, CNE gasolina `:178`, Overpass `:238`, ClickBus `:254`, Distribusion `:291`. Patron "conector + fallback + `fuente`" ya existe.
6. **Cero soporte de captura.** `grep screenshot|playwright` en `src/` y `tests/` -> solo `tests/login.spec.ts` y `tests/multi-app-login.spec.ts`. Sin worker, sin campo de imagen en los DTOs.
7. **Formato EXACTO del concentrado, verificado en los Excel reales.** `pruebas de gastos/markdown/VIATICOS EDUCACION MEDICA OCTUBRE 2026.md`: encabezado "Concentrado de Viáticos"; fila `Nombre: DANIEL PADILLA | Gerencia: EDUCACION MEDICA | Fecha: 2026-09-01`; columnas de dos filas: `No. | Solicitante | Fecha | Origen | Destino | Transporte{Costo boleto Autobus, Costo boleto Avion} | Automovil propio | Hospedaje | Comida | Taxi | Total`; 20 renglones; fila `Total` con sumas `$16,481.00` bus, `$137,630.00` avion, `$52,896.00` hospedaje, `$25,100.00` comida, `$44,250.00` taxi, `$276,357.00` total; bloque de firmas `REVISÓ` x3 (Coordinador Administrativo / Gerente General / Gerente de Administración y Finanzas) + `AUTORIZÓ` (Dirección Corporativa); pie `ASK-ADM-FOR-008 | Versió:01 | Prohibida su reproducción no autorizada`.
8. **Formato de solicitud de avión, verificado.** `VUELOS EDUCACION MEDICA OCTUBRE 2026.md`: "Solicitud de avión", por solicitante con `Nombre completo`, `Puesto`, `Fecha de nacimiento`, y tabla ida/vuelta: `Fecha de salida | Hora planeada de salida | Origen | Destino | Motivo`. Los motivos son texto largo que enumera los hospitales con codigos HGZ.
9. **Precedente EXACTO de bandeja con permisos.** `educacion-medica/pages/taller/BandejaAprobacionesPage.tsx:74` `usePermission({ require: PERMISO_VER_TODOS })`; `:146,162` filtra; `:266-288` `accion: AccionWorkflow` + `idAccion` + refetch; `components/BandejaTable.tsx:193` `tableId` de TanStack. Backend: `Features/EducacionMedica/AprobacionesController.cs:34-39` `TienePermiso(Permissions.EducacionMedica.BandejaVerTodos)`. **Se puede copiar casi linea por linea.**
10. **El mecanismo de permisos existe y es por CODIGO, no por claim.** `Shared/Constants/AuthorizationConstants.cs`: clases anidadas (`Catalogos`, `OrdenesCompra`, `Usuarios`, `Vacaciones`...) con `public const string View = "..."`. Fuente de verdad: `app.Permisos` en BD. `Vacaciones` ya tiene el patron exacto que hace falta: `Ver`, `SaldosVer`, `SolicitudesCrear`.
11. **AGENTS.md miente sobre `RequireAdministrator`.** Dice "role-based policies (`RequireAdministrator`, `RequireManager`, `RequireFinance`)". `tool.grep "RequireAdministrator|RequireSuperAdmin|superadmin"` sobre 724 archivos del backend -> **0 coincidencias**. No existe tal policy. Hay que usar el patron de `Permissions` + `TienePermiso`, no `[Authorize(Roles=...)]`.
12. **Solo `[Authorize]` en los controllers de Viaticos.** `CostosRutaController.cs:13`, `MunicipiosController.cs:14`. Sin identidad de solicitante.
13. **El modulo es "fase 1 demo aislada", sin BD transaccional.** `CostosRutaController.cs:11-31` solo `POST api/viaticos/costos-ruta/calcular`, "Stateless, sin BD". Unica tabla: `viaticos.municipios_cat` (`lefarma.database/viaticos/0002_...sql:83-98`). **Persistir solicitudes obliga a SQL nuevo.**
14. **Dependencias:** NO hay `maplibre-gl`, `react-map-gl`, `@react-google-maps/api`, `@tanstack/react-query`, `msw`. SI hay `react-leaflet ^5.0.0`, `leaflet ^1.9.4`, `cmdk ^1.1.1`, `sonner ^2.0.7`, `vitest ^3.2.4`, `@playwright/test ^1.58.2`, `@testing-library/react ^16.1.0`, `zustand`, `react-hook-form`, `zod`, `axios`, `@tanstack/react-table ^8.21.3`.
15. **54 primitivas UI disponibles**, incluidas `dialog.tsx`, `modal.tsx`, `command.tsx` (Combobox), `popover.tsx`, `tabs.tsx`, `table.tsx`, `data-table.tsx`, `sheet.tsx`, `progress.tsx`, `accordion.tsx`. Precedente de modal: `ResumenSeleccionModal.tsx:5` usa `Modal` de `@/components/ui/modal`.
16. **Nominatim prohibe el autocompletado en cliente.** operations.osmfoundation.org/policies/nominatim: "Auto-complete search: STRICTLY FORBIDDEN ... you must not implement such a service on the client side using the API"; max 1 req/s; exige User-Agent/Referer identificable. `PuntoMapaPicker.tsx:43` lo hace desde el navegador con debounce 400ms. **Riesgo verificable.**
17. **Tracker activo.** `odd/tasks/costos-ruta-formulario.md`: T1 backend verde con live 400 sin resolver, T2 en correccion, T3 pendiente (Playwright), T4 in progress, y literal **"NO commits while iterating"** + "No stage, reset, commit, push".
18. **`dirty_worktree`:** `appsettings.Development.json` modificado (DefaultConnection -> `LefarmaDev`), `odd/tasks/costos-ruta-formulario.md` y `pruebas de gastos/` (8 XLSX, ~8.3 MB) sin trackear. Fuera de alcance.
19. **`pruebas de gastos/` contiene los 20 viajes de octubre** ya(tabulados: CESAR MARTIN GARCIA ALONSO x4, JUAN PABLO PEÑA PORTILLO x4, SANTIAGO GARCIA GUTIERREZ x4, ANGEL REMEDIOS CADENA BARRERA x2, ROBERTO CRUZ GUERRERO x3, etc). Sirven de fixture de regresion para el print.
20. **Sin infraestructura de pi en el producto.** `find -iname "*prompt*"` solo da `lefarma.docs/DOCUMENTATION_PROMPT.md` y `node_modules`. No hay `.pi`, ni agente declarado.

## Decisions (with rationale)

- **D1 Wizard de 4 pasos.** Pedido explicito.吸收 el formulario actual como Paso 1.
- **D2 Dos buscadores first-class.** Tabs "Busqueda global" / "Por estado y municipio" dentro del modal. Ambos alimentan el mismo `PuntoSeleccion`. Cierra IS-2.
- **D3 Reutilizar `PuntoMapaPicker` dentro de un nuevo `SelectorRutaModal`.** Ya tiene los dos buscadores y10 tests. Forzar uno nuevo seria reescribir lo cubierto.
- **D4 Secuencia = extension de `DestinationForm[]`.** Ya es array ordenado con `id`; agregar `orden` y `Polyline` es incremental.
- **D5 `pi` externo y manual (prompt + JSON pegado).** DECIDIDO.
- **D5b Link de compra + captura por opcion, obligatorios.** DECIDIDO: "devolver... con capturas de pantalla y links para ir a comprar de inmediato".
- **D5c Persistencia en SQL Server.** DECIDIDO. Rompe "demo sin BD"; por eso C7 y C14 son obligatorios.
- **D5d Capturas con Playwright local.** DECIDIDO. Sin scraping contra Booking/Expedia/aerolineas: solo paginas publicas de resultado y deep-links de transportistas.
- **D6 Vuelos estimados y cotizados de `pi` NUNCA en la misma tabla sin columna `fuente`.** Cierra IS-11.
- **D7 Solicitudes guardadas con identidad del solicitante (JWT).** Sin esto no hay "quien envio" ni bandeja. Requiere leer el user id del token.
- **D8 El concentrado impreso sale de solicitudes AUTORIZADAS.** Un instrumento de gasto no puede mezclar rechazadas.
- **D9 Los ajustes del admin son una capa encima, no una edicion destructiva.** El valor original del solicitante se conserva; el ajuste se guarda como evento con actor/fecha/valor anterior/nuevo/motivo.asi el concentrado sigue siendo auditable.
- **D10 Permisos `viaticos.solicitar`, `viaticos.ver_todos`, `viaticos.autorizar`, `viaticos.ajustar`.** Mapeados a `Permissions` + `TienePermiso`, NO a `[Authorize(Roles=...)]` que no existe (finding 11). El usuario dijo superadmin por ahora; el codigo de permiso deja la puerta abierta sin adivinar la jerarquia.
- **D11 El print se genera desde datos persistidos, no desde el estado en memoria.** Si el concentrado se arma al imprimir, no se puede reimprimir igual manana.
- **D12 NO commits automaticos.** Tracker dice "NO commits while iterating".

## Scope IN

- Wizard de 4 pasos en `ViaticosPage`.
- `SelectorRutaModal` con Leaflet: marcadores numerados, `Polyline`, reordenar/editar/eliminar.
- Tabs de busqueda: global y cascada, ambos first-class.
- Sustitucion del autocompletado Nominatim-en-navegador por patron conforme a politica.
- Tablas comparables de vuelos y hoteles con link de compra y captura.
- Prompt versionado de `pi` + JSON Schema + importador.
- Worker Playwright de capturas.
- SQL nuevo: solicitudes, opciones, selections, ajustes, estados.
- API de solicitudes y de autorizacion.
- Bandeja de autorizacion para admin.
- Vista de opciones rechazadas con capturas.
- Edicion de costos/vuelo por admin, con rastro.
- Print ASK-ADM-FOR-008.
- Permisos `viaticos.*`.
- ADR que reconcilia ADR-00003.
- Tests Vitest nuevos + updates de los existentes.

## Scope OUT (Must NOT have)

- NO tocar el modulo `educacion-medica` (ADR-00001/00002, `RutasPage`, `HospitalesMap`, `BandejaAprobacionesPage`). Se LEE como precedente, no se modifica.
- NO tocar `educacion_medica.viatico_tarifas` ni las tablas de catalogo existentes: el SQL nuevo solo AGREGA tablas.
- NO cambiar `CalculoCostosRuta.cs` mas alla de etiquetar `fuente` en vuelos.
- NO modificar `Program.cs` globalmente (serializer, policies).
- NO tocar `appsettings.Development.json`, `odd/tasks/costos-ruta-formulario.md` ni `pruebas de gastos/`.
- NO commits, push, PR ni tags sin OK explicito.
- NO scraping de Booking/Expedia/aerolineas (viola ToS).
- NO agregar `maplibre-gl`, `react-map-gl`, `@react-google-maps/api`, ni proveedor de vuelos/hoteles en runtime.
- NO implementar la matriz completa de "quien ve que" (el usuario la pospuso explicitamente).
- NO refactor de `educacionMedicaApi.regiones` ni del catalogo de municipios.

## Resolved owner-decisions

- **R1 (2026-10-07) Como llega la busqueda:** `pi` investiga; el producto consume su JSON. Sin proveedor HTTP en runtime.
- **R2 (2026-10-07) Capturas:** Playwright local contra la URL de compra que entrega `pi`.
- **R3 (2026-10-07) Persistencia:** SQL Server, nuevo script `lefarma.database/viaticos/0003_*.sql` + endpoints.
- **R4 (2026-10-07) Cascada:** OPCIONAL. Buscador global y cascada son ambos caminos de primera clase.
- **R5 (2026-10-07) Quien autoriza:** superadmin por ahora; permisos por codigo para no cerrarle la puerta a la jerarquia real.

## Open questions

Ninguna bloqueante.

Limitaciones que el plan documenta en lugar de prometer resolver:
- "todos los vuelos y transportes que operen en Mexico" no es garantizable. El JSON declara cobertura y faltantes.
- Los vuelos del motor actual siguen estimados por formula; las filas de `pi` son cotizaciones externas. `fuente` las separa.
- Sin proveedor en runtime, la busqueda depende de que `pi` este disponible: costo operativo aceptado por el usuario.
- Sin scraping, las capturas dependen de que las paginas publicas de cada transportista carguen en headless.
- La matriz "quien ve que" queda fuera por decision del usuario.

## Approval gate

status: awaiting-approval

Owner-decisions resueltas 2026-10-07. Pendiente: OK explicito del usuario.
- Aprobacion autoriza **escribir el plan** unicamente. La ejecucion arranca aparte (`/ulw-execute`).
- Secuencia post-aprobacion: escribir `.omo/plans/viaticos-wizard-ruta-pi-busqueda.md` -> gap analysis con plan-consultant -> revision de alta precision con plan-reviewer (5 rondas maximo) -> entrega.
- Se puede renunciar a la revision de alta precision diciendolo.
