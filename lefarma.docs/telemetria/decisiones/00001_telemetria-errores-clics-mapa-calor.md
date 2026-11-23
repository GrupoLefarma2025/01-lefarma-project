---
fecha_creacion: 2026-11-20 12:40
fecha_modificacion: 2026-11-20 16:56
resumen: Módulo Telemetría — dos fuentes separadas y un solo panel de observabilidad. Los errores del servidor ya existen en SQL Server (tabla ErrorLog, escrita por WideEventLoggingMiddleware): no se duplican, solo se consultan. Los eventos nuevos del navegador (errores de JavaScript, clics por botón, mapa de calor del puntero, scroll y tiempo en página) viajan al API en lotes diferidos y se guardan en SQL Server, en un esquema `telemetria` propio (evento_error, evento_clic, mapa_calor, visita, lote_procesado y parametro), con un servicio en segundo plano que inserta por lotes, retención configurable y el respaldo normal de la base. El navegador solo conserva un búfer temporal en IndexedDB para reenviar si se corta la red. SDK de captura con centinela de arranque en index.html, mapa de calor agregado en celdas de 32 px por vista de página, privacidad por diseño (hash con sal del usuario, sin valores de formulario ni teclas, rutas excluidas) y panel con el permiso telemetria.ver.
---

# 00001 — Telemetría de errores, clics y mapa de calor

## Status

Accepted

> Decisión de diseño propia del módulo. No reemplaza ningún ADR anterior y no
> toca tablas existentes: agrega un esquema `telemetria` propio en SQL Server
> (creado por un script manual) y reutiliza `ErrorLog` en modo lectura. Aprobada
> por el humano el 2026-11-20 junto con el plan de implementación de la tarjeta
> #fa8dbed3. El mismo día, ya con la fase 8 cerrada, el humano precisó que el
> almacén definitivo debe ser **SQL Server** y que la «base local» solo aplica al
> búfer del navegador: el módulo se migró de DuckDB a SQL Server sin cambiar el
> contrato de eventos ni el SDK. Las decisiones que estaban abiertas quedaron
> cerradas con los valores por omisión que se listan al final, y el contrato de
> eventos quedó fijado en este documento.

## Índice

