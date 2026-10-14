---
fecha_creacion: 2026-10-09 19:20
fecha_modificacion: 2026-10-09 19:20
resumen: Hospitales extraordinarios de Educación Médica — hospitales del catálogo oficial (FOR-002) fuera de la selección autorizada que surgen durante la vigencia se materializan como visita extraordinaria en la versión de rutas activa (Cerrada) y como taller extraordinario en la matriz del mes (individual del equipo + general de la gerencia), sin tocar la selección firmada. Incluye la captura asistida: el Coordinador de Educación Médica puede crear talleres a nombre de un equipo (hospital de la lista de su selección) por si el EV/EP no puede acceder. Buscadores reutilizando el patrón de selección con búsqueda. Scripts 0028 y 0029.
---

# 00011 — Hospitales extraordinarios y captura asistida

## Status

Accepted

> **Aprobado (2026-10-10).** Implementación (scripts 0028/0029 + backend + frontend), pruebas unitarias y verificación E2E completas (visita y taller extraordinarios, captura asistida, hospitales elegibles); documentación y diagramas sincronizados.
>
> **Plan para revisión del usuario.** Depende del ADR-00010 (modo ajuste): la visita extraordinaria se da de alta con ese mecanismo. **No modifica la selección mensual** — invariante del módulo: los documentos firmados no se tocan (ADR-00004: *"la selección es el universo aprobado; las rutas son una capa de planificación posterior"* — referencia interna).

