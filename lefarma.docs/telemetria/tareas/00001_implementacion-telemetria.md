# Tareas — 00001 Implementación del módulo Telemetría

> Vinculada a: [[decisiones/00001_telemetria-errores-clics-mapa-calor]]
>
> **Estado (2026-11-20)**: implementación en curso. Plan aprobado por el humano
> (tarjeta #fa8dbed3) con los valores por omisión de las cinco decisiones
> abiertas. Fases 0 a 8 implementadas; el almacén se migró de DuckDB a SQL Server
> por petición del humano (m01510): el navegador conserva su búfer en IndexedDB y
> el servidor escribe en el esquema `telemetria` de la base de Lefarma. Queda
> aplicar el script del esquema en `LefarmaDev` y publicar a pruebas.

## Fase 0 — Contratos y decisiones (humano)

- [x] Cerrar el almacén: **SQL Server**, esquema propio `telemetria` en la base de
      Lefarma (script manual). El navegador solo guarda un búfer en IndexedDB.
- [x] Aprobar la retención: 180 días de errores, 90 de clics y 365 de mapa de
      calor y visitas, con borrado por lotes y el respaldo normal de SQL Server.
- [x] Aprobar la lista inicial de pantallas excluidas de clics y mapa de calor
      (los errores se capturan siempre): `/login`, `/perfil`,
      `/perfil/configuracion`, `/configuracion`, `/rh/sueldos`, `/rh/documentos`.
- [x] Decidir qué roles reciben `telemetria.ver` y `telemetria.administrar`:
      ver para SuperAdministrador, Administrador y Gerente General; administrar
      solo SuperAdministrador. Creados (193 y 194 en `AsokamDev`) y asignados.
- [x] Decidir si los avisos (fase 8) entran desde el inicio: no, segunda entrega.
- [x] Confirmar el contrato de eventos: tipos `error`, `clic`, `mapa_calor` y
      `visita`; tope de 100 eventos y 256 KB por lote; textos truncados
      (mensaje 2 048, stack 16 384, etiqueta 120, ruta 512). Queda escrito en la
      sección «Contrato de eventos» del ADR.
- [x] Confirmar las variables de configuración: `Telemetria:Habilitada`,
      `Telemetria:RetencionDiasErrores`, `Telemetria:RetencionDiasClics`,
      `Telemetria:RetencionDiasMapaCalor`, `Telemetria:RetencionDiasVisitas`,
      `Telemetria:RutasExcluidas`, `Telemetria:LoteMaximoEventos`,
      `Telemetria:ColaMaximaEventos`, `Telemetria:MuestreoPunteroMs`,
      `Telemetria:TamanoCeldaPx`; y `Telemetria:Avisos:*` para la fase 8. La
      conexión es la `DefaultConnection` de siempre.

**Criterio de aceptación**: cada decisión con respuesta escrita en la tarjeta y
reflejada en el ADR.

## Fase 1 — Contrato de eventos y esquema en SQL Server

- [x] Script manual
      `lefarma.database/telemetria/0001_20261120-2015_telemetria_esquema-sql-server.lefarma.sql`
      (idempotente, sin `GO`, ejecutable en un solo lote): esquema `telemetria` y
      seis tablas —`lote_procesado`, `evento_error`, `evento_clic`, `mapa_calor`,
      `visita` y `parametro`— con índices por fecha, huella, ruta y elemento.
- [x] Entidades EF en `Domain/Entities/Telemetria/` y configuraciones en
      `Infrastructure/Data/Configurations/Telemetria/`: esquema `telemetria`,
      `datetime2(3)`, nombres de columna explícitos e índices iguales a los del
      script.
- [x] Seis `DbSet` en `ApplicationDbContext` (`TelemetriaLotesProcesados`,
      `TelemetriaErrores`, `TelemetriaClics`, `TelemetriaMapasCalor`,
      `TelemetriaVisitas`, `TelemetriaParametros`).
- [x] Rejilla del mapa de calor como `varBinary` (int32 little-endian por celda,
      `columnas * filas`), con `tamano_celda`, viewport, `movimientos`, scroll y
      segundos visibles.
- [x] Contrato único de evento con `loteId`, `visitaId`, `versionApp` y tope de
      100 eventos y 256 KB por lote; textos truncados en el servidor.
- [x] Sección `Telemetria` en `appsettings.json` y `appsettings.Development.json`.
- [x] Si la base o las tablas faltan: `/api/telemetria/estado` responde
      `disponible: false` con un mensaje y el API arranca igual.

**Criterio de aceptación**: el humano ejecuta el script desde la Bandeja y
`/api/telemetria/estado` pasa de `disponible: false` a `disponible: true` con las
seis tablas en cero.

## Fase 2 — Escritor, retención y respaldo

- [x] `Channel<EventoTelemetria>` acotado (10 000) con política de descarte y
      contador de descartes.
- [x] `TelemetriaEscritor : BackgroundService`: drena cada 2 s o cada 500
      eventos, por lote y en transacción, a través de `TelemetriaRepositorio`.
- [x] Idempotencia por `loteId` en `telemetria.lote_procesado`: los lotes
      repetidos se descartan y se cuentan.
- [x] Contadores en memoria: encolados, escritos, descartados, lotes repetidos,
      último error, último vaciado.
- [x] Retención diaria con `ExecuteDeleteAsync` por tabla (180/90/365/365 días),
      con bitácora de filas borradas.
- [x] `GET /api/telemetria/estado` con el destino `servidor · base`, filas por
      tabla, cola, escritor y descartes.

**Criterio de aceptación**: con 10 000 eventos encolados de golpe, el API sigue
respondiendo, la base no crece sin límite y el contador de descartes es
explicable.

## Fase 3 — API de ingesta y correlación

- [x] DTOs y validación de lotes (FluentValidation; el `ValidationFilter` global
      ya devuelve 400 con `ApiResponse`).
- [x] `Features/Telemetria/TelemetriaController.cs`:
      `POST /api/telemetria/eventos` (`[Authorize]`) y
      `POST /api/telemetria/eventos-anonimos` (`[AllowAnonymous]`, solo errores de
      arranque, login y pantalla en blanco).
- [x] El usuario **no** llega en la carga útil: se toma del token y se guarda
      como hash con sal. Los eventos marcados anónimos no se atribuyen.
- [x] Rate limiting nativo (`AddRateLimiter` + `UseRateLimiter`, no existe hoy):
      por usuario en el autenticado y por IP en el anónimo.
- [x] Cabecera `X-Request-Id` en `WideEventLoggingMiddleware` y lectura en el
      interceptor del cliente.
- [x] Pruebas de validación, topes, rate limit y lote repetido.

**Criterio de aceptación**: un lote válido responde 202 y llega al almacén; uno
inválido responde 400 sin escribirse; el endpoint anónimo rechaza cualquier tipo
que no sea de la lista corta.

## Fase 4 — SDK: errores del navegador

- [x] `src/shared/telemetria/`: `iniciarTelemetria()`, `capturaErrores.ts`,
      `huella.ts`, `colaErrores.ts` (IndexedDB), `transporte.ts`, `tipos.ts`,
      `config.ts`.
- [x] Llamada en `src/main.tsx` antes de `createRoot` (`main.tsx:18`).
- [x] `ErrorBoundary` nuevo en `src/components/layout/MainLayout.tsx` rodeando el
      `<Outlet />` (y otro de último recurso en `src/App.tsx:55-57`). Decisión del
      2026-11-20: **sin pantalla de respaldo**; el módulo se queda vacío, el menú
      sigue disponible y al cambiar de ruta se reintenta solo (`resetKey`).
- [x] Captura de `window.onerror`, `unhandledrejection`, `componentStack` y
      detección de pantalla en blanco a los 10 s.
- [x] Script inline en `index.html` antes del bundle (hay un script inline previo
      en `index.html:9-16`): captura el fallo de carga del JavaScript y manda el
      error de arranque con `fetch(..., {keepalive:true})` al endpoint anónimo.
- [x] Enganche HTTP en `src/shared/api/apiClient.ts:56-133`: método, ruta, estado,
      duración y `X-Request-Id`.
- [x] Huella = hash de tipo + mensaje normalizado + primeras líneas del stack sin
      números de línea + ruta.
- [x] Reintento con espera creciente; descarte a los 7 días o a los 5 000
      pendientes.
- [x] Respeto a `?autotest=true` (`src/App.tsx:41-46`): no capturar nada.
- [x] Pruebas: huella estable, normalización de rutas, reintento y descarte.

**Criterio de aceptación**: un error provocado en una pantalla aparece agrupado
en el panel con stack, ruta, navegador y versión; cargando una versión con el
bundle roto también llega la fila de arranque.

## Fase 5 — SDK: clics, puntero y envío diferido

- [x] `capturaClics.ts` con clic delegado en fase de captura y `passive`:
      identidad `data-track` > `data-testid` > `id` > `aria-label` > `name` >
      texto normalizado (solo botones/enlaces/menús, máximo 40 caracteres).
      Nunca texto de un `input`.
- [x] `mapaCalor.ts`: muestreo a 10 Hz, rejilla de 32 px, acumulado por visita;
      al cambiar el viewport se cierra la fila.
- [x] `scroll` máximo y segundos visibles por visita.
- [x] `cola.ts` en memoria (tope 200 eventos). Sin `worker.ts` por decisión del
      2026-11-20: la cuenta de celdas es despreciable y el worker complicaba la
      configuración de Vite; queda como mejora opcional.
- [x] `transporte.ts` con `fetchLater()` + polyfill (`fetch` + `keepalive`, luego
      `sendBeacon`); lotes de hasta 100 eventos o 48 KB; cada 15 s, al pasar a
      segundo plano y al descargar.
- [x] Interruptores: `VITE_TELEMETRIA_ACTIVA`, muestreo, exclusiones, opt-out en
      `localStorage` y `navigator.doNotTrack`.
- [x] Configuración del worker en Vite (`vite.config.ts` no declara `worker`; el
      patrón `new Worker(new URL(...), {type:'module'})` funciona sin ajustes).
- [x] Pruebas: índice de celda con scroll y cambio de viewport, identidad del
      elemento, tope de la cola y respeto al opt-out.

**Criterio de aceptación**: navegando una pantalla se obtiene una fila de mapa de
calor con la rejilla coherente con lo recorrido, y los clics salen con etiqueta
legible; con el opt-out activo no se envía nada.

## Fase 6 — API de consulta y panel

- [x] Endpoints (permiso `telemetria.ver`): `/resumen`,
      `/errores-navegador`, `/errores-navegador/{huella}/ocurrencias`,
      `/botones`, `/mapa-calor`, `/rutas` y `/errores-servidor` (este lee
      `ErrorLog` con EF, solo lectura y paginado). Implementados en
      `Features/Telemetria/TelemetriaConsultaController.cs`.
- [x] Agregación del mapa de calor con `unnest(celdas)` +
      `generate_subscripts`, filtrada por ruta, fecha y viewport (la dimensión
      dominante de la rejilla se elige por frecuencia; el rol viaja en cada
      evento y se puede filtrar después).
- [x] Panel en `src/apps/telemetria/` (`types.ts`, `services/telemetriaApi.ts`,
      `utils.ts`, `TelemetriaPanel.tsx`, `TelemetriaPage.tsx` y `components/`).
      Se descartó el subárbol propio con `menuItems.tsx`/`TelemetriaRoutes.tsx`:
      el panel es una pantalla de administración, no un módulo de negocio.
- [x] Pantalla propia en `/configuracion/telemetria`, dentro del layout de
      Configuración, con `PermissionGuard require="telemetria.ver"` y carga
      diferida (`lazy` + `Suspense`). Enlace en el sidebar vía
      `src/apps/baseapp/menuItems.tsx` (visible tanto en el sidebar de
      Configuración como en el del shell).
- [x] La pestaña incrustada en `ConfiguracionVariablesPage` se retiró a petición
      del humano (2026-11-20): Telemetría debía ser su propia pantalla.
- [x] Ruta nueva en `src/apps/baseapp/BaseAppRoutes.tsx` con carga diferida y
      guarda de permiso.
- [x] Pestañas con el patrón de administración: `usePageTitle`, tarjetas y
      `Table` (`DataTable` no aplicaba: las filas se expanden y el mapa es una
      rejilla).
- [x] **Resumen**: errores de hoy y del periodo, top huellas, botones más
      usados, eventos descartados y salud del almacén/cola/escritor.
- [x] **Errores del navegador**: agrupados por huella, detalle con stack,
      ocurrencias y usuarios afectados.
- [x] **Errores del servidor**: la tabla `ErrorLog` existente, filtrable por
      texto y severidad, con paginación.
- [x] **Botones**: por ruta y elemento, usuarios únicos, últimos clics y clics
      de enojo (3+ en menos de 1 s).
- [ ] **Mapa de calor**: selector de ruta y exportación CSV, dibujado como
      rejilla CSS. Pendiente la capa de densidad en canvas y el fondo con iframe:
      el iframe volvería a ejecutar el SDK dentro del panel (telemetría
      recursiva) y no hay validación visual disponible en esta sesión.
- [x] Exportación CSV de la tabla visible.
- [x] Pruebas: 7 casos (`utils.test.ts` y `MapaCalorTab.test.tsx`) y la suite
      del backend de consulta (10 casos, 33 en total con las fases previas).

**Criterio de aceptación**: con datos de prueba, las cinco pestañas muestran
números coherentes y el mapa de calor coincide con las celdas sembradas.

## Fase 7 — Instrumentación, exclusiones y afinación

- [x] `data-track` en los botones principales de CxP, viáticos y educación médica.
      Primera pasada (12 marcas): firma digital y selección de contexto en CxP;
      «Ver detalle», «Enviar», «Más acciones» y «Editar» en Mis viajes;
      navegación de mes, «Volver al calendario», «Abrir matriz», «Generar
      propuesta» y «Preparar cotización» en el calendario de educación médica.
      La convención es `modulo.pantalla.accion`; se sigue aplicando al tocar
      pantallas nuevas.
- [x] Aplicar la lista de pantallas excluidas aprobada en la fase 0: el SDK las
      descarta antes de encolar (`RUTAS_SIN_CAPTURA` en `config.ts`) y el
      servidor las vuelve a filtrar, salvo los errores.
- [x] Revisar que ninguna etiqueta automática filtre identificadores de fila,
      importes o nombres: `limpiarEtiqueta()` en `capturaClics.ts` convierte
      importes en `$…`, folios en `#` y números de 4+ dígitos en `#`, con 5
      pruebas propias.
- [ ] Prueba de humo en pruebas: navegar, provocar un error, verlo en el panel
      (requiere publicar a pruebas, que hace el humano cuando lo decide).

**Criterio de aceptación**: los botones principales salen con nombre estable y
reconocible; las pantallas excluidas no generan clics ni mapa de calor.

## Fase 8 — Avisos proactivos, pruebas y publicación

- [x] Resumen diario por correo con errores nuevos y los más frecuentes:
      `Features/Telemetria/Avisos/TelemetriaAvisos.cs` lo manda una vez al día a
      partir de `Telemetria:Avisos:HoraResumen`.
- [x] Alerta cuando una huella nueva aparece 3 veces en 10 minutos: consulta
      `ObtenerHuellasNuevas()` en la ventana y avisa una sola vez por huella,
      con reinicio diario del registro en memoria.
- [x] Pruebas unitarias sin dependencia de base: validador, normalizador y
      huella, ingesta (6 casos, con `IAtribucionUsuario` falsa), avisos (7 casos,
      con `ITelemetriaConsulta` falsa) y serialización de la rejilla
      (`TelemetriaRepositorioTests`, 3 casos); 22 pruebas de telemetría en verde y
      17 del frontend.
- [x] Revisión de tamaño del despliegue: **ya no aplica**. Al escribir en SQL
      Server se quitó `DuckDB.NET.Data.Full` del proyecto y el sitio no crece ni
      añade binarios nativos; el arranque en frío queda igual que antes.
- [ ] Publicación a pruebas cuando el humano lo pida (sin tocar `VERSION` ni
      `VERSION-STAGING` por cuenta propia).

**Criterio de aceptación**: el correo llega con datos del día y la alerta dispara
en una prueba controlada.

**Verificado en local (20-nov-2026)**: con `ASPNETCORE_ENVIRONMENT=Development` y
el API en un puerto aparte, `GET /api/telemetria/estado` respondió
`disponible: true` sobre el almacén DuckDB de entonces (4.4 MB, esquema v2) y en
ese momento ya había eventos reales enviados por el navegador: 42 clics, 27
paquetes de mapa de calor y 1 error. La captura funciona de punta a punta en
desarrollo. **Pendiente de repetir tras el giro a SQL Server**, cuando el humano
ejecute el script del esquema en `LefarmaDev`.

## Fuera de alcance

- Grabación de sesiones, capturas de pantalla y grabación de teclas.
- Identificar a la persona por nombre o correo en el panel: solo hash.
- Embudos de conversión, experimentos A/B y atribución de marketing.
- Sustituir Serilog, `ErrorLog` o `BusinessAuditLog`.
- Exportar a un BI externo (ni mover la analítica a otra instancia o a un motor
  aparte) mientras no haya una necesidad medida.
- Modificar tablas existentes de SQL Server: todo lo nuevo vive en el esquema
  `telemetria`.