- [[#Status|Status]]
- [[#Contexto|Contexto]]
- [[#Decisión|Decisión]]
- [[#Alternativas consideradas|Alternativas consideradas]]
- [[#Fase 1 — Contrato de eventos y esquema en SQL Server|Fase 1 — Contrato de eventos y esquema en SQL Server]]
- [[#Fase 2 — Escritor, retención y respaldo|Fase 2 — Escritor, retención y respaldo]]
- [[#Fase 3 — API de ingesta y correlación|Fase 3 — API de ingesta y correlación]]
- [[#Fase 4 — SDK: errores del navegador|Fase 4 — SDK: errores del navegador]]
- [[#Fase 5 — SDK: clics, puntero y envío diferido|Fase 5 — SDK: clics, puntero y envío diferido]]
- [[#Fase 6 — API de consulta y panel|Fase 6 — API de consulta y panel]]
- [[#Fase 7 — Instrumentación, exclusiones y afinación|Fase 7 — Instrumentación, exclusiones y afinación]]
- [[#Fase 8 — Avisos proactivos y pruebas|Fase 8 — Avisos proactivos y pruebas]]
- [[#Validación|Validación]]
- [[#Consequences|Consequences]]
- [[#Contrato de eventos|Contrato de eventos]]
- [[#Decisiones cerradas|Decisiones cerradas]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Contexto

La petición del humano (20-nov-2026) es saber **qué falla y qué se usa** sin
depender de que alguien lo reporte: errores del navegador guardados en el
momento, clics por botón y un mapa de calor de dónde está el puntero, con una
base local (DuckDB) y un worker que mande los errores a un endpoint.

> **Precisión posterior del humano (mismo día):** «se tienen que guardar en sql
> […]. Lo de DuckDB era para el front: para que se guardaran ahí y de ahí
> constantemente un worker del front los mandara, y si se corta la conexión
> tener ahí los errores y reenviarlos cuando vuelva». El almacén definitivo es
> SQL Server; el almacén local del navegador es el búfer de salida.

Lo que ya existe y **no** hay que rehacer:

- El backend ya registra un `WideEvent` por petición y persiste los errores de
  servidor (HTTP 5xx y excepciones no controladas) en la tabla `ErrorLog` de SQL
  Server, con tipo, mensaje, stack, endpoint, usuario, `RequestId` y `TraceId`
  (`Infrastructure/Middleware/WideEventLoggingMiddleware.cs:99-105`,
  `Features/Logging/ErrorLogService.cs:24-72`). **Ninguna pantalla los muestra.**
- No existe nada del lado del navegador: ninguna captura de `window.onerror`, de
  `unhandledrejection` ni `ErrorBoundary` (un fallo de render deja hoy la pantalla
  en blanco), ningún clic registrado y ningún almacén analítico. Hay 11 rutas de
  primer nivel en `lefarma.frontend/src/apps/baseapp/BaseAppRoutes.tsx:56-166` y
  cero usos de `data-track`; los 92 `data-testid` y 262 `aria-label` son la
  materia prima para identificar botones.
- No hay rate limiting, ni `BackgroundService`, ni middleware de excepciones, ni
  carpeta de migraciones EF (el esquema se aplica con scripts numerados y un
  runner DbUp).

Lo que condiciona el diseño:

- **Un solo proceso por ambiente.** El despliegue detiene y arranca el pool
  (`deploy/lefarma-autodeploy.ps1:15-24`) y no hay webfarm. El almacén definitivo
  es la instancia de SQL Server que ya usa el sistema: no hace falta añadir un
  servidor ni un motor nuevo.
- **La app ya escribe datos persistentes bajo el sitio** (`wwwroot/media/archivos`,
  `wwwroot/media/capturas-viaticos`, `App_Data/sigma-documentos`), de modo que la
  identidad del pool ya tiene permiso de escritura en `App_Data`.
- **El volumen de un mapa de calor es alto** (una fila por vista de página con
  una rejilla de cientos de celdas) y sus consultas son de agregación, no
  transaccionales. En SQL Server se resuelve guardando la rejilla compacta
  (`varbinary` con int32 little-endian, 1 800 celdas ≈ 7 KB), indexando por ruta
  y fecha, y agregando al consultar con un tope de filas por periodo.

## Decisión

1. **Dos fuentes, un panel.** Los errores del servidor se leen de `ErrorLog`
   (SQL Server) sin copiarlos; los eventos del navegador se guardan en el esquema
   `telemetria` de la misma base, en tablas propias. El panel los presenta juntos
   pero cada pestaña sabe de dónde lee. No se duplica ni se reescribe lo que ya
   funciona.
2. **SQL Server como almacén definitivo, un esquema aparte.** Las tablas viven en
   el esquema `telemetria` (script manual
   `lefarma.database/telemetria/0001_*.sql`), no en `dbo` ni mezcladas con el
   negocio. Entran en el respaldo normal de la base y se consultan con las mismas
   credenciales. El navegador solo guarda un búfer temporal en IndexedDB.
3. **Escritura por cola y lote.** La ingesta solo valida y encola en un
   `Channel` acotado y responde `202`; un `BackgroundService` inserta por lotes de
   hasta 500 eventos en una transacción. Si la base falla, la telemetría se
   descarta y se cuenta: **nunca rompe la petición del usuario ni la app**.
4. **Durabilidad donde importa.** Los errores se persisten en IndexedDB y se
   reintentan, porque son el dato que no se puede perder. Los clics y el mapa de
   calor viven en una cola en memoria y salen cada 15 segundos o al abandonar la
   página (`fetchLater`): perder los últimos segundos de analítica es aceptable y
   evita escribir miles de filas en el navegador.
5. **Envío diferido con `fetchLater`.** El envío no se hace por evento: se
   agrupa y se deja que el navegador lo mande al salir, con respaldo a
   `fetch` + `keepalive` y `sendBeacon`. El detalle que obliga al respaldo: la
   cabecera `Authorization` no se puede poner con `sendBeacon`.
6. **Mapa de calor agregado en el cliente.** El puntero se muestrea a 10 Hz y se
   acumula en celdas de 32 px por vista de página; nunca se envía el
   `mousemove` crudo. Una fila por vista de página, con la rejilla completa y
   metadatos (viewport, ruta, rol, versión). Si cambia el tamaño de la ventana se
   cierra la fila y empieza otra.
7. **Identidad estable de botón.** `data-track` > `id` > `aria-label` > `name` >
   texto visible normalizado, más la ruta. Sin valores de campos, sin texto de
   inputs, sin capturas de pantalla.
8. **Privacidad por diseño.** El usuario **no viaja en la carga útil**: el API lo
   toma del token y guarda solo un hash con sal. Los eventos capturados antes de
   iniciar sesión se marcan como anónimos y no se atribuyen a nadie. Sin teclas,
   sin portapapeles, sin valores de formularios, sin cuerpos de petición, con
   rutas excluibles por configuración y retención limitada.
9. **Centinela de arranque inline.** Un script mínimo en `index.html`, antes del
   bundle, captura el fallo de carga del propio JavaScript y la pantalla en
   blanco a los 10 segundos. Es el único modo de enterarse cuando la app no
   llega a arrancar. Se suma al script inline de tema que ya existe
   (`lefarma.frontend/index.html:9-16`), sin tocar el bundle.
10. **Correlación con el servidor.** `WideEventLoggingMiddleware` agrega la
    cabecera `X-Request-Id` a la respuesta; el interceptor del navegador la guarda
    en el evento de error HTTP, de modo que un error visto por el usuario se puede
    saltar a su fila de `ErrorLog`.
11. **Todo falla en silencio.** Cada captura va envuelta: si la telemetría lanza,
    se ignora. Si el almacén no abre, el panel lo dice pero la app sigue.
12. **Permisos propios.** `telemetria.ver` y `telemetria.administrar` se siembran
    en `Asokam.app.Permisos` y se asignan a los roles que ya usan el sistema
    (`ver`: SuperAdministrador, Administrador y Gerente General; `administrar`:
    SuperAdministrador). Se cambian desde la pantalla de Permisos sin tocar código.

## Alternativas consideradas

| Alternativa | Por qué no (o cuándo sí) |
| --- | --- |
| **A. SQL Server con esquema propio + SDK con envío diferido** (elegida) | Cero infraestructura nueva, respaldo y credenciales ya resueltos, y el panel consulta con lo mismo que ya usa el sistema. Costo: la analítica convive con el negocio; se mitiga con esquema aparte, índices por fecha/ruta y purgas por lotes. |
| **B. DuckDB embebido** (descartada) | Aísla la analítica del OLTP y comprime muy bien la rejilla, pero añade un segundo motor y una dependencia nativa (≈ 35 MB del binario de Windows dentro de 315 MB del paquete), un archivo más que respaldar fuera de SQL Server y un modo de escritor único. El humano pidió expresamente que el almacén sea SQL Server. |
| **C. `duckdb-wasm` en el navegador como «base local»** | Es un motor completo en WebAssembly (≈ varios MB), de un solo hilo por defecto y con techo de 4 GB: pesa en el arranque de una app interna y complica el respaldo, porque los datos viven en cada equipo. Se descarta para el buffer; el «worker» se queda como worker de IndexedDB. |
| **D. Servicio externo (Sentry, Application Insights)** | Menos código, pero saca datos de la red interna, tiene costo por volumen y no se integra con `ErrorLog` ni con los permisos de Lefarma. |

## Fase 1 — Contrato de eventos y esquema en SQL Server

**Qué**

- Script manual `lefarma.database/telemetria/0001_20261120-2015_telemetria_esquema-sql-server.lefarma.sql`
  (idempotente, sin `GO` para que el panel lo ejecute en un lote): crea el
  esquema `telemetria` y seis tablas —`lote_procesado` (control de idempotencia),
  `evento_error`, `evento_clic`, `mapa_calor`, `visita` y `parametro` (guarda la
  sal del hash)— con índices por fecha, huella, ruta y elemento. Se aplica a mano
  desde la Bandeja del panel SQL Explorer; nunca con `dotnet ef migrations`.
- Entidades EF y configuraciones en
  `Domain/Entities/Telemetria/` y `Infrastructure/Data/Configurations/Telemetria/`
  (esquema `telemetria`, `datetime2(3)`, nombres de columna explícitos) y seis
  `DbSet` en `ApplicationDbContext`.
- Contrato único de evento (JSON) con `tipo`, `ocurridoEn`, `visitaId`,
  `loteId`, `ruta`, `versionApp` y los campos de cada tipo. Tope de 100 eventos y
  256 KB por lote; textos truncados en el servidor.
- `mapa_calor` guarda la rejilla como `varbinary` (int32 little-endian por celda,
  largo `columnas * filas`) más `tamano_celda`, viewport, `movimientos`, scroll y
  segundos visibles. El cliente manda solo las celdas con muestras; el servidor
  densifica antes de guardar.

**Por qué**

- Un contrato por tipo deja crecer el SDK sin migrar la tabla, y el `loteId` da
  idempotencia barata: si el mismo lote llega dos veces (envío normal y beacon de
  salida), el escritor lo detecta en `lote_procesado` y lo descarta.
- La rejilla compacta evita una tabla de celdas (1 800 filas por vista) sin
  renunciar a la consulta: el API carga hasta 2 000 rejillas del periodo, elige la
  dimensión dominante y suma en memoria, que para este volumen es más barato que
  un `UNPIVOT` en la base.
- Las tablas en un esquema propio permiten purgar y respaldar distinto sin tocar
  el negocio, y dejan claro en cualquier consulta que no son datos operativos.

## Fase 2 — Escritor, retención y respaldo

**Qué**

- `TelemetriaRepositorio` (scoped) es el único punto de escritura: registra el
  lote, inserta los eventos en una transacción, resuelve la sal
  (`parametro.sal_usuario`) y ejecuta la retención con `ExecuteDeleteAsync` por
  tabla (`evento_error` 180 días, `evento_clic` 90, `mapa_calor` 365, `visita`
  365).
- `TelemetriaEscritor` (`BackgroundService`) drena el `Channel` cada 2 segundos o
  cada 500 eventos y registra contadores (encolados, escritos, descartados,
  repetidos, último error, último vaciado) para el endpoint de estado.
- Retención diaria a los 10 minutos del arranque y cada 24 horas, con bitácora de
  filas borradas por tabla. El respaldo es el de SQL Server: no hay Parquet ni
  archivo aparte.
- Verificación de arranque: si la base o las tablas no están, `/estado` lo
  reporta con `disponible: false` y un mensaje; el API sigue funcionando y la
  ingesta no escribe en disco.

**Por qué**

- Un `BackgroundService` es el patrón correcto para desacoplar la latencia del
  usuario de la escritura analítica; hoy el repo no tiene ninguno, así que este
  es el primero y se documenta como precedente.
- `Channel` acotado con política de descarte: bajo ráfaga de errores (un bucle de
  fallos) es preferible perder eventos viejos de analítica que crecer sin límite
  en memoria.
- Borrar por lotes con `ExecuteDelete` en la tabla y su índice de fecha evita
  bloqueos largos; para el volumen estimado (unas 3 000 visitas y 30 000 clics al
  día) alcanza de sobra.

## Fase 3 — API de ingesta y correlación

**Qué**

- `POST /api/telemetria/eventos` (autenticado) y
  `POST /api/telemetria/eventos-anonimos` (sin token, solo errores de arranque,
  login y pantalla en blanco). Responden `202` con `ApiResponse` y contadores.
- Rate limiting con el middleware nativo: por usuario en el autenticado, por IP
  en el anónimo. No existe hoy en el backend, así que se agrega solo para estas
  rutas.
- `X-Request-Id` en la respuesta desde `WideEventLoggingMiddleware`.
- `GET /api/telemetria/estado` (permiso `telemetria.administrar`) con el destino
  (`servidor · base`), filas por tabla, profundidad de la cola y descartes.

**Por qué**

- El endpoint anónimo es imprescindible: un fallo de login o de arranque ocurre
  justo cuando no hay token. Se limita por IP y se acepta solo ese puñado de
  tipos, para que no sea una puerta abierta.
- La cabecera de correlación es una línea en el middleware existente y ahorra el
  salto manual entre «lo que vio el usuario» y «lo que registró el servidor».

## Fase 4 — SDK: errores del navegador

**Qué**

- `src/shared/telemetria/`: `iniciarTelemetria()` invocado antes del render en
  `lefarma.frontend/src/main.tsx:18`, captura de `window.onerror`,
  `unhandledrejection`, `ErrorBoundary` de React (con `componentStack`), errores
  HTTP ≥ 400 del interceptor existente en
  `lefarma.frontend/src/shared/api/apiClient.ts:56-133` y detección de pantalla en
  blanco. El `ErrorBoundary` va en `src/components/layout/MainLayout.tsx` rodeando
  el `<Outlet />` (más uno de último recurso en `src/App.tsx:55-57`) y **no
  muestra pantalla de respaldo**: el módulo queda vacío y al cambiar de ruta se
  reintenta solo, para que la persona no vea un aviso técnico ni tenga que
  recargar (decisión del humano, 2026-11-20).
- Script inline en `index.html` (menos de 2 KB, sin dependencias) que registra
  `window.onerror` antes del bundle y manda el fallo de arranque con
  `fetch(..., {keepalive:true})`.
- Huella (`huella`) = hash de tipo + mensaje normalizado + primeras líneas del
  stack sin números de línea + ruta, para agrupar el mismo error.
- Cola duradera en IndexedDB para errores: se envía de inmediato y se reintenta
  con espera creciente; se descarta a los 7 días o a los 5 000 pendientes.

**Por qué**

- El centinela inline es el único que ve el caso «el bundle no cargó», que es
  justo el que más urge saber y el que ninguna librería puede reportar.
- La huella es lo que convierte «10 000 errores» en «3 problemas»: sin ella el
  panel es ilegible.
- Los errores son pocos y valiosos; por eso sí van a disco y se reintentan.

## Fase 5 — SDK: clics, puntero y envío diferido

**Qué**

- Clic delegado en `document` (fase de captura, pasivo): identidad del elemento,
  ruta, módulo, coordenadas, viewport, rol y si fue teclado o ratón. Clics de
  enojo (3+ clics al mismo elemento en menos de 1 segundo) se marcan como
  derivados en el panel, no se capturan aparte.
- Puntero: muestreo a 10 Hz, rejilla de 32 px, acumulado por vista de página;
  `scroll` máximo y segundos visibles. Al cambiar el viewport se cierra la fila.
- Envío con `fetchLater()` y su polyfill (respaldo `fetch`+`keepalive`, luego
  `sendBeacon`), lotes de hasta 100 eventos o 48 KB, cada 15 segundos, al pasar a
  segundo plano y al descargar la página.
- Interruptores: `VITE_TELEMETRIA_ACTIVA`, muestreo configurable, lista de rutas
  excluidas y opt-out guardado en `localStorage`.
- Respeto a `navigator.doNotTrack`.

**Por qué**

- El muestreo a 10 Hz y la rejilla de 32 px reducen el volumen tres órdenes de
  magnitud frente a guardar cada movimiento, sin perder la forma del mapa.
- `fetchLater` es la forma recomendada hoy para telemetría: el navegador la envía
  aunque el usuario cierre la pestaña, y no rompe el caché de ida y vuelta como
  los manejadores de `unload`.
- El clic delegado evita tocar cada botón para empezar a medir; después se
  afina con `data-track` donde el nombre automático no alcance.

## Fase 6 — API de consulta y panel

**Qué**

- `GET /api/telemetria/resumen`, `/errores-navegador`,
  `/errores-navegador/{huella}/ocurrencias`, `/botones`, `/mapa-calor`,
  `/rutas` y `/errores-servidor` (este último lee `ErrorLog` con EF y
  paginación, solo lectura).
- Panel en `src/apps/telemetria/` como **pantalla propia dentro de Configuración**:
  `/configuracion/telemetria` (carga diferida con `lazy` + `Suspense`), con
  `PermissionGuard
  require="telemetria.ver"`. Aparece en el sidebar de Configuración
  (`configuracionMenuItems`) y también en el del shell (`shellMenuItems`). Se
  descartó el subárbol propio con login y `menuItems.tsx` porque el panel es
  una herramienta de administración, no un módulo de negocio con su ciclo de
  sesión. La pestaña incrustada en la pantalla de Variables se retiró a
  petición del humano (2026-11-20): Telemetría es su propia pantalla.
- Pestañas: **Resumen** (errores de hoy, top huellas, usuarios activos, eventos
  descartados), **Errores del navegador** (agrupados por huella, detalle con
  stack, ocurrencias y usuarios), **Errores del servidor** (la tabla existente,
  filtrable y paginada), **Botones** (por ruta y elemento, con usuarios únicos y
  clics de enojo), **Mapa de calor** (selector de ruta, rejilla CSS con la escala
  naranja y exportación CSV).
- Reutiliza los patrones de administración del repo: `usePageTitle`, tarjetas,
  `Table` y Recharts como en el tablero
  (`lefarma.frontend/src/pages/Dashboard.tsx:84-110`). `DataTable` no aplicaba:
  las filas de errores se expanden y el mapa es una rejilla.
- La capa en canvas y el fondo con iframe quedaron fuera de esta entrega: el
  iframe volvería a ejecutar el SDK dentro del panel y generaría telemetría
  recursiva, y no hay validación visual disponible en esta sesión.

**Por qué**

- El panel es lo que cierra el circuito: sin él, los datos existen y nadie los
  mira.
- Reutilizar `ErrorLog` da valor inmediato sin capturar un solo dato nuevo, y
  separa responsabilidades: el servidor cuenta lo que falló allí, el navegador lo
  que falló en la pantalla.
- El fondo con la pantalla real es lo que hace accionable un mapa de calor; se
  marca que muestra el diseño **actual**, no el de la fecha consultada, y se
  avisa cuando la versión difiere. Queda como siguiente paso: la rejilla por sí
  sola ya ubica las zonas calientes, que es la mayor parte del valor, y el aviso
  de que mide el puntero y no la mirada. Las rutas por sí solas ya dicen qué
  pantallas se usan.

## Fase 7 — Instrumentación, exclusiones y afinación

**Qué**

- `data-track` en los botones principales de los módulos de más uso (CxP,
  viáticos, educación médica), empezando por los que hoy salen como texto suelto.
  Hoy hay 0 `data-track`, 1 119 `<Button` y 92 `data-testid`; el botón reenvía
  props al DOM (`lefarma.frontend/src/components/ui/button.tsx:43-52`), así que
  el atributo funciona sin tocar el componente.
- Lista de rutas excluidas revisada con el humano (pantallas con datos de
  terceros, importes, datos personales).
- Prueba de humo real en pruebas: navegar, provocar un error, verlo en el panel.

**Por qué**

- La identidad automática sirve para arrancar, pero un `data-track` explícito
  sobrevive a cambios de texto y traducciones.
- Las exclusiones son la decisión de privacidad más importante y no se pueden
  adivinar desde el código.

## Fase 8 — Avisos proactivos y pruebas

**Qué**

- Resumen diario por correo con errores nuevos y los más frecuentes; alerta
  cuando una huella nueva aparece 3 veces en 10 minutos. Reutiliza el correo que
  ya usa el sistema de notificaciones. Implementado en
  `Features/Telemetria/Avisos/TelemetriaAvisos.cs`, apagado por omisión con
  `Telemetria:Avisos:Habilitado = false` hasta que existan destinatarios
  confirmados.
- Pruebas: unitarias del normalizador y la huella, de la rejilla y del
  muestreo, del validador de lotes, de la ingesta y de los avisos con dobles; la
  consulta y el repositorio se comprueban contra SQL Server en la prueba de humo
  (las tablas se crean con el script manual, no en cada corrida).

**Por qué**

- «Que me guarde el error antes de que me lo digan» se cumple del todo cuando
  además avisa; guardarlo y no mirarlo es lo mismo que no tenerlo.
- No se simula SQL Server en las pruebas unitarias: se prefirió no meter
  contenedores ni una base de prueba en el pipeline y dejar la verificación
  real en la prueba de humo.

## Validación

| Qué se afirma | Cómo se comprueba |
| --- | --- |
| El escritor no bloquea ni corrompe | Prueba de humo con la base real: los lotes entran una sola vez (el mismo `loteId` dos veces no duplica) y las consultas ven lo escrito. |
| La ingesta no afecta al usuario | Prueba de carga con la base caída: las peticiones siguen respondiendo 202 y los descartes suben en el contador. |
| El mapa de calor es fiel | Prueba de la rejilla: una secuencia conocida de puntos produce el índice de celda esperado, incluido el desplazamiento por scroll y el cambio de viewport. |
| No viaja PII | Revisión del DTO y del registro de ejemplo: sin valores de campos, sin teclas, sin texto de inputs, usuario solo como hash. |
| El error de arranque se captura | Cargar una versión con el bundle roto a propósito y ver la fila en el panel. |
| La consulta agrupa bien | Datos sembrados: 100 ocurrencias de la misma huella producen una fila con 100. |

## Consequences

**Positivas**

- Se puede saber qué falla y qué se usa sin esperar el reporte del usuario.
- La analítica queda en un esquema propio, con purgas e índices separados del
  negocio, y entra en el respaldo normal de SQL Server sin procesos extra.
- Una sola base y una sola credencial: no hay un segundo motor que instalar,
  actualizar ni vigilar en los servidores.
- La correlación con `ErrorLog` y la pestaña de errores del servidor dan valor
  desde el primer día, antes de que el SDK esté afinado.

**Negativas**

- La analítica comparte instancia con el negocio: las consultas del panel compiten
  por CPU y E/S, aunque se mitiga con índices por fecha/ruta y topes de filas.
- El volumen de clics y rejillas crece con el uso; la retención y las purgas
  pasan a ser una tarea de mantenimiento que hay que vigilar.
- El mapa de calor muestra el diseño actual, no el de la fecha consultada.

**Neutras**

- El despliegue del API no cambia de tamaño (sin dependencias nativas nuevas): el
  trabajo pesado es de base de datos.
- Introduce el primer `BackgroundService`, el primer rate limiter y el primer
  esquema fuera de `dbo` del backend: patrones nuevos que hay que documentar para
  quien venga.
- Los permisos `telemetria.ver` y `telemetria.administrar` quedaron asignados a
  los roles del sistema; si mañana se crea otro rol que deba ver el panel, hay que
  asignarlo a mano.

## Contrato de eventos

Es el contrato que implementan juntos el SDK del navegador, la API de ingesta y
el almacén. Cualquier cambio aquí obliga a subir la versión del esquema y a
convivir con las dos durante una ventana de transición.

**Sobre de lote** (`POST /api/telemetria/eventos`, autenticado;
`POST /api/telemetria/eventos-anonimos`, solo arranque, login y pantalla en
blanco):

```json
{
  "loteId": "8f0c2b4e-…",
  "enviadoEn": "2026-11-20T18:40:00.000Z",
  "visitaId": "2a91…",
  "versionApp": "1.12.4-rc.1",
  "eventos": [ { "tipo": "error", "ocurridoEn": "…", "ruta": "/viaticos/mis-viajes" } ]
}
```

- Tope de **100 eventos** y **256 KB** por lote; un lote fuera de tope se
  rechaza completo con 400 y no se escribe nada.
- Un evento sin `tipo`, `ocurridoEn` o `ruta` invalida el lote entero.
- `loteId` es la clave de idempotencia: si llega dos veces, la segunda se
  descarta y se cuenta.

**Campos comunes a todo evento**: `tipo` (`error`, `clic`, `mapa_calor`,
`visita`), `ocurridoEn` (ISO-8601 UTC), `ruta` (≤512) y, opcional, `visitaId`.

**Los pone el servidor, nunca el navegador**: `recibidoEn`, `usuarioHash` (hash
con sal derivado del token), `rol`, `entorno`, `servidor`, `loteId` y la
`huella` recalculada del error. El cliente puede mandar una `huella` estimada,
pero la autoridad es el servidor.

**`error`** — `tipoError` (`arranque`, `js`, `promesa`, `react`, `http`, `red`),
`mensaje` (≤2 048), `stack` (≤16 384), `url`, `metodoHttp`, `estadoHttp`,
`requestId`, `navegador` y `contexto` (JSON ≤4 096; sin valores de formulario).
`red` es el fallo en que el servidor no respondió (conexión rechazada o
restablecida, DNS, tiempo agotado) y `http` el que sí respondió con un estado
≥400; así el panel distingue «no hay servidor» de «el servidor rechazó la
petición».

**`clic`** — `elemento` (identidad estable), `etiqueta` (≤120), `tipoElemento`
(`boton`, `enlace`, `menu`, `tab`, `otro`), `x` y `y` (enteros, px CSS relativos
al viewport) y `viewportAncho`/`viewportAlto`.

**`mapa_calor`** — `celdas` (`INTEGER[]` con los índices de celda tocados),
`columnas`, `filas`, `tamanoCelda` (32 px), `viewportAncho`/`viewportAlto`,
`scrollMax` (px) y `segundosVisibles`. Se acumula en el cliente por visita de
página: nunca viaja un `mousemove`.

**`visita`** — `inicio`, `fin`, `segundos`, `scrollMax`, `navegador`, `sistema`
y viewport. Una fila por visita de página.

**Nunca viaja**: valores de campos, texto escrito en un `input`, teclas,
contraseñas, cuerpo de respuestas, ni el usuario en claro. Las rutas excluidas
no generan `clic` ni `mapa_calor` (los `error` sí se capturan en todas).

**Variables de configuración** (`Telemetria:*`): `Habilitada`,
`RetencionDiasErrores`, `RetencionDiasClics`, `RetencionDiasMapaCalor`,
`RetencionDiasVisitas`, `RutasExcluidas`, `LoteMaximoEventos`,
`ColaMaximaEventos`, `MuestreoPunteroMs`, `TamanoCeldaPx`; y en
`Telemetria:Avisos`: `Habilitado`, `Destinatarios`, `HoraResumen`,
`VentanaAlertaMinutos`, `RepeticionesAlerta`, `PeriodoMinutos`. La conexión es la
`DefaultConnection` de siempre; no hay ruta de archivo ni hilos que configurar.

## Decisiones cerradas

Cerradas por el humano el 2026-11-20 al aprobar el plan; se aplican como
valores por omisión y se pueden cambiar sin rehacer el diseño.

1. **Almacén**: SQL Server, esquema `telemetria` en la base de Lefarma (script
   `lefarma.database/telemetria/0001_*.sql` aplicado a mano). El escritor único es
   un proceso de fondo dentro del API; el navegador solo guarda un búfer temporal
   en IndexedDB. Se revisa en seis meses si el volumen pide mover la analítica a
   otra instancia.
2. **Retención**: errores 180 días, clics 90 días, mapa de calor y visitas 365
   días, con borrado por lotes. El respaldo es el de SQL Server: no se exporta a
   Parquet.
3. **Exclusiones iniciales** (por prefijo de ruta): `/login`, `/perfil`,
   `/perfil/configuracion`, `/configuracion`, `/rh/sueldos`, `/rh/documentos`.
   Los errores se capturan en todas las pantallas.
4. **Quién lo ve**: `telemetria.ver` para SuperAdministrador, Administrador y
   Gerente General; `telemetria.administrar` solo SuperAdministrador. El alta se
   ejecutó en `AsokamDev` (permisos 193 y 194) y la asignación se hizo desde la
   propia API de administración; se puede ajustar en la pantalla de Permisos.
5. **Avisos**: segunda entrega. El módulo sale sin correo diario ni alertas; el
   panel es la única superficie de consulta.

## Anexo — Fuentes

Este módulo no nace de documentos de negocio; sus fuentes son documentación
técnica oficial, la guía de desarrollo web del banco de trabajo y el propio código
citado por archivo y línea.

> **Nota sobre las fuentes de DuckDB.** El diseño inicial se apoyó en la
> documentación de DuckDB (concurrencia, cliente C# y WebAssembly); esas citas se
> conservan porque explican por qué se eligió primero un archivo analítico y por
> qué se descartó `duckdb-wasm` para el navegador. El almacén definitivo es SQL
> Server por petición expresa del humano (m01510), y su esquema se documenta en
> `lefarma.database/telemetria/0001_20261120-2015_telemetria_esquema-sql-server.lefarma.sql`.

**DuckDB — concurrencia (2.0 LTS)**

> «DuckDB supports a single writer process at a time. […] If you want to read the
> database from another process, you can open it in read-only mode. […] Note that
> this is not possible if the database is open for writing in another process.»

Fuente: <https://duckdb.org/docs/2.0/connect/concurrency>

**DuckDB — cliente C# (.NET)**

> «The packages target .NET 8.0 and later.» «The latest stable version of the
> DuckDB C# client is 1.5.6.»

Fuente: <https://duckdb.org/docs/2.0/clients/dotnet> · Paquete:
<https://www.nuget.org/packages/DuckDB.NET.Data.Full> (1.5.6.1, `net10.0`
compatible, appender y `UseStreamingMode` documentados).

**DuckDB — WebAssembly**

> «DuckDB-Wasm is a full DuckDB engine compiled to WebAssembly. […] runs in a
> single thread» y el límite de 4 GB de memoria del entorno wasm.

Fuente: <https://duckdb.org/docs/2.0/clients/wasm/overview>

**Guía de desarrollo web — analítica de sesión completa**

> «To reliably track analytics, Core Web Vitals, and telemetry data that covers the
> entirety of a user's visit to a web page (not just until page load), use the
> `fetchLater()` API.» «Older technique like creating an `<img>` pixel in an
> `unload` event listener are notoriously unreliably (especially on mobile) and
> can negatively impact performance (by making pages ineligible for bfcache).»

Fuente: guía `full-session-analytics` del skill `modern-web-guidance` (misma
recomendación en `batch-analytics-events` para agrupar eventos con
`activateAfter`).

**Código del repo citado**

- `lefarma.backend/src/Lefarma.API/Infrastructure/Middleware/WideEventLoggingMiddleware.cs:99-105`
  — persiste en `ErrorLog` los 5xx y las excepciones no controladas.
- `lefarma.backend/src/Lefarma.API/Features/Logging/ErrorLogService.cs:24-72` —
  campos que ya se guardan (incluye `RequestId` y `TraceId`).
- `lefarma.backend/src/Lefarma.API/Program.cs:670` — único endpoint operativo
  actual (`/api/health`).
- `lefarma.backend/src/Lefarma.API/Infrastructure/Middleware/WideEventLoggingMiddleware.cs:44-51`
  — hoy registra y relanza: no hay middleware de excepciones.
- `lefarma.backend/deploy/lefarma-autodeploy.ps1:15-24` — un destino y un pool por
  ambiente; base de la decisión de escritor único.
- `lefarma.frontend/src/main.tsx:13-20` — arranque único, sin `StrictMode`.
- `lefarma.frontend/src/App.tsx:41-46` — el modo `?autotest=true` corta el árbol:
  la telemetría debe respetarlo y no capturar nada.
- `lefarma.frontend/index.html:9-16` — script inline previo al bundle (tema); ahí
  se suma el centinela de arranque.
- `lefarma.backend/src/Lefarma.API/web.config:38-42` e `index.html` — no hay CSP ni
  `X-Frame-Options`, por eso el fondo del mapa de calor puede ser un iframe del
  propio sitio.