> **Decisiones del usuario (2026-10-09):**
> - El extraordinario vive como **taller + visita en ruta** (no solo taller).
> - Los permisos nuevos son **exclusivos del CEM** (Coordinador de Educación Médica).
> - La captura asistida permite al CEM crear talleres para un **equipo** tomando hospitales de la lista de su selección mensual.

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fases|Fases]]
  - [[#Fase 0 — Decisiones de diseño (el porqué de cada una)|Fase 0 — Decisiones de diseño]]
  - [[#Fase 1 — Base de datos (script 0028)|Fase 1 — Base de datos]]
  - [[#Fase 2 — Backend|Fase 2 — Backend]]
  - [[#Fase 3 — Frontend|Fase 3 — Frontend]]
  - [[#Fase 4 — Verificación y cierre|Fase 4 — Verificación y cierre]]
- [[#Validación contra la operación documentada|Validación contra la operación documentada]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

1. **Hospital extraordinario = hospital del catálogo oficial (FOR-002) que no pertenece a la selección autorizada** y que se visita por un imprevisto durante la vigencia. **No se agrega a la selección** (documento firmado por GV; agregarlo invalidaría la firma o exigiría un addendum).
2. **Visita extraordinaria**: se da de alta en la versión de rutas activa (`Cerrada`) con el modo ajuste del ADR-00010 (`rutas_visitas.id_seleccion_hospital` NULL + `es_extraordinaria = 1`, hospital por `id_hospital` del catálogo). Aparece en calendario, impresión y Mis asignaciones como cualquier visita; los viajes foráneos se clasifican con `hospital_extension.es_zona_metropolitana` (`0/NULL` = foránea). **No tiene estado propio**: gobierna la ruta; cancelarla es un ajuste `BAJA_VISITA`, no una transición.
3. **Taller extraordinario**: `talleres.es_extraordinario = 1` + `motivo_extraordinario`; `id_seleccion_hospital` NULL (la columna ya lo permite). Exige **equipo** (EV+EP): entra a la matriz individual del equipo+mes y a la matriz general de la gerencia+mes, y cuenta para la meta mensual y el ranking como cualquier taller. Sigue la máquina de estados del ADR-00008 (revisión 2026-10-09): **nace `Programado`** (su matriz se cierra como excepción) con historial en `taller_estados_historial`; `EnCurso` manual con sugerencia el día; cancelación por GV/AEM/CEM con motivo.
4. **Captura asistida**: `talleres.puede_capturar_asistida` permite al CEM crear talleres **a nombre de cualquier equipo**, eligiendo el hospital de la lista de la selección de ese equipo (rutas `Cerrada`) — para cuando el EV/EP no puede acceder a la plataforma. Sustituye la validación "ser integrante del equipo" **solo** con ese permiso.
5. **Permisos nuevos** (solo CEM; SuperAdministrador hereda por re-grant):
   - `educacion_medica.talleres.puede_capturar_asistida`
   - `educacion_medica.talleres.puede_capturar_extraordinarios`
   - (Los de ajuste `rutas.puede_ajustar` / `talleres.puede_ajustar` son del ADR-00010; los cuatro se siembran juntos en `0029`.)
6. **UI con buscadores**: hospital y equipo se eligen con el patrón de selección con búsqueda ya usado para usuarios y hospitales (`CatalogoSearchSelect`, Popover + Command). El toggle "Hospital extraordinario" busca contra el catálogo completo (`GET /hospitales?search=`); el modo normal busca en la lista del equipo.
7. **Trazabilidad**: el taller guarda `id_usuario_creacion` (visible como "Capturado por") y los ajustes/altas quedan en `ajustes_post_cierre`; la visita extraordinaria se marca con badge propio en la pantalla de rutas.

## Fases

### Fase 0 — Decisiones de diseño (el porqué de cada una)

1. **No tocar la selección mensual**
   *Por qué:* la selección es el **universo aprobado** y está firmada (GV, ADR-00006). Agregar hospitales a un documento cerrado rompería la semántica de la firma o exigiría un workflow de addendum (costo alto, sin demanda documentada). El extraordinario es un evento de ejecución, no de planeación.
2. **La visita extraordinaria usa el modo ajuste (ADR-00010)**
   *Por qué:* la ruta publicada tampoco se re-genera; el imprevisto se resuelve con el mismo mecanismo auditado (motivo + antes/después + permiso CEM). Reutiliza endpoints, UI y auditoría; cero mecanismos paralelos.
3. **El hospital extraordinario sale del catálogo, no es texto libre**
   *Por qué:* el FOR-002 ya define la base de hospitales considerados para talleres (quirófanos, anestesias, CLUES). Texto libre rompería rankings, cobertura y reportes. El buscador consulta el catálogo existente.
4. **El taller extraordinario exige equipo (EV+EP)**
   *Por qué:* las matrices son por equipo (individual) y por gerencia (general) en ADR-00007; sin equipo el taller no cae en ninguna matriz y no contaría para la meta. El CEM elige el equipo en el momento de la captura.
5. **Captura asistida como permiso separado del extraordinario**
   *Por qué:* son dos capacidades distintas (crear para otro equipo dentro de lo ya planeado vs. crear fuera de la selección). Separar los códigos permite otorgar una sin la otra y deja la matriz rol↔permiso explícita (patrón ADR-00009).
6. **La validación "ser integrante del equipo" se sustituye, no se elimina**
   *Por qué:* para todo usuario sin el permiso, la regla actual sigue intacta (`TalleresService`: solo el EV/EP del equipo captura). Con el permiso, la autorización la da el rol del CEM y queda auditada.
7. **Unicidad de visita por ruta con índice filtrado**
   *Por qué:* `rutas_visitas` tiene `UNIQUE (id_ruta, id_seleccion_hospital)`; al volver NULL-able la columna, un UNIQUE duro permitiría solo **una** visita extraordinaria por ruta (SQL Server trata NULL como duplicado). Se reemplaza por `CREATE UNIQUE INDEX ... WHERE id_seleccion_hospital IS NOT NULL`: conserva la regla para visitas normales y libera a las extraordinarias.
8. **Buscadores con el patrón existente**
   *Por qué:* `CatalogoSearchSelect` (Popover + Command) ya se usa con hospitales en la selección mensual y con usuarios en el módulo; reutilizarlo da búsqueda inmediata sin componente nuevo.

**Supuestos a validar (revisión del usuario):**

| # | Pregunta | Propuesto |
|---|---|---|
| 1 | ¿La visita extraordinaria respeta capacidad (3/día, 8/semana)? | Solo **avisa** (ADR-00010, supuesto 1) |
| 2 | ¿Fecha fuera de vigencia de la selección? | **Sí, con aviso**; sigue sin sábados/domingos |
| 3 | ¿Si el equipo no tiene ruta en la versión activa? | El sistema le **crea la ruta** en la versión (get-or-create) para colgar la visita |
| 4 | ¿Gerencia/mes del taller extraordinario? | Del **equipo elegido** (su matriz individual) y de la **fecha del taller**; CEM elige equipo dentro su alcance |
| 5 | ¿El extraordinario cuenta para la meta mensual (64+64)? | **Sí** (es un taller de la gerencia) |
| 6 | ¿Se permite adjuntar el motivo también como evidencia? | No en v1; el motivo es texto obligatorio |
| 7 | ¿Estado inicial del taller extraordinario? | **`Programado`** (nace después del cierre de la matriz; historial origen Automático — ADR-00008 revisado) |

### Fase 1 — Base de datos (scripts 0028 y 0029)

`lefarma.database/educacion-medica/0028_20261009-1300_educacion-medica_hospitales-extraordinarios.lefarma.sql`, idempotente, transacción única:

1. **`rutas_visitas`**:
   - `ALTER COLUMN id_seleccion_hospital INT NULL`.
   - `DROP CONSTRAINT UQ_rutas_visitas_hospital` + `CREATE UNIQUE INDEX UX_rutas_visitas_hospital ON ... (id_ruta, id_seleccion_hospital) WHERE id_seleccion_hospital IS NOT NULL`.
   - `es_extraordinaria BIT NOT NULL CONSTRAINT DF_rutas_visitas_extraordinaria DEFAULT 0`.
   - Actualizar `MS_Description` de la columna.
2. **`talleres`**:
   - `es_extraordinario BIT NOT NULL CONSTRAINT DF_talleres_extraordinario DEFAULT 0`.
   - `motivo_extraordinario NVARCHAR(500) NULL`.
   - (`id_seleccion_hospital` ya es NULL-able con FK.)
3. Sin cambios en `0016` (instalación limpia se alineará cuando corresponda; script aplica a BD existentes).
4. Sin backfill.

`lefarma.database/educacion-medica/0029_20261009-1400_educacion-medica_seed-permisos-ajustes-extraordinarios.lefarma.sql` (compartido con ADR-00010), idempotente por código:

1. 4 permisos nuevos en `Asokam.app.Permisos`: `rutas.puede_ajustar`, `talleres.puede_ajustar`, `talleres.puede_capturar_asistida`, `talleres.puede_capturar_extraordinarios`.
2. Matriz rol↔permiso: los 4 al rol **Coordinador de Educación Médica** (CEM).
3. Re-grant del SuperAdministrador (patrón `legacy/026`).

### Fase 2 — Backend

1. **Visita extraordinaria (`RutasService` / `RutasController`)**
   - Extender `POST /{idRuta}/visitas` (o endpoint dedicado `POST /{idRuta}/visitas-extraordinarias`) para `{ idHospital, fechaVisita, orden?, motivo }` sin `idSeleccionHospital`; exige `rutas.puede_ajustar` y versión `Cerrada`; get-or-create de la ruta del equipo en la versión si aplica; escribe `ajustes_post_cierre` (`ALTA_VISITA`, marcando `es_extraordinaria`).
   - `GetBySeleccion`/DTOs: resolver nombre del hospital y clasificación foránea vía catálogo/`hospital_extension` cuando `es_extraordinaria`; exponer `esExtraordinaria` al frontend.
   - Impresión (`RutasPrintModal` datos) y asignaciones (`MisAsignacionesPage`) incluyen la visita extraordinaria sin cambios de contrato (mismos DTOs + flag).
2. **Taller extraordinario (`TalleresService`)**
   - `CrearTallerRequest`: modo extraordinario `{ idHospital, idEquipo, motivoExtraordinario, ...logística }` (sin `idSeleccionHospital`); guard `talleres.puede_capturar_extraordinarios`; exige motivo; copia snapshots de catálogo/extension; get-or-create de matrices (individual por equipo+mes, general por gerencia+mes).
   - **Nace en estado `Programado`** (su matriz ya está cerrada o se crea como excepción) con entrada en `taller_estados_historial` (origen Automático); sigue la máquina revisada del ADR-00008.
   - Cuenta en `GetConcentracionAsync`/matriz general igual que los normales; badge de origen en DTO.
3. **Captura asistida (`TalleresService`)**
   - `CrearTallerRequest` con `idEquipo` explícito: con `talleres.puede_capturar_asistida` se omite la validación de integrante del equipo; sin el permiso, `idEquipo` debe coincidir con el equipo del llamante.
   - Nuevo `GET /talleres/hospitales-elegibles?idEquipo=` (permiso asistida): hospitales de la selección del equipo con ruta `Cerrada`, con snapshots para el buscador (reutiliza la consulta de asignaciones pero por equipo elegido).
4. **Permisos**: `[HasPermission]` por endpoint (patrón ADR-00009); validación fina en servicio.
5. **Pruebas unitarias**: alta extraordinaria con/sin permiso; visita extraordinaria en versión `Cerrada` y rechazo en `Creada` sin motivo; índice filtrado (varias extraordinarias por ruta, única normal); captura asistida para otro equipo con permiso y rechazo sin él; matriz creada para el equipo elegido.

### Fase 3 — Frontend

1. **`RutasPage` (modo ajuste del ADR-00010)**: acción **"Visita extraordinaria"** con `CatalogoSearchSelect` de hospitales del catálogo (búsqueda por nombre/ciudad), fecha y motivo; badge "Extraordinaria" en la visita; sin cambios al flujo normal.
2. **`TallerFormModal`**:
   - Hospital: reemplazar el `Select` plano por `CatalogoSearchSelect` (hospitales elegibles del equipo).
   - Selector de **equipo** con búsqueda para la captura asistida (CEM); para EV/EP sigue fijo al propio.
   - Toggle **"Hospital extraordinario"**: buscador contra el catálogo + campo motivo obligatorio + selección de equipo.
   - Mostrar "Capturado por" cuando el usuario no pertenece al equipo.
3. **Matriz y Mis talleres**: badge "Extraordinario" en `MatrizTalleresTable` y en el detalle (`TallerDetalleModal`); filtro si el volumen lo pide.
4. **API/tipos**: `talleres.crear` extendido, `rutas.visitasExtraordinarias`, `talleres.hospitalesElegibles`, campos `esExtraordinario`/`esExtraordinaria`/`capturadoPor`.
5. Guards y menú según permisos (los nuevos solo aplican a acciones dentro de páginas existentes; no hay rutas nuevas).
6. `tsc` + ESLint + build en verde.

### Fase 4 — Verificación y cierre

- E2E: CEM agrega visita extraordinaria a una versión `Cerrada` → aparece en calendario, impresión y Mis asignaciones; CEM crea taller extraordinario → nace `Programado`, cae en matriz individual del equipo y general de la gerencia, y su historial de estados registra la entrada; CEM captura un taller a nombre de otro equipo → el EV/EP lo ve en Mis talleres; EV sin permiso no puede crear para otro equipo ni extraordinario (403).
- Validar supuestos de Fase 0 (capacidad, vigencia, get-or-create, meta mensual).
- Sincronizar `tareas/00011`, `reglas-negocio.md` (sección nueva de extraordinarios) y ER si se documenta el cambio de nulabilidad.
- Marcar `Accepted` al aprobarse.

## Validación contra la operación documentada

| Pieza digital | Fuente | Cita / dato |
|---|---|---|
| El hospital debe existir en la base oficial de hospitales | `Formularios/ASK-CEM-FOR-002 Base de Datos de Hospitales.md` | *"Formato para registrar la base de datos de hospitales del sistema público de salud que serán considerados para los Talleres Médicos en Hospitales."* |
| La visita puede requerir reagenda por imprevisto | `Procesos/Talleres Médicos en Hospitales.md` (nodo P2F) | *"EV: Notifica al GV para que reagende la visita para ofrecer el taller médico."* |
| La agenda registra hospital/lugar y hora por visita | `Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` (campo 6) | *"Lugar y hora: Escribir el nombre del ejecutivo de ventas, hospital o lugar que va a visitar y la hora"* |
| Días no laborables | `Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` | *"Las columnas S y D corresponden a Sábado y Domingo (días no laborables, sin registro de talleres)."* |

**No documentado (interpretación explícita):** la figura de "hospital extraordinario" como tal no aparece en los instructivos ni formatos. Este ADR la define como decisión de digitalización a partir de (a) la reagenda documentada, (b) el catálogo FOR-002 como universo válido de hospitales y (c) la operación real descrita por el usuario (2026-10-09). Queda sujeta a validación de negocio en la revisión de este ADR.

## Consequences

**Positivas**
- La operación cubre imprevistos sin romper documentos firmados: la selección no cambia y la ruta se ajusta de forma auditada.
- El extraordinario entra completo al sistema: visita en calendario/impresión/asignaciones + taller en matriz/meta/ranking, con trazabilidad de quién y por qué.
- La captura asistida elimina el bloqueo operativo cuando el EV/EP no puede acceder, sin abrir la captura a cualquiera (permiso CEM + auditoría).
- Reutiliza componentes existentes (buscadores, modo ajuste, matrices, imprimibles) — sin pantallas nuevas.

**Negativas / neutrales**
- `rutas_visitas.id_seleccion_hospital` pasa a NULL: las consultas que asumían NOT NULL deben manejar el caso extraordinario (revisadas en Fase 2).
- El UNIQUE se reemplaza por índice filtrado: cambio de esquema con DROP/CREATE controlado en script idempotente.
- Si un extraordinario se vuelve recurrente, conviene evaluar en el futuro un addendum de selección (otro ADR); v1 no lo cubre.
- La meta mensual puede superarse con extraordinarios (supuesto 5): si negocio no lo quiere, se excluye del conteo.

**Follow-ups**
- ADR-00010 debe aprobarse antes (mecanismo base de la visita).
- Evaluar en los indicadores si los extraordinarios se reportan por separado (origen) además del total.

## Anexo — Fuentes

**Documentales (referencias del módulo):**
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-002 Base de Datos de Hospitales.md` — catálogo oficial de hospitales.
- `referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales.md` — nodo P2F (reagenda).
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — agenda, lugar y hora.

**Técnicas / relacionadas (no son fuentes documentales):**
- `decisiones/00010_ajustes-post-cierre.md` — mecanismo de ajuste usado por la visita extraordinaria.
- `decisiones/00001_esquema-datos-educacion-medica.md`, `00004` (rutas/selección), `00007` (matrices), `00009` (permisos).
- Código actual: `TalleresService` (validación de integrante del equipo y candados de matriz), `RutasService`/`RutaRepository`, `Taller.cs` (`id_seleccion_hospital` nullable), `RutaVisita.cs`.
- `lefarma.database/educacion-medica/0007_20260827-1210_educacion-medica_create-regiones-rutas.lefarma.sql` — `rutas_visitas` (`UNIQUE` a reemplazar).
- `lefarma.frontend/src/apps/educacion-medica/components/CatalogoSearchSelect.tsx` — patrón de selección con búsqueda; uso previo con hospitales en `SeleccionMensualPage`.
- Scripts propuestos: `0028_20261009-1300_educacion-medica_hospitales-extraordinarios.lefarma.sql` y `0029_20261009-1400_educacion-medica_seed-permisos-ajustes-extraordinarios.lefarma.sql`.
