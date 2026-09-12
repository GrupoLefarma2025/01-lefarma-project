# Tareas — 00005 Sugerencia de selección mensual con scoring explicable y trazable

> Vinculada a: [[decisiones/00005_sugerencia-seleccion-scoring]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend.

## Fase 0 — Planificación

- [x] Revisar diseño con revisión técnica contra código y SQL reales (hospital_extension 1:1, columnas verificadas, convenciones FK/índices/auditoría)
- [x] Decidir: sin coordenadas → neutral 50 (no excluidos ni penalizados con 0)
- [x] Decidir: solo la última ejecución es interactiva; anteriores de solo lectura; no revertir decisiones al quitar hospitales
- [x] Decidir: `ranking` → `posicion`; `id_ejecucion` → `id_ranking_ejecucion`
- [x] Aprobar ADR 00005 y crear sus tareas
- [x] Crear script SQL 0009 (solo en disco, sin aplicar)

## Fase 1 — Base de datos

### 1.1 Configuración y ranking (script 0009)

- [x] Crear script `0009_20260901-1637_educacion-medica_create-config-ranking-scoring.lefarma.sql`
  - [x] Tabla `config_ranking` (id_configuracion, nombre, version, activo, vigencia, auditoría) con `UNIQUE (nombre, version)` e `UX_config_ranking_activa` filtrado (`WHERE activo = 1`)
  - [x] Tabla `config_ranking_factores` (id_factor, id_configuracion FK, clave, grupo, peso `CHECK >= 0`, activo, tipo_normalizacion documental, parametros_json) con `UNIQUE (id_configuracion, clave)`
  - [x] Tabla `ranking_ejecuciones` (id_ranking_ejecucion, id_seleccion_mensual FK NO ACTION, id_configuracion FK, version_algoritmo, cantidad_solicitada, cantidad_candidatos, pesos_efectivos_json, filtros_json, fecha_ejecucion, id_usuario_ejecucion) + índice por selección y fecha
  - [x] Tabla `ranking_ejecucion_hospitales` (id_ejecucion_hospital, id_ranking_ejecucion FK CASCADE, id_hospital FK lógica, posicion, score_total, porcentaje_completitud, es_top_sugerido, decision DEFAULT+CHECK, factores_json) + `UNIQUE (id_ranking_ejecucion, id_hospital)`
  - [x] ALTER `selecciones_mensuales_hospitales`: `id_ranking_ejecucion` FK nullable, `score_sugerencia` + `UNIQUE (id_seleccion_mensual, id_hospital)` (con guard de duplicados previos)
  - [x] Seed "General V1": 4 factores (anestesias 40%, quirófanos 15%, recencia 25%, agrupabilidad 20% con `radio_km: 50`)
  - [x] `MS_Description` en todas las tablas y columnas nuevas
- [ ] Ejecutar `0009` en **LefarmaDev**
- [ ] Validar en dev: tablas, FKs, UNIQUEs, índice filtrado, seeds, ALTER, `MS_Description` visibles en SSMS
- [ ] Ejecutar `0009` en **Lefarma** (prod)

## Fase 2 — Backend

### 2.1 Entidades y configuración EF

- [x] Crear entidades `ConfigRanking`, `ConfigRankingFactor`, `RankingEjecucion`, `RankingEjecucionHospital`
- [x] Configuraciones EF en `Infrastructure/Data/Configurations/EducacionMedica/` (tablas, nombres de esquema, FKs, índices, CHECK, defaults)
- [x] Actualizar `ApplicationDbContext` (DbSets + aplicar configuraciones)
- [x] Actualizar `SeleccionHospital` entity: `IdRankingEjecucion`, `ScoreSugerencia`

### 2.2 Servicio de scoring

- [x] Crear `RankingHospitalesService` en `Features/EducacionMedica/Services/`
  - [x] Obtener candidatos (activos, no ya agregados)
  - [x] Calcular factores: anestesias_totales (percentil excluyendo NULLs), numero_quirofanos (percentil), recencia_seleccion (tramos), agrupabilidad_geografica (vecinos con misma clasificación, foráneo por tramos, local por percentil; sin coordenadas → neutral 50 + dato_disponible false)
  - [x] Calidad de datos: `porcentaje_completitud`
  - [x] Detectar factores sin variabilidad y redistribuir pesos (residuo mayor → Σ = 100.00 exacto)
  - [x] Score total 0–100, redondeo a 2 decimales, desempate (score DESC, id_hospital ASC)
  - [x] Persistir ejecución completa (`ranking_ejecuciones` + todos los candidatos en `ranking_ejecucion_hospitales`)
- [x] Pruebas unitarias: percentiles, NULLs, factor constante, pesos efectivos exactos, recencia, agrupabilidad, sin coordenadas, redondeo, determinismo, empates

### 2.3 Endpoints

- [x] `RankingHospitalesController`:
  - [x] `POST /{idSeleccionMensual}/ranking` generar ranking (estado Borrador/EnRevision, config activa existe)
  - [x] `GET /{idSeleccionMensual}/ranking/ultimo` última ejecución de la selección
  - [x] `GET /{idSeleccionMensual}/ranking/{idRankingEjecucion}` ejecución histórica (solo lectura)
  - [x] `POST /{idSeleccionMensual}/hospitales/lote` (transaccional; validar que la ejecución sea la última; snapshot de datos; actualizar decisión)
- [x] `ConfigRankingController`:
  - [x] `GET /` (config activa + factores + versiones anteriores)
  - [x] `POST /{id}/nueva-version` (copiar con nueva versión y activar; desactiva la anterior)
  - [x] `PUT /{id}` (solo si nunca fue usada; validar suma 100% y al menos un factor activo)
- [ ] Pruebas de integración: generar ranking, lote atómico, ejecución no última → 409, lote duplicado → error, quitar hospital no revierte decisión histórica

### 2.4 Vinculación con selección existente

- [x] Extender `agregarHospital` manual existente para que siga funcionando con las nuevas columnas NULL
- [x] Extender `quitarHospital` para no romper vínculo con ejecuciones históricas (la fila de selección se borra; la ejecución conserva su decisión)

## Fase 3 — Frontend

### 3.1 Types y API

- [x] Agregar tipos `RankingEjecucion`, `RankingEjecucionHospital`, `ConfigRanking`, `ConfigRankingFactor`, `LoteRequest`
- [x] Extender `educacionMedicaApi.seleccionesMensuales`: `generarRanking`, `obtenerRanking`, `agregarLote`
- [x] Crear `educacionMedicaApi.configRanking`: `get`, `nuevaVersion`, `update`

### 3.2 Pantalla de selección mensual

- [x] Botón "Sugerir hospitales" junto a "Agregar hospital" (solo estados editables)
- [x] Modal "Selección asistida":
  - [x] Encabezado: config usada, candidatos, cantidad solicitada
  - [x] Resumen: datos completos, sin coordenadas, score promedio
  - [x] Tabla ranking: checkbox, posición, hospital, entidad, score, top N, advertencias (sin coordenadas, dato incompleto)
  - [x] Top N preseleccionado (desde 5.8: solo los N se persisten/muestran y el default es "lo que falta"); usuario puede marcar/desmarcar
  - [x] Input "Top N sugeridos" editable junto a Generar (default = `talleresObjetivoMes` redondeado **hacia arriba a centenas** —64→100, 114→200— para dar margen de elección; si no hay objetivo, el usuario lo captura) — la cantidad elegida se congela en `cantidad_solicitada` de la ejecución
  - [x] Explicación "¿Por qué?": desglose por factor (valor crudo, score factor, peso, aporte)
  - [x] Advertencia especial para sin coordenadas: "Se utilizó valor neutral 50/100 para agrupabilidad"
  - [x] Botón "Agregar seleccionados" → `POST /hospitales/lote`
- [x] Columna "Score" en la tabla principal de hospitales seleccionados (— si es manual)
- [x] Columna/derivado "Origen" (Sugerencia / Manual)
- [x] Tooltip "Ver por qué" para hospitales de ranking → abre desglose de `factores_json`

### 3.3 Pantalla de configuración

- [x] Nueva página `/catalogos/config-ranking`:
  - [x] Mostrar config activa y factores (nombre, grupo, peso, activo, parámetros)
  - [x] Validar suma 100% en cliente
  - [x] Botón "Crear nueva versión" (copia inactiva)
  - [x] Edición solo si nunca fue usada; modo lectura si ya fue usada
  - [x] Edición de parámetro `radio_km` para agrupabilidad geográfica
- [x] Agregar ruta en `AppRoutes.tsx` y enlace en menú de catálogos

### 3.4 Validación

- [x] `npm run build` sin errores
- [ ] `npm run lint` sin warnings (max-warnings 0) — bloqueado por warnings/errores preexistentes en otras áreas del proyecto

## Fase 4 — Verificación parcial

- [x] `dotnet build` backend (0 errores)
- [x] `dotnet test --filter "Category=Unit"` (98 unit tests en verde, incluyendo 16 del motor de scoring)
- [ ] Script 0009 aplicado en dev (cuando el usuario lo autorice)

## Fase 5 — Correcciones de elegibilidad y administración de ejecuciones (2026-09-02)

> Revisión del flujo contra el ADR detectó que la implementación inicial calculaba el ranking sobre un universo sin filtro de gerencia y con historial de recencia global. El scoring en sí no cambió.

### 5.1 Elegibilidad por gerencia

- [x] Guard 409: selección sin `id_tipo_gerencia` → no se genera ranking (`GenerarRankingAsync`)
- [x] ~~Guard 409: selección sin `talleres_objetivo_mes`~~ — **revocado (2026-09-09)**: el Top N ahora lo captura el usuario en el modal ("Top N sugeridos"); `talleres_objetivo_mes` solo alimenta el default, ya no bloquea la generación
- [x] Filtro de candidatos por `hospital_extension.id_tipo_gerencia == seleccion.id_tipo_gerencia` (mismo mecanismo que el buscador manual en `HospitalService.AplicarFiltrosExtension`); hospitales sin fila en `hospital_extension` o con gerencia NULL quedan excluidos + `LogWarning`
- [x] `cantidad_candidatos` refleja el universo ya filtrado por gerencia
- [x] Tests unitarios `RankingEligibilidadTests` (6): misma gerencia, otra gerencia, sin extensión, gerencia NULL, universo mixto, descentralizado
- [ ] Pre-requisito operativo: llenar `hospital_extension.id_tipo_gerencia` (el usuario lo hará; con la columna poblada el filtro es determinístico)

### 5.2 Recencia correcta

- [x] `ObtenerUltimasSeleccionesAsync` filtra historial: solo selecciones de la **misma gerencia** (`s.IdTipoGerencia == seleccion.IdTipoGerencia`) y **anteriores** a la selección en curso (`s.FechaSeleccion < seleccion.FechaSeleccion`); antes tomaba el `Max(FechaSeleccion)` global de todas las selecciones activas

### 5.3 Exclusión Privado/Distribuidor como regla explícita

- [x] `HospitalRepository.GetHospitalesAsync` ya no aplica la exclusión implícita; ahora depende de `HospitalFilterParams.ExcluirTipos`
- [x] El ranking pasa `ExcluirTipos = ["Privado", "Distribuidor"]` como parte de su regla de elegibilidad
- [x] `HospitalService` (buscador manual, catálogo, mapa) pasa la misma exclusión explícitamente → comportamiento preservado

### 5.4 Persistencia de filtros (`filtros_json`)

- [x] `GenerarRankingAsync` persiste `ranking_ejecuciones.filtros_json` (la columna existía y nunca se escribía): gerencia (id + descripción), activo, tipos excluidos, exclusión de ya agregados, `regla_version: "elegibilidad-v1"`
- [x] `RankingEjecucionDto.Filtros` (DTOs `RankingFiltrosDto` / `RankingGerenciaFiltroDto`); ejecuciones antiguas sin `filtros_json` → null
- [x] El modal muestra la línea "Elegibilidad" con badges (gerencia, solo activos, excluye Privado/Distribuidor, sin ya agregados)

### 5.5 Flujo del modal: cargar último, no regenerar

- [x] `abrirRanking` ahora llama `GET /ranking/ultimo`; solo si no existe (404) genera la primera ejecución automáticamente
- [x] Nuevo botón "Generar de nuevo" en el modal (crea ejecución explícita; las decisiones previas quedan congeladas y protegidas por 409)
- [x] Ya no se descarta la ejecución al cerrar el modal; cada apertura ya no crea ejecuciones fantasma
- [x] `cantidad` sale del input "Top N sugeridos" del modal (default = `talleresObjetivoMes` de la selección); si la selección no tiene objetivo, el usuario lo captura en el input (ya no hay toast bloqueante ni cierre del modal)
- [x] Estado de carga en el modal mientras se consulta/genera

### 5.6 Verificación de la fase

- [x] `dotnet build` (0 errores) y `dotnet test` unitarios: 104/104 (98 previos + 6 nuevos)
- [x] `npx tsc --noEmit` y `npm run build` sin errores
- [x] eslint en archivos del ranking: sin errores nuevos (persisten 2 errores preexistentes de `react-hooks/set-state-in-effect` en `SeleccionMensualPage.tsx`, ajenos a este cambio)

### 5.7 Filtros opcionales V1

- [x] Catalogar `Asokam.dbo.genEstadosCat`: entidad `GenEstado`, configuración EF, `DbSet` en `AsokamDbContext`
- [x] Backend `RankingHospitalesService`:
  - [x] Helper `AplicarFiltrosOpcionales` (búsqueda por nombre/ciudad/colonia, `codigoEstado`, `es_zona_metropolitana`)
  - [x] Integrar filtros opcionales después del filtro de gerencia y antes del scoring
  - [x] Persistir filtros aplicados en `filtros_json` (`search`, `codigoEstado`, `estadoNombre`, `zonaMetropolitana`)
  - [x] Nuevo endpoint `GET /{idSeleccionMensual}/ranking/filtros-disponibles` (estados + conteos local/foráneo)
  - [x] Tests unitarios: sin filtros, búsqueda, estado, zona, sin extensión, combinados (6 tests)
- [x] Frontend:
  - [x] Tipos `FiltrosDisponibles`, `EstadoFiltro`, extender `RankingFiltros` y `GenerarRankingRequest`
  - [x] API client `obtenerFiltrosDisponibles`
  - [x] `SeleccionMensualPage`: estado de filtros, carga de disponibles al abrir modal, payload con filtros al regenerar
  - [x] `RankingModal`: panel de filtros (buscar, select estado, select local/foráneo), badges de filtros aplicados, botón Limpiar
- [x] Verificación: backend 110/110 unit tests, frontend `tsc` + `build` sin errores

### 5.8 Ranking limitado a Top N y pre-marcado "lo que falta" (2026-09-09)

- [x] Backend `RankingHospitalesService.GenerarRankingAsync`: persistir solo `Take(cantidad)` en `ranking_ejecucion_hospitales` (posiciones 1..N, `es_top_sugerido = 1` en todas); `cantidad_candidatos` conserva el universo evaluado
- [x] DTO `RankingEjecucionDto` + `cantidadYaAgregados` (conteo vivo de hospitales con `id_hospital` en la selección, calculado en `MapearDto`); default de pre-marcado = `max(0, cantidad - yaAgregados)`
- [x] Frontend `RankingModal`: pre-marcado inicial = primeros `min(faltantes, ranking.length)` ordenados por posición; encabezado muestra "X ya en la selección · pre-marcados los primeros Y (lo que falta para completar N)"; badge "Top sugerido" retirado (todas las filas son top)
- [x] Docs: ADR-00005 revisado (decisiones 14 y 22, `NoSugeridoSeleccionado` deprecado sin migración)
- [x] Verificación: backend 155/155 unit tests, frontend `build` sin errores

### Backlog pendiente (no bloquea)

- [ ] Conteo IMSS/Descentralizados en el resumen del modal (requeriría `institucion` en `RankingHospitalItemDto`)
- [ ] Pruebas de integración de gerencia/recencia/filtros opcionales contra BD real
