# Tareas — 00015 Reparto por ejecutivo y rutas por especialista

> Vinculada a: [[decisiones/00015_reparto-ejecutivo-rutas-especialista]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend, 4 Verificación.
> Dependencias: [[decisiones/00017_tercera-gerencia-imss-bienestar]] (tercera gerencia) y [[decisiones/00016_calendario-planeacion-talleres]] (pantalla). El candado/matriz se implementa en [[decisiones/00018_candado-solicitudes-matriz]].
> Reemplaza el modelo de equipos de [[decisiones/00004_reparto-y-planificacion-rutas]]; conserva zonas, capacidad y draft→select.

## Diagramas

> Pendientes de crear en `diagramas/` con numeración de esta decisión (`000015_<tipo>_<nombre>`):

- [ ] `000015_er_reparto_ejecutivo_especialista.html` — ER de `ejecutivo_region`, `especialista_gerencia`, `especialista_region` y columnas nuevas.
- [ ] `000015_flujo_reparto_planeacion.html` — selección → ejecutivo → ruta por especialista → taller.
- [ ] Opcional Mermaid `000015_flujo_reparto_planeacion_mermaid.mmd/.svg`.

## Fase 0 — Planificación

- [x] Decisiones del usuario (2026-10-23): ruta por especialista; ejecutivo dueño de la selección; sin equipos de pareo; ruta draft sin workflow; sugerencia por cercanía.
- [x] Crear ADR-00015 y esta tarea.
- [ ] Revisión del usuario del ADR-00015.
- [ ] Confirmar con el área:
  - [ ] Roster/usuarios que serán especialistas (se define al final; no bloquea el modelo).
  - [ ] Gerencias permitidas por especialista (4 cualquiera, 1 sin IMSS; se configura en Personas).
  - [ ] Región obligatoria del ejecutivo y opcional del especialista.
  - [ ] “Mínimo 8” por ejecutivo: ¿semanal o mensual? ¿ejecutivo o especialista? (parámetro).
- [ ] Validar datos existentes en dev: conteo de `equipos_pareo`, rutas y matrices con `id_equipo`.

## Fase 1 — Base de datos (script 0033)

> **Estado 2026-10-23:** script 0033 creado e integrado en 0016; ambos pasan `PARSEONLY` (exit 0). Se corrigió el error de compilación del primer `UPDATE` (SQL Server compila el batch antes de ejecutar los `ALTER TABLE`) moviendo índices/FKs a SQL dinámico. **No se hace backfill:** los datos operativos se limpian con 0037. Pendiente revisión y ejecución del usuario.

- [x] Crear `lefarma.database/educacion-medica/0033_20261023-1000_educacion-medica_reparto-ejecutivo-especialista.lefarma.sql` (idempotente, transacción única, estilo 0016/0027).
- [x] Tablas:
  - [x] `ejecutivo_region` (`id_usuario`, `id_region_catalogo`, `activo`, auditoría; FK física a `regiones_cat`; FK lógica a `app.Usuarios`). Sin vigencia desde 0038.
  - [x] `ejecutivo_suplente` (`id_usuario`, `id_tipo_gerencia` NULL, `id_region_catalogo` NULL, `activo`, auditoría; NULL = todas; se usa solo si no hay primario).
  - [x] `especialista_gerencia` (`id_usuario`, `id_tipo_gerencia`, `activo`, auditoría; FK física a `tipo_gerencia`; único activo `(id_usuario, id_tipo_gerencia)`).
  - [x] `especialista_region` (`id_usuario`, `id_region_catalogo`, `activo`, auditoría; opcional).
- [x] Columnas:
  - [x] `selecciones_regiones.id_ejecutivo INT NULL` e `id_especialista INT NULL`.
  - [x] `selecciones_mensuales_hospitales.id_ejecutivo INT NULL` e `id_especialista INT NULL` (no existían en 0016; se agregaron en 0033 y 0016).
  - [x] `rutas.id_especialista INT NULL`; `rutas.id_equipo` pasa a NULL.
  - [x] `rutas_visitas.id_ejecutivo INT NULL`, `id_especialista INT NULL`.
  - [x] `talleres.id_ruta_visita INT NULL`.
  - [x] `matrices_individuales.id_ejecutivo INT NULL`; `id_equipo` pasa a NULL.
- [x] **Sin backfill** (decisión 2026-10-23): no se migran `equipos_pareo`; los datos operativos se limpian con `0037`.
- [x] Crear `0037_20261023-1400_educacion-medica_limpieza-datos-operativos.lefarma.sql` (talleres, matrices, rutas, selecciones, equipos y rankings; conserva catálogos).
- [x] `MS_Description` en tablas y columnas nuevas; marcar `equipos_pareo`/`id_equipo` como histórico.
- [x] Validar sintaxis con `PARSEONLY` (`sqlcmd -f 65001`): 0016, 0033 y 0037 exit 0.
- [ ] Revisión del usuario de los scripts.
- [x] 0033 y 0034 aplicados en LefarmaDev2 (2026-10-23).
- [x] 0037 ejecutado en LefarmaDev2 (2026-10-23): datos operativos en cero; catálogos/hospital_extension intactos.
- [x] 0035 y 0036 ejecutados en LefarmaDev2 (2026-10-23).
- [x] Actualizar `0016_..._create-esquema-completo.lefarma.sql` para instalación limpia (tablas de personas, columnas, índices filtrados y FKs; `ejecutivo_region` sin fechas y `ejecutivo_suplente`).
- [x] Crear `0038_20261023-1500_educacion-medica_ejecutivo-suplente-sin-vigencia.lefarma.sql` (idempotente): retira `fecha_inicio`/`fecha_fin` y crea `ejecutivo_suplente`.
- [x] Validar 0038 con `PARSEONLY` y `NOEXEC` contra LefarmaDev2 (exit 0).
- [ ] Revisión/ejecución de 0038 por el usuario.

### Lección SQL (2026-10-23)

- SQL Server compila el batch completo **antes** de ejecutar los `ALTER TABLE`. Cualquier `CHECK`, índice, FK, `UPDATE` o `INSERT` que use una columna agregada en el mismo batch falla con `Invalid column name`, aunque el `ALTER` esté antes.
- Regla para próximos scripts: `ALTER TABLE ... ADD [col]` queda estático; todo lo que use `[col]` va en `EXEC(N'...')` o en un batch separado (`GO`).
- Validación obligatoria:
  1. `SET PARSEONLY ON` para gramática.
  2. `SET NOEXEC ON` contra `LefarmaDev2` para compilar contra el esquema real (este sí detecta `Invalid column name`).
  3. Extraer y parsear los bloques `EXEC(N'...')` (el `NOEXEC` no compila SQL dinámico).
- Aplica a 0033, 0034, 0035, 0036 y 0037; los cuatro primeros ya fueron corregidos con SQL dinámico.

## Fase 2 — Backend

### 2.1 Entidades y configuraciones

- [x] `Domain/Entities/EducacionMedica/EjecutivoRegion.cs`, `EspecialistaGerencia.cs`, `EspecialistaRegion.cs`.
- [x] `Infrastructure/Data/Configurations/EducacionMedica/` para las 3 tablas.
- [x] `SeleccionRegion`: agregar `IdEjecutivo`/`IdEspecialista`; `IdEquipo` nullable/legacy.
- [x] `SeleccionHospital`: agregar `IdEjecutivo`, `IdEspecialista`.
- [x] `Ruta`: agregar `IdEspecialista`; `IdEquipo` nullable/legacy.
- [x] `RutaVisita`: agregar `IdEjecutivo`, `IdEspecialista`.
- [x] `Taller`: agregar `IdRutaVisita`.
- [x] `MatrizIndividual`: agregar `IdEjecutivo`; `IdEquipo` nullable/legacy.
- [ ] `RutaVersion`: retirar `IWorkflowEntity`/columnas de workflow del uso (dejarlas legacy) o marcar obsoletas.

### 2.2 Servicios

- [x] `PersonasService` (agrupa EjecutivoRegion/EjecutivoSuplente/EspecialistaGerencia/EspecialistaRegion): CRUD, validar una sola gerencia por ejecutivo, al menos una gerencia por especialista, resolver nombres. Suplentes con cobertura total/serencia/región y sin vigencia.
- [x] `SeleccionEjecutivoService`:
  - [x] `AsignarEjecutivoAsync` (servicio separado para no tocar el constructor de `SeleccionMensualService`).
  - [x] Cierre exige todas las regiones con ejecutivo primario, suplente o `IdEquipo` legacy.
  - [x] `SeleccionRegionDto` y `SeleccionHospitalDto` con `IdEjecutivo`/`NombreEjecutivo`/`IdEspecialista`/`NombreEspecialista`; el detalle resuelve nombres desde Asokam.
  - [x] Override por hospital validado contra misma región/gerencia (`AsignarEjecutivoHospitalAsync`).
  - [x] `IEjecutivoElegibilidadService` compartido para primario/suplente y búsqueda de cobertura.
- [ ] `RutasService`:
  - [x] Generar por especialista (no por equipo); si no hay especialistas configurados, agrupa en una ruta sin especialista y conserva el fallback legacy por equipo.
  - [x] Asignar/reasignar especialista por visita (`AsignadorEspecialistasService`).
  - [x] Validar elegibilidad/capacidad (3/día y 8/semana desde parámetros).
  - [ ] Retirar workflow de rutas (`enviar-revision`, `firmar`, `cerrar`).
  - [x] Precedencia de ejecutivo en visitas: `RutaVisita` → `SeleccionHospital` → `SeleccionRegion`.
  - [x] Asignación manual de `RutaVisita.IdEjecutivo` con validación de región/gerencia y auditoría en ruta Cerrada.
  - [ ] Retirar validación legacy “región → equipo” de los flujos restantes; usar “región → ejecutivo/especialista”.
- [x] `AsignadorEspecialistasService`:
  - [x] Bloques ciudad/día (sugerencia por ciudad y fecha).
  - [x] Sugerencia Puebla (misma ciudad mismo día / día contiguo).
  - [x] Capacidad 3/día y 8/semana (parámetros; foráneos queda pendiente).
  - [x] Balanceo por carga semanal.
- [x] `TalleresService`:
  - [x] Crear desde `idRutaVisita` (hereda hospital, ejecutivo, especialista, fecha y hora).
  - [x] Default cantidad producto 2 (`producto_cantidad_default`, fallback 2).
  - [ ] Extraordinario por alcance (ADR-00017).
- [x] `MatrizTalleresService`: matriz individual por ejecutivo (creación, bloqueo y concentración).
- [ ] Revisar matriz general por gerencia y vista consolidada.
- [ ] `WorkflowService`: id 3 = IMSS Bienestar; retirar `RUTAS` del motor.

### 2.3 Endpoints

- [x] `GET/POST/PUT/DELETE /api/educacion-medica/personas/ejecutivos`.
- [x] `GET/POST/PUT/DELETE /api/educacion-medica/personas/ejecutivos-suplentes`.
- [x] `GET/PUT /api/educacion-medica/personas/especialistas`.
- [x] `PUT /api/educacion-medica/selecciones-mensuales/{id}/regiones/{idRegion}/ejecutivo`.
- [x] `PUT /api/educacion-medica/selecciones-mensuales/{id}/hospitales/{idSeleccionHospital}/ejecutivo` (override).
- [ ] `POST /api/educacion-medica/selecciones-mensuales/{id}/rutas/generar`.
- [x] `PUT /api/educacion-medica/rutas/visitas/{idVisita}/especialista`.
- [x] `PUT /api/educacion-medica/rutas/{idRuta}/visitas/{idRutaVisita}/ejecutivo` (manual; ajuste auditado en ruta Cerrada).
- [x] `GET /api/educacion-medica/rutas/sugerencias`.
- [x] Guards `[HasPermission]` en Personas y asignación de ejecutivo (permisos existentes `ConfiguracionGestionar` y `SeleccionesGestionar`).

### 2.4 Pruebas

- [x] Ejecutivo sin región en la gerencia → rechazado (`PersonasServiceTests`).
- [x] Región sin ejecutivo ni suplente al cerrar → rechazado (`FirmarAsync_CerrarConRegionSinEquipo_Debe_Lanzar`).
- [x] Especialista sin elegibilidad → rechazado (validación en `SeleccionEjecutivoService`).
- [x] Capacidad 3/día y 8/semana → rechazo en asignación (implementado; falta test unitario).
- [x] Sugerencia Puebla (misma ciudad mismo día / día contiguo) → propuesta (implementado; falta test unitario).
- [x] Hospital de otra ciudad lejana → no propuesto (scoring por ciudad; falta test unitario).
- [x] Reasignación entre especialistas conserva ejecutivo (el endpoint no toca `IdEjecutivo` si ya existe).
- [x] Asignación manual de ejecutivo por visita valida misma región/gerencia (`RutasServiceTests.AsignarEjecutivoVisita...`).
- [x] Región sin ejecutivo con suplente elegible → se asigna suplente y la selección cierra (`SeleccionMensualServiceTests.FirmarAsync_CerrarRegionSinEjecutivoConSuplente...`).
- [x] Override de hospital valida misma región/gerencia y rechaza otra región (`SeleccionEjecutivoServiceTests`).
- [x] Suplente con cobertura total y derivación de gerencia desde región (`PersonasServiceTests`).
- [x] Taller desde visita hereda roles/fecha (`TalleresServiceTests.Crear_DesdeVisita...`).
- [x] Matriz individual por ejecutivo (creación y bloqueo); general por gerencia se conserva.
- [x] Default de cantidad de producto = 2 cuando no se captura (`TalleresServiceTests.Crear_DesdeVisita...`).
- [x] No regresión de selección/rutas/matriz: `dotnet test tests/Lefarma.UnitTests` 510/510 en verde.
- [x] `dotnet build` 0 errores.

## Fase 3 — Frontend

> Detalle de implementación: [[tareas/00019_frontend-personas-ejecutivos-suplentes]], [[tareas/00020_frontend-seleccion-ejecutivo-suplente]], [[tareas/00021_frontend-calendario-planeacion-unificado]], [[tareas/00022_frontend-calendario-vista-tabla-matriz]] y [[tareas/00023_frontend-api-tipos-navegacion-limpieza]].

- [ ] `SeleccionMensualPage`: selector de ejecutivo por región; especialista opcional; validación de gerencia.
- [ ] `PersonasPage` (nueva): tabs Ejecutivos/Suplentes/Especialistas; tabla, filtros, modal de alta/edición; en Ejecutivos sin columnas de vigencia; en Suplentes gerencia/región "Todas" cuando sea NULL.
- [ ] `RegionesPanel`/`ResumenSeleccionModal`: mostrar ejecutivo + especialista; eliminar “equipo”.
- [ ] `PlaneacionPage` (ADR-00016): consume rutas por especialista; asignación de especialista; sugerencias.
- [ ] `MisTalleresPage`/`MatrizTalleresPage`: dejar de usar `EquipoPareo`; mostrar ejecutivo/especialista.
- [ ] Retirar `EquiposPareoPage` del menú/rutas; conservar archivo como legado o eliminar en follow-up.
- [ ] Actualizar `educacionMedica.api.ts` y tipos.
- [ ] `npm run build` y `npm run lint`.

## Fase 4 — Verificación y cierre

- [ ] E2E: selección con ejecutivo → cerrar → generar ruta por especialista → sugerencia Puebla → asignar → taller → matriz.
- [ ] E2E: reasignar especialista; validar capacidad/elegibilidad.
- [ ] E2E: tercera gerencia (ADR-00017) en selección/ruta/matriz.
- [ ] Limpieza de datos de dev verificada (conteos en cero; catálogos intactos).
- [ ] `dotnet test` en verde.
- [ ] `npm run build` y `npm run lint` en verde.
- [ ] Actualizar `reglas-negocio.md` §5.2–5.5, §5.10, §5.11 y §7.
- [ ] Actualizar `presentacion-proceso.md` (pantallas).
- [ ] Marcar ADR-00004 como `Superseded by ADR-00015` (ya hecho en el ADR) y ADR-00015 como `Accepted` al aprobarse.
- [ ] Actualizar ER/diagramas.

## Pendientes fuera de alcance

- [x] **Validar override de ejecutivo por hospital:** misma región/gerencia, endpoint y precedencia implementados.
- [ ] Limpieza destructiva de columnas `id_equipo` y tabla `equipos_pareo` (follow-up).
- [ ] Roster definitivo de especialistas (se define al final, por el usuario).
- [ ] Reglas de “mínimo 8” (semanal/mensual) y metas por gerencia; se configuran en Parámetros.
- [ ] Notificaciones de asignación al especialista (futuro).
