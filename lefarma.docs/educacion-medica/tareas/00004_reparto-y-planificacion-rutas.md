# Tareas — 00004 Reparto por zonas y planificación de rutas

> Vinculada a: [[decisiones/00004_reparto-y-planificacion-rutas]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend.
> Extiende el Slice 1/2 de [[tareas/00001_esquema-datos-educacion-medica]] (los wireframes de EquiposPareo y SeleccionMensual ya existen; esta decisión los sustituye por implementación real).

## Diagramas

> Pendientes de crear en `diagramas/` con numeración de esta decisión (`000004_<tipo>_<nombre>`), si se requieren:

- [ ] `000004_er_reparto_rutas.html` — ER de las 4 tablas nuevas + ALTERs sobre 0003
- [ ] `000004_flujo_reparto_planificacion.html` — selección → zonas → rutas (draft→select)
- [ ] Variantes Mermaid `.mmd`/`.svg` opcionales

## Fase 0 — Planificación

- [x] Revisar diseño con revisión externa (rutas_visitas, zonas persistidas, versionado, estados)
- [x] Decidir: visita planificada como entidad (`rutas_visitas`), zona→equipo, pareo exclusivo con vigencia, greedy por fases, Lun–Vie sin festivos, versionado mínimo, estados separados, snapshot de coordenadas
- [x] Crear ADR 00004 y sus tareas
- [x] Crear scripts SQL 0006 y 0007 (solo en disco, sin aplicar)

## Fase 1 — Base de datos

### 1.1 Equipos de pareo + estados (script 0006)

- [x] Crear script `0006_20260827-1200_educacion-medica_create-equipos-pareo-estados.lefarma.sql`
  - [x] Tabla `equipos_pareo` (pareo exclusivo con índices únicos filtrados `WHERE activo = 1`, vigencia `fecha_inicio`/`fecha_fin`)
  - [x] ALTER `selecciones_mensuales`: `estado` (CHECK Borrador/EnRevision/Autorizada/Cerrada), `firma_gv_fecha`, `firma_gg_fecha`
  - [x] ALTER `selecciones_mensuales_hospitales`: `latitud_snapshot`, `longitud_snapshot`, `id_zona` (columna; FK en 0007)
  - [x] ALTER `hospital_extension`: `es_zona_metropolitana` (1 local CDMX/zona metro · 0 foráneo · NULL sin clasificar; base de la regla de viajes foráneos IDT-003 2.2)
  - [x] `MS_Description` en tablas y columnas nuevas
- [ ] Validar sintaxis idempotente (guards `COL_LENGTH` / `sys.check_constraints` / `sys.indexes`)
- [ ] Ejecutar `0006` en **LefarmaDev**
- [ ] Validar en dev: CHECK `estado`, índices filtrados activos, defaults aplicados a filas existentes, `MS_Description` visibles en SSMS
- [ ] Ejecutar `0006` en **Lefarma** (prod)

### 1.2 Zonas y rutas (script 0007)

- [x] Crear script `0007_20260827-1210_educacion-medica_create-zonas-rutas.lefarma.sql`
  - [x] Tabla `selecciones_zonas` (centroide, cantidad, algoritmo, `id_equipo` FK física)
  - [x] FK física `selecciones_mensuales_hospitales.id_zona` → `selecciones_zonas`
  - [x] Tabla `rutas` (version, estado Draft/Confirmada/Cancelada/Archivada, FK equipo)
  - [x] Tabla `rutas_visitas` (`fecha_visita` NOT NULL, `orden`, horas, `UNIQUE (id_ruta, fecha_visita, orden)`, `UNIQUE (id_ruta, id_seleccion_hospital)`)
  - [x] `MS_Description` en tablas y columnas nuevas
- [ ] Ejecutar `0007` en **LefarmaDev** (después de 0006)
- [ ] Validar en dev: FKs, UNIQUEs, índice `IX_rutas_seleccion_version`
- [ ] Ejecutar `0007` en **Lefarma** (prod)

### 1.3 Parámetros del módulo (script 0008)

- [x] Crear script `0008_20260827-1400_educacion-medica_create-parametros-modulo.lefarma.sql` (tabla `parametros_modulo` + 4 seeds: radio_clustering_km, max_visitas_dia, max_visitas_semana, max_viajes_foraneos_mes)
- [ ] Ejecutar `0008` en **LefarmaDev**
- [ ] Ejecutar `0008` en **Lefarma** (prod)

## Fase 2 — Backend

### 2.1 Equipos y pareo

- [x] Entidad `EquipoPareo` + configuración EF (`Infrastructure/Data/Configurations/EducacionMedica/`) con los índices filtrados
- [x] `EquiposPareoController`: `GET /` (filtros: estado vigentes/inactivos/todos, búsqueda por nombre de integrante, usuario específico, rango de vigencia traslapado), `GET /{id}/operacion` (selecciones/zonas/rutas operadas + visitas confirmadas), `POST /` (exclusividad EV/EP con error amigable → 409), `PUT /{id}/desactivar`
- [x] Validar usuarios contra `app.Usuarios` (Asokam) en servicio (nombres resueltos para el DTO) + `zonasActuales` por equipo (zonas en selecciones no cerradas)
- [x] Pruebas unitarias: exclusividad, cierre de vigencia, misma persona en ambos roles, usuario inexistente, re-pareo con equipo inactivo, filtro por búsqueda, filtro por rango de vigencia, zonas actuales, operación consolidada, equipo inexistente — `EquipoPareoServiceTests.cs` (82/82 unit tests en verde)

### 2.2 Selección y reparto

- [x] `SeleccionMensualController`: CRUD básico + gestión de hospitales (con snapshot lat/long al agregar)
- [x] Servicio de clustering haversine **determinístico** + persistencia en `selecciones_zonas` (regenerar = delete+insert de zonas) — `Haversine.cs` + `SeleccionMensualService.AgruparAsync` (radio 50 km como constante; parametrizable al integrar pantalla Parámetros)
- [x] `POST /{id}/agrupar`: aviso zonas <4 hospitales + hospitales sin coordenadas + restablecimiento de equipos
- [x] `PUT /{id}/zonas/{idZona}/equipo`: validación de capacidad del equipo en el periodo (3/día, 8/semana, Lun–Vie — `CapacidadPeriodo.cs`) sobre hospitales de la zona; déficit → 409 con números
- [x] `POST /{id}/zonas/{idZona}/dividir` (excepción manual; mitad más alejada del centroide; motivo requerido — persiste en bitácora Serilog)
- [x] Parámetro `radio_clustering_km` consumido por el clustering (default 50 si no existe; test con radio enorme fusiona grupos)
- [x] Máquina de estados de la selección: `enviar-revision`, `autorizar` (doble firma GV→GG, orden validado), `cerrar`
- [x] Pruebas unitarias: clustering reproducible, 2 grupos lejanos → 2 zonas, reemplazo de zonas, aviso <4, capacidad insuficiente bloquea, firma fuera de orden rechazada, doble firma completa autoriza, edición tras autorización rechazada, hospital inexistente rechazado, división reparte hospitales — `SeleccionMensualServiceTests.cs` (62/62 unit tests en verde)

### 2.3 Planificación de rutas

- [x] `RutasController`: `GET ?version`, `POST /generar` (calendariza lo autorizado: parte de regiones con equipo ya asignado — sin re-clusterizar ni reasignar — distribuye en días Lun–Vie, valida capacidad y crea draft; version N+1; archiva draft anterior con advertencia de cambios manuales)
- [x] `PUT /{idRuta}/visitas/{idVisita}/mover` (mover con revalidación 3/día y 8/semana; no duplicar hospital entre rutas de la versión activa), `POST/DELETE visitas` — el alta manual respeta la frontera región→equipo (rechaza el cruce a otra región/equipo con mensaje que apunta al paso Reparto; sin región o sin equipo → alta permitida con aviso explícito y registro en bitácora, única vía de cobertura 100% en selección ya autorizada)
- [x] `POST /confirmar` (cobertura 100%, publica asignaciones → alimenta `GET /talleres/asignaciones/{idUsuario}`)
- [x] `POST /cancelar` (motivo obligatorio; habilita regenerar)
- [x] Entidades `Ruta`/`RutaVisita` + configuraciones (UNIQUEs del script 0007 replicados en EF) + `hospital_extension.es_zona_metropolitana` expuesta en entidad/DTO/PUT
- [x] Regla de viajes foráneos: `ViajesForaneos.Contar` (días consecutivos misma zona = 1 viaje; cambio de zona o día no consecutivo = otro viaje; NULL = foráneo) + aviso en generar si excede 3/mes
- [x] Empaque por localidad (2026-09-10): `DistribuirEnDias` ordena hospitales por región → ciudades con vecino más cercano desde el centroide (determinista, desempate alfabético) y llena días **sin fragmentar ciudades** (bloque que no cabe en lo que queda del día pasa al día siguiente; ciudad > capacidad diaria se divide en días consecutivos); tests `GenerarAsync_Debe_MantenerCiudadJuntaEnUnDia`, `...CiudadMayorQueCapacidadDiaria...DiasConsecutivos`, `...NoDebe_FragmentarCiudadQueNoCabeEnLoQueQuedaDelDia` (158/158)
- [x] Dos estrategias seleccionables por el usuario (2026-09-10): `POST /generar` acepta body opcional `{ estrategia }` — `ciudad` (default, ciudades viajan juntas) o `centroide` (ordena por distancia al centroide regional y llena el día aunque mezcle ciudades); `GenerarRutasResponse.estrategia` confirma la aplicada; estrategia inválida → 409; bitácora registra el criterio; tests `...EstrategiaCentroide_Debe_LlenarElDiaAunqueMezcleCiudades` y `...EstrategiaInvalida_Debe_Lanzar` (160/160)
- [x] Script `0013_..._clasificar-zona-metropolitana` en disco (sin aplicar): fuerza `es_zona_metropolitana = 1` a CDMX (493) + 17 municipios conurbados del Edoméx y pone `0` solo a lo que sigue NULL (respeta reclasificaciones manuales); deja el conteo de foráneos sin NULLs conservadores; pendiente ejecutar en LefarmaDev/Lefarma
- [x] Parámetros configurables (`radio_clustering_km`, `max_visitas_dia`, `max_visitas_semana`, `max_viajes_foraneos_mes`) en `parametros_modulo` (script 0008) + endpoint GET/PUT `/parametros-modulo` + consumidos por SeleccionMensualService y RutasService (con defaults si faltan)
- [x] Motivos de dividir zona y cancelar rutas persistidos en bitácora (ILogger → Serilog wide-events)
- [x] Pruebas unitarias: distribución 3/día + tope semanal 8 + solo Lun–Vie, versión N+1 archiva la anterior, sin Autorizada rechaza, con Confirmada rechaza, déficit global bloquea, mover excede 3/día rechaza, fin de semana rechaza, ruta Confirmada no editable, duplicar hospital en otra ruta rechaza, cruce región→equipo en alta manual rechaza, alta manual de hospital sin región permite con aviso, confirmar sin cobertura rechaza, confirmar con cobertura publica asignaciones al EV, cancelar permite regenerar (v2 draft), regla de viajes foráneos (5 casos), sin zonas con equipo avisa — `RutasServiceTests.cs`

## Fase 3 — Frontend

### 3.1 Equipos y Pareo (`/catalogos/equipos-pareo`)

- [x] Sustituir wireframe `EquiposPareoPage.tsx` por implementación real (API en `educacionMedica.api.ts`)
- [x] Card de filtros estilo GestionSolicitudes: estado (Vigentes/No vigentes/Todos), búsqueda por nombre de integrante, integrante (selector con búsqueda), rango de vigencia; botones Limpiar + Buscar; "Nuevo pareo" a la derecha
- [x] Tabla: recargar + configurar dentro del DataTable; columna "Zonas actuales" (badges); acciones solo icono (operación MapPin + desactivar PowerOff)
- [x] Modal alta: combobox de usuarios con búsqueda (`UsuarioSearchSelect`), textos de ayuda bajo cada campo, aviso en vivo si el integrante ya está en un equipo vigente (además del 409 del backend), validación misma persona
- [x] Modal "Dónde ha operado": selecciones con estado, zonas operadas, rutas con versión/estado/visitas, KPIs (selecciones, visitas confirmadas, vigencia)
- [x] `es_zona_metropolitana` agregada a tipos `HospitalExtension`/`UpsertHospitalExtensionRequest` (la página Hospitales preserva el valor actual hasta agregar el checkbox)
- [ ] Guard de permiso `educacion_medica.equipos.*` (pendiente de sembrar permisos)

### 3.2 Selección y reparto (`/seleccion`)

- [x] Sustituir wireframe `SeleccionMensualPage.tsx` por wizard real: lista de selecciones → detalle (Hospitales → Reparto → Autorización)
- [x] Paso Reparto: cards de zonas (nombre, hospitales, aviso <4), selector equipo con nombres EV+EP, panel de avisos de agrupación (sin coordenadas, equipos restablecidos), división de zona con motivo; déficit de capacidad vía 409 → toast
- [x] Paso Autorización: botones de doble firma en orden (GV → GG, deshabilitados según estado) + cerrar; acceso a "Planificar rutas" cuando Autorizada
- [x] Modal de alta: fecha reunión, vigencia 45 días, objetivo talleres
- [x] Modal agregar hospital: búsqueda sobre catálogo (solo instituciones), producto opcional
- [x] Mapa Leaflet (`HospitalesMap.tsx`) integrado en el detalle: hospitales (snapshot) + centroides de zonas con popup
- [x] Rediseño de la vista de reparto (`RegionesPanel.tsx`, nuevo): accordion de regiones como vista primaria (header: nombre, equipo, conteo, badge <4; expandida: select de equipo con error de capacidad en línea, filas de hospital con score/origen/trash, algoritmo discreto, dividir); sección "Sin región" accionable con CTA recalcular y trash por hospital (antes solo recalcular podía resolverlos); línea de resumen; tabla plana de hospitales y grid de cards eliminadas; mapa lateral sticky sincronizado (hover/expansión resalta región en naranja y atenúa el resto en gris, incluidos sin región; fitBounds al expandir; hover de fila resalta marcador); leyenda con swatch por región + sin región + centroide. Pendiente mejora posterior: click en marcador → expandir región
- [x] Backend: `GET selecciones-mensuales/{id}` resuelve `entidad_federativa` (código almacenado en snapshot) a nombre de estado vía `genEstadosCat` (`CargarNombresEstadosAsync` en `SeleccionMensualService`, mismo patrón del ranking); fallback al valor crudo si no hay match
- [x] Resumen imprimible (espejo del XLSX legacy `ESTRUCTURA ZONAS DESCENTRALIZADOS...xlsx`): `ResumenSeleccionModal.tsx` con encabezado (gerencia, fecha, vigencia, objetivo), por región grupos por institución con Hospital | Quirófanos | Anestesias | Estado/Ciudad | Score | Origen + totales, bloque "Sin región", firmas GV/GG (fecha o "Pendiente") y botón Imprimir; `GET selecciones-mensuales/{id}` enriquece `SeleccionHospitalDto` con `Institucion`, `NumeroQuirofanos` y `AnestesiasTotales` (contacto padre + `HospitalExtension`); print CSS en `index.css` (oculta `#root` y el overlay, acomoda el `[role="dialog"]`)
- [x] Mover hospital sin región a región existente: `PUT selecciones-mensuales/{id}/hospitales/{idSelHospital}/region` (`MoverHospitalARegionRequest` — nombre distinto al `AsignarRegionHospitalRequest` del catálogo de regiones); valida selección editable, hospital sin región y de la selección, recalcula conteo/centroide destino; select "Mover a región…" por fila en el bloque Sin región del panel; tests feliz + ya-con-región
- [x] Fix `GET selecciones-mensuales` (lista) reportaba siempre 0 hospitales/regiones (`ToResponse(tiposDict, 0, 0)`): ahora cuenta hospitales y regiones por selección + test
- [x] Filtro `tieneCoordenadas` en catálogo de hospitales (`true` = lat/long no nulas y no 0/0; `false` = solo inválidos): `HospitalFilterParams`, `GetHospitalesRequest`, aplicado SQL-side en `HospitalRepository.GetHospitalesAsync` (fuente única) + 3 tests contra el repo; la pantalla de Selección lo usa en "Agregar hospital" y el ranking de sugerencias (`RankingHospitalesService`, generación y filtros disponibles) omite los hospitales sin coordenadas — sin coordenadas no entran a la selección
- [x] Hospitales cercanos en otras selecciones (coordinación de viajes): `GET selecciones-mensuales/{id}/hospitales-cercanos` — hospitales de selecciones de OTRA gerencia, activas y con vigencia solapada, cercanos por distancia (Haversine ≤ `radio_clustering_km`, fallback 50) o mismo estado/ciudad (snapshots); dedup por hospital ajeno con el propio más cercano; excluye los ya en la selección actual; solo informativo. UI: los cercanos se muestran **dentro de cada región** en el `RegionesPanel` (agrupados por el hospital propio más cercano vía `idSeleccionHospitalCercano` → `idRegion`, en `cercanosPorRegion` calculado en la página), con bucket "sin región" en el bloque homónimo (o sección residual si no hay hospitales sin región); la línea de resumen incluye el conteo global "N cercanos en otras gerencias". Marcadores de anillo punteado en `HospitalesMap` con toggle global "Otras gerencias" en la leyenda; fetch diferido al cambiar de selección y en `refrescar()`. Tests: 6 casos (distancia, mismo estado lejos, excluye cerradas/misma gerencia, excluye sin solape, dedup, excluye ya seleccionados)
- [ ] Guard de permisos `educacion_medica.selecciones.*` (pendiente de sembrar permisos)

### 3.3 Planificación de rutas (`/seleccion/{id}/rutas`) — nueva `RutasPage`

- [x] Ruta en `EducacionMedicaRoutes.tsx` (`seleccion/:idSeleccion/rutas`) + acceso desde la página de Selección
- [x] Encabezado: estado (DRAFT/CONFIRMADA), selector de versión, Regenerar propuesta, Confirmar rutas, Solicitar cambio (cancelar con motivo) + contexto de la selección (gerencia, vigencia, estado)
- [x] Cards por equipo con días agrupados en secciones por semana ISO (badge "Semana N: x/8" rojo si excede), contador "Foráneos: x/3" por equipo, topes 3/8/3 leídos de Parámetros (fallback a defaults); badges x/3 por día; drag & drop nativo de visitas entre días (quitar para devolver al pool); badge "foráneo" en visita
- [x] `MisAsignacionesPage` real: consume `GET /talleres/asignaciones/{idUsuario}` con KPIs (total, hoy, esta semana)
- [x] Rediseño "mesa de trabajo" según `Propuesta final de rediseño—Planificación de rutas.md` (2026-09-09): maestro–detalle real con panel de equipos (integrantes EV+EP desde `equipos-pareo`, carga peores semana/foráneos con semáforo normal/lleno/excedido — 3/3 ámbar, 4/3 rojo); calendario completo Lun–Vie de la vigencia agrupado por semana ISO; días como drop-targets con feedback (ring/bg primario + "Suelta aquí"); panel **Sin planificar** bidireccional (arrastrar a un día = `POST /visitas` con errores inline + toast; soltar visita en el panel = `DELETE`; "quitar" renombrado a "Mover a Sin planificar"); selector de versiones shadcn con "V·estado" y banners de solo lectura (Archivada/Confirmada/Cancelada); mapa del día en Sheet reutilizando `HospitalesMap` con los snapshots; Alert accionables (sin región/equipo → enlace a Selección y reparto) vs advertencias vs info; confirmación al regenerar con ajustes manuales (flag cliente); límite foráneos por equipo (agregando rutas del mismo equipo); clave correcta `max_viajes_foraneos_mes`; helpers extraídos a `rutasUtils.ts` (semanaIso, contarViajesForaneos, nivelCarga). Sin cambios de backend
- [x] Refuerzo visual (2026-09-10): días como cards blancas (`bg-card shadow-sm`) con header de color por estado — **lleno 3/3 verde** ✓, incompleto (1–2/3) rojo, excedido rojo fuerte, día libre neutro; la semana ISO ahora muestra su rango de fechas y tooltip aclarando "x/8 = visitas del equipo en esa semana contra el máximo"; **Vista de impresión** (`RutasPrintModal`): preview por equipo o todos con tablas semana→día→visita (orden, hospital, ubicación, local/foráneo) + sin planificar por equipo, imprimible con `window.print()` vía portal `#rutas-print` (patrón `ResumenSeleccionModal` + reglas en `index.css`)
- [x] Ubicación de visita en formato "Ciudad, Estado" (calendario, sin planificar e impresión) + tooltip con el nombre completo del hospital al pasar por encima
- [x] Fix `GetVisitasAsync` InvalidCastException (Byte→Int32): el script 0007 declara `rutas_visitas.orden TINYINT` pero el entity usa `int`; conversión explícita `HasColumnType("tinyint").HasConversion<byte>()` en `RutaVisitaConfiguration` + test de regresión `RutaVisitaMappingTests` (InMemory no lo detecta; auditar `tinyint` al crear entities de `programas_anuales` y `taller_asistencias`)
- [ ] Guard de permisos `educacion_medica.rutas.*` (pendiente de sembrar permisos)

### 3.4 Verificación end-to-end

- [ ] Flujo completo en dev (requiere scripts 0006 + 0007 + 0008 aplicados): parear → seleccionar → agrupar → asignar zonas → autorizar (doble firma) → generar draft → mover visitas → confirmar → EV ve "mis hospitales del mes"
- [x] `dotnet build` + `dotnet test` (unit) en verde — 166/166
- [x] `npm run build` en verde (lint: patrón fetch-en-effect heredado del módulo; ya en rojo antes de estos cambios)

## Pendientes fuera de alcance de esta decisión

- [ ] Guard de permisos `educacion_medica.*` (requiere sembrarlos en `app.Permisos` — decisión aparte)
- [ ] Pantalla Hospitales: checkbox `es_zona_metropolitana` en el formulario de extensión (el backend ya lo soporta y el PUT preserva el valor vigente)
