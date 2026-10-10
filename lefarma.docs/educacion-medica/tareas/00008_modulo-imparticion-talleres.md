# Tareas — 00008 Módulo de Impartición de Talleres

> Vinculada a: [[decisiones/00008_modulo-imparticion-talleres]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend, 4 Verificación y cierre.
> Continúa [[tareas/00007_modulo-matriz-talleres]]: reutiliza sus patrones (servicio + controller + modales + imprimibles).
> Las tablas `taller_materiales`, `taller_asistencias` y `taller_evidencias` ya existen (script `0003_..._create-tablas-operacionales`) y **no tienen datos** en operación.
>
> **Revisión 2026-10-08**: script renumerado `0020` → **`0023`** (ya existen `0021` permisos/guards y `0022` drop `id_ejecutivo`); `taller_aprobaciones` también se quita de `0016`; endpoints nuevos con `[HasPermission]` (patrón ADR-00009, mapa en el ADR Fase 2.4); estado inicial del taller `Creada` (ya no `Borrador`). **Decisiones #1–#8 resueltas (2026-10-08).**
>
> **Revisión 2026-10-09**: se ajustan las decisiones #1, #3 y #4 y se agregan #9–#13 — `Programado` **automático** al cerrar la matriz; `EnCurso` manual con **sugerencia** el día del taller; cancelación también por **CEM**; **historial de estados** en tabla `taller_estados_historial` (no JSON); select de **solo transiciones permitidas**; y **panel de situación del equipo** (#14: KPIs + avance + badges con icono en "Mis talleres", v2 en el Dashboard). Detalle en la nota de revisión del ADR-00008 y en Fase 0.

## Diagramas

> Pendientes de crear en `diagramas/` con numeración de esta decisión (`000008_<tipo>_<nombre>`), si se requieren:

- [ ] `000008_flujo_imparticion.html` — Cierre de matriz → Programado (automático) → material → EnCurso (sugerido) → Realizado/Cancelado, con historial de estados
- [ ] `000008_er_imparticion.html` — `talleres` + `taller_materiales` + `taller_asistencias` + `taller_evidencias` (sin `taller_aprobaciones`)
- [ ] Variantes Mermaid `.mmd`/`.svg` opcionales

## Fase 0 — Planificación

- [x] Analizar el estado actual: tablas hijas dormidas (`taller_materiales` 1:1, `taller_asistencias` 1–20, `taller_evidencias` 1:N), `talleres.estado` con máquina completa sin transiciones implementadas (solo `Autorizado` lo escribe la Matriz), servicio de archivos existente
- [x] Detectar que `taller_aprobaciones` es redundante (bitácora del motor) → eliminar
- [x] Definir UX con el usuario (2026-10-07): **sin pantalla nueva**; botones por fila en "Mis talleres" que abren modales (material, asistencia, evidencias, estado); AEM gestiona material desde la Matriz
- [x] Crear ADR 00008 y estas tareas
- [x] **Revisión del usuario de este plan y del ADR** (14 decisiones de la Fase 0.9):
  - [x] 1. `Programado` manual del AEM (vs automático al confirmar material) — **automático al cerrar la matriz (revisado 2026-10-09)**: el `CERRAR` del DC escribe `Programado` directo; antes manual del AEM (2026-10-08)
  - [x] 2. Firma digital del EV al confirmar material — **sí** (patrón bitácora: firma + fecha + usuario)
  - [x] 3. `EnCurso` obligatorio antes de `Realizado` — **sí, sin candado de horario + sugerencia el día del taller (revisado 2026-10-09)**
  - [x] 4. Cancelación: GV/AEM con motivo, desde `Autorizado`/`Programado` — **GV + AEM + CEM (revisado 2026-10-09)**, desde `Programado`/`EnCurso`; borrar el taller sigue disponible mientras la Matriz esté en `Creada`
  - [x] 5. `Realizado` exige ≥1 evidencia **y** ≥1 asistencia — **sí**, validado en el servicio
  - [x] 6. Eliminar `taller_aprobaciones` con script (decidido 2026-10-07; además se quita de `0016`)
  - [x] 7. Imprimibles FOR-007/FOR-008 en este módulo — **sí, pre-llenados** (además del escaneo como evidencia)
  - [x] 8. Agregar `talleres.fecha_realizado` — **sí**
  - [x] 9. ¿Cuándo pasa a `Programado`? — **automático al cerrar la matriz (2026-10-09)**, historial origen Automático
  - [x] 10. ¿`EnCurso` automático? — **manual con sugerencia (2026-10-09)**, sin jobs
  - [x] 11. ¿Quién cancela tras el cierre? — **GV + AEM + CEM (2026-10-09)**, con motivo, desde `Programado`/`EnCurso`
  - [x] 12. ¿Historial de estados? — **tabla `taller_estados_historial` (2026-10-09)**, no JSON embebido
  - [x] 13. ¿Select libre de estados? — **solo transiciones permitidas (2026-10-09)**
  - [x] 14. ¿Panel de situación del equipo? — **sí (2026-10-09)**: v1 en "Mis talleres" (KPIs + barra de avance + badges con icono + stepper), v2 en el Dashboard del módulo
- [x] Confirmar roles por transición y por modal (EV/EP capturan e inician/cierran; AEM material y programa; GV/AEM/CEM cancelan) — confirmado con las decisiones 2026-10-08 y 2026-10-09

## Fase 1 — Base de datos

### 1.1 Script 0023 (solo disco, sin aplicar)

- [x] Crear `0023_20261008-1000_educacion-medica_imparticion-talleres.lefarma.sql` (idempotente, transacción única, estilo 0015/0019)
  - [x] `DROP TABLE educacion_medica.taller_aprobaciones` (guardado `IF EXISTS`; sin datos)
  - [x] Quitar `taller_aprobaciones` de `0016` (instalación limpia ya no la crea; el DROP aplica a BD existentes)
  - [x] `ALTER taller_materiales`: `firma_url NVARCHAR(500)`, `fecha_recepcion DATETIME2`, `id_usuario_recepcion INT` (decisión 2 ✔)
  - [x] `ALTER talleres`: `fecha_realizado DATE NULL` (decisión 8 ✔)
  - [x] `CREATE TABLE taller_estados_historial` (revisión 2026-10-09 — decisión 12 ✔): `estado_anterior`, `estado_nuevo`, `origen` CHECK (`Automatico`|`Manual`), `motivo`, `id_usuario`, `fecha` DEFAULT SYSDATETIME(), `datos_json` opcional, FK a `talleres`, índice `(id_taller, fecha)`, `MS_Description`
  - [x] `MS_Description` de columnas nuevas
  - [x] Sin backfill (no hay datos)
- [x] Validar sintaxis y `PARSEONLY` contra LefarmaDev2 sin ejecutar _(2026-10-10: PARSEONLY OK con `sqlcmd -f 65001`)_
- [x] **Revisión del usuario del script**
- [x] Ejecutar `0023` en **LefarmaDev2** _(ejecutado por el usuario; verificado por INFORMATION_SCHEMA en Fase 4)_
- [ ] Ejecutar `0023` en **Lefarma** (prod; aplicar con el usuario)

## Fase 2 — Backend

### 2.1 Entidades y EF

- [x] `TallerMaterial` (1:1, `UNIQUE id_taller`), `TallerAsistencia` (1:N), `TallerEvidencia` (1:N) + navegaciones en `Taller`
- [x] Configuraciones EF (columnas, CHECKs existentes, índices) + DbSets en `ApplicationDbContext`

### 2.2 Servicio y endpoints (extiende `api/educacion-medica/talleres`)

- [x] `GET/PUT /{id}/material` (AEM: registrar/editar entrega) + `POST /{id}/material/confirmar` (EV: firma + fecha + usuario, patrón bitácora — decisión 2 ✔) + **evidencia del formato firmado** (foto/escaneo, subida al expediente vía endpoint de evidencias)
- [x] `GET/POST/PUT/DELETE /{id}/asistencias` (EV/EP; máx. 20; **transcripción de la lista llenada a mano**; la **hoja firmada se adjunta una sola vez como evidencia** — revisión 2026-10-10: sin `firma_url` por asistente)
- [x] `GET/POST/DELETE /{id}/evidencias` (EV/EP desde `EnCurso`)
- [x] `POST /{id}/estado` `{nuevoEstado, motivo?}`: máquina de estados validada en servicio; **cada transición escribe `taller_estados_historial`** (origen, motivo, usuario — decisión 12 ✔)
  - [x] **Cierre de matriz → `Programado`** (automático; lo escribe la sincronización del `CERRAR` del DC en `MatrizTalleresService` — decisión 9 ✔) · `Programado → EnCurso` (EP/EV, **sin candado de horario**, sugerido el día del taller — decisión 10 ✔) · `EnCurso → Realizado` (EP/EV, exige **≥1 evidencia y ≥1 asistencia**, escribe `fecha_realizado` — decisiones 5 ✔ y 8 ✔) · `Programado/EnCurso → Cancelado` (**GV, AEM y CEM**, motivo obligatorio — decisión 11 ✔)
- [x] `GET /{id}/estados`: historial de transiciones (`talleres.puede_ver`) — revisión 2026-10-09
- [x] `[HasPermission]` por endpoint (patrón ADR-00009; mapa en el ADR Fase 2.4): material lectura/documentos → `talleres.puede_ver`; entrega → `materiales.puede_gestionar`; confirmar → `materiales.puede_confirmar`; asistencias → `talleres.puede_capturar`; evidencias → `evidencias.puede_gestionar`; `POST /{id}/estado` → `talleres.puede_ver` + rol/transición en servicio
- [x] `GET /{id}/documento-material` y `GET /{id}/documento-asistencia` (imprimibles FOR-007/FOR-008)
- [ ] Archivos: `EntidadTipo` `TallerEvidencia` (carpeta `educacion-medica-evidencias`, incluye la hoja firmada de asistencia; revisión 2026-10-10: se retira `TallerAsistencia`) _(backend genérico; el mapeo vive en el frontend — Fase 3)_

### 2.3 Pruebas

- [x] `TallerImparticionServiceTests`: transiciones válidas/inválidas por estado y rol, **cierre de matriz escribe `Programado` (automático)**, **historial escrito en cada transición (origen, motivo, usuario)**, candado de evidencias por estado, límite 20 asistencias, 1:1 material, confirmación EV con firma + fecha + usuario (patrón bitácora), cancelación con motivo por **GV/AEM/CEM**, `Realizado` exige **≥1 evidencia y ≥1 asistencia** (validado en el servicio), `EnCurso`/`Realizado` sin candado de horario, escritura de `fecha_realizado`
- [x] `dotnet build` + `dotnet test` (suite completa) en verde

## Fase 3 — Frontend

### 3.1 API y tipos

- [x] `services/educacionMedica.api.ts`: `talleres.material.*`, `talleres.asistencias.*`, `talleres.evidencias.*`, `talleres.cambiarEstado`, documentos
- [x] `types/educacionMedica.types.ts`: `TallerMaterial`, `TallerAsistencia`, `TallerEvidencia`, requests
- [x] `documentoEntidad.ts`: entidades de archivos de asistencias/evidencias

### 3.2 Mis talleres (sin pantalla nueva)

- [x] `MisTalleresPage`: botones por fila → `MaterialModal` (ver/confirmar + subir evidencia del formato firmado), `AsistenciaModal` (transcribir 1–20 + subir la hoja firmada como evidencia — revisión 2026-10-10), `EvidenciasModal` (subir/listar), `EstadoAcciones` (select con **solo transiciones permitidas** por rol/estado — decisión 13 ✔; sugerencia de Iniciar el día del taller; Cancelar con motivo), `HistorialEstadosModal` (decisiones 12 ✔)
  - [x] Nota UX (2026-10-08): la columna "Estado" hoy muestra el **estado del workflow de la matriz**; los estados de impartición se muestran/accionan con la acción por fila (o columna propia), no en esa columna
- [x] Modo lectura por rol/estado; refresco tras cada acción
- [x] **Panel de situación** (decisión 14 ✔): KPIs del mes (Total, Programados, En curso, Realizados, Cancelados) + `Progress` de avance `Realizados/Total` + badges con icono/color por estado en la tabla + **stepper** del taller en `EstadoAcciones`; v2: reutilizar el resumen en `EducacionMedicaDashboard` _(v1 completa; v2 pendiente del endpoint de resumen)_
- [x] Con candado puesto o matriz fuera de captura: botón **"Solicitar cambio"** en `MisTalleresPage` (modal con diff hacia `datos_json` + motivo) y estado de la solicitud; en `MatrizTalleresPage`, **pendientes arriba con icono** y acción Resolver (ADR-00010)
- [x] Verificar que la columna Estado muestra el **estado del taller** (badge con icono), no el del workflow de la matriz (nota UX 2026-10-08)

### 3.3 Matriz (AEM)

- [x] `MatrizTalleresPage`: acción por taller → `MaterialModal` (AEM registra/edita entrega) + lectura de asistencias/evidencias

### 3.4 Imprimibles

- [x] `MaterialPrintDocument` (FOR-007) y `AsistenciaPrintDocument` (FOR-008) **pre-llenados** con los datos del taller, con patrón actualizado de `MatrizPrintDocument` (portal `print:block` + clase `body.print-*` para orientación; el de la matriz usa layout de dos bloques FOR-005); el papel firmado/escaneado se sube además como evidencia

### 3.5 Verificación frontend

- [x] `pnpm run build` en verde _(ejecutado con `npm run build` en este repo)_
- [x] ESLint limpio en archivos nuevos/modificados
- [ ] Pruebas manuales: cierre de matriz (`Programado` automático) → material → confirmación → iniciar (sugerido el día) → asistencias → evidencias → cerrar → ranking; historial de estados

## Fase 4 — Verificación y cierre

- [x] E2E completo: matriz cerrada (DC) → talleres **`Programado` automático** → AEM material → EV confirma (firma digital) → EP inicia (sugerido el día) → asistencias (con firma) + evidencias → cierra `Realizado` (exige ≥1 evidencia y ≥1 asistencia) → `cobertura_taller` refleja el taller; cancelación con motivo por **GV/AEM/CEM**; historial de estados por taller
  _(ejecutado en vivo el 2026-10-10 sobre LefarmaDev2: 26/26 checks API + 18/18 checks UI Playwright; el cierre de matriz se simuló con un UPDATE de estado por no contar con el flujo completo firmado en el escenario; `cobertura_taller` no se recalculó en vivo — lee `estado='Realizado'`, cubierto por unit tests)_
- [x] Panel de situación: KPIs y barra de avance correctos por mes/estado; badges con icono; stepper en el modal de estado
- [x] Imprimibles FOR-007/FOR-008 con layout del formato
- [x] Sincronizar checkboxes de esta tarea y del ADR-00008
  _(tarea sincronizada; ADR-00008 marcado `Accepted` el 2026-10-10 con aprobación del usuario)_
- [x] `reglas-negocio.md`: nueva §5.12 "Impartición de talleres (digital)" y actualizar §6 (modelo: sin `taller_aprobaciones`)
- [x] Diagramas `000008_*` (flujo + ER)
- [x] Registrar lecciones

### Revisión (2026-10-10) — asistencia sin firma por asistente

- Decisión del usuario: subir la firma de cada asistente (hasta 20 fotos por taller) es excesivo por seguridad de datos y tiempo de captura. La hoja firmada a mano se sube **una sola vez** como evidencia (`taller_evidencias`, tipo `documento`, descripción fija "Hoja de lista de asistencia firmada").
- Script `0031` elimina `taller_asistencias.firma_url` (idempotente; **pendiente de aplicar** en LefarmaDev2 y prod con el usuario). `0016` actualizado: las instalaciones limpias ya no crean la columna.
- Backend: `FirmaUrl` fuera de entidad/EF config/DTOs/servicio; suite `Lefarma.UnitTests` en verde (389).
- Frontend: `TallerAsistenciaModal` con subida única de la hoja (reemplazar/quitar), `AsistenciaPrintDocument` con columna Firma en blanco para firma manual; build + ESLint en verde.
- Documentación sincronizada: ADR-00001 (§1.2.9 y endpoints), ADR-00008 (decisión 3 y anexos), §5.12 de `reglas-negocio.md`, diagramas `000008_er_imparticion.html` y `000008_flujo_imparticion.html`.

### Lecciones registradas (2026-10-10)

1. **Ejecución de scripts con acentos**: los scripts se ejecutaron con el codepage equivocado (sin `-f 65001` en sqlcmd), así que todos los `INSERT` que comparan nombres de rol acentuados (`'Coordinador de Educación Médica'`, etc.) insertaron 0 filas en silencio. Verificar SIEMPRE con una consulta a `app.RolesPermisos` tras aplicar seeds de permisos. (Detectado en la verificación de Fase 4; ver hallazgos en la tarea 00010.)
2. **SuperAdministrador no es bypass de servicio**: las validaciones de rol en servicio (p. ej. cancelar taller GV/AEM/CEM) consultan nombres de rol reales; el SuperAdmin no pasa esas validaciones si no tiene el rol. Para E2E se agregó el rol GV temporalmente al usuario de prueba (removido al final).
3. **Transacciones en pruebas**: EF Core 10 InMemory lanza `TransactionIgnoredWarning` como error por defecto al llamar `BeginTransactionAsync`; el harness de pruebas necesita `ConfigureWarnings(Ignore(InMemoryEventId.TransactionIgnoredWarning))`.
4. **Playwright y SSE**: la app mantiene un canal SSE abierto (campana), así que `waitUntil: 'networkidle'` nunca resuelve; usar `domcontentloaded` + esperas por selector.
5. **Sugerencia el día del taller** y **solo transiciones permitidas** validan bien con el usuario correcto: el modal de estado debe abrirse impersonando al EV/EP del taller para ver las opciones.
