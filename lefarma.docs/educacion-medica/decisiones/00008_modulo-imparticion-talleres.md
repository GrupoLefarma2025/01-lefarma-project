---
fecha_creacion: 2026-10-07 15:30
fecha_modificacion: 2026-10-10 16:30
resumen: Módulo de Impartición de Talleres de Educación Médica — digitaliza el ciclo posterior a la Matriz autorizada: entrega/recepción de material (FOR-007, IDT-004 §5.8–5.9), registro de asistencia (FOR-008, IDT-005 §5.1–5.2), evidencias fotográficas y la máquina de estados del taller (revisión 2026-10-09: cierre de matriz → Programado automático → EnCurso → Realizado/Cancelado), con historial de transiciones en tabla. Reutiliza las tablas existentes taller_materiales/taller_asistencias/taller_evidencias, elimina taller_aprobaciones (el motor ya registra firmas) y no usa workflow: las transiciones se validan en servicio. UI sobre la pantalla "Mis talleres" con botones por fila que abren modales (y material también desde la Matriz para el AEM). Revisión 2026-10-10: la asistencia ya no guarda firma por asistente — la hoja firmada se sube una sola vez como evidencia.
---

# 00008 — Módulo de Impartición de Talleres

## Status

Accepted

> **Aprobado (2026-10-10).** Implementación (scripts 0023 + backend + frontend), pruebas unitarias y verificación E2E completas; documentación y diagramas sincronizados.
>
> **Plan inicial para revisión del usuario.** Continúa al ADR-00007 (Matriz de Talleres), que dejó explícito: *"Materiales, asistencias, evidencias e impartición quedan fuera de este ADR (tablas ya existen; se digitalizan aparte)"*. No modifica ADRs previos. Decisiones abiertas listadas en Fase 0.9 y en el chat de revisión.

> **Decisión del usuario (2026-10-07):** `taller_aprobaciones` **ya no es necesaria** (la bitácora del motor `config.workflow_bitacora` registra firmas y acciones) → se elimina con script. **No crear pantalla nueva**: reutilizar "Mis talleres" con botones por fila que abren modales para material, asistencias y evidencias.

> **Revisión 2026-10-08 (alineación con los cambios del día, sin cambiar la decisión):**
> - **Estado inicial del taller**: ya no es `Borrador` sino **`Creada`** (mismo renombre que selección/rutas/matriz; la Matriz escribe `Autorizado` al cerrarse). La cancelación de impartición sigue aplicando desde `Autorizado`/`Programado`; borrar el taller sigue disponible mientras la Matriz esté en `Creada`.
> - **Script renumerado `0020` → `0023`**: los números `0021` (permisos/guards, ADR-00009) y `0022` (drop `id_ejecutivo`) ya se crearon; se conserva el orden cronológico.
> - **Permisos con el patrón del ADR-00009**: cada endpoint nuevo lleva `[HasPermission]` (mapa en Fase 2.4); `POST /{id}/estado` se guarda con `talleres.puede_ver` + validación fina de rol/transición en el servicio (un solo endpoint no puede expresar un permiso por transición).
> - **`taller_aprobaciones`**: además del `DROP` en el script, se quita de `0016` para que la instalación limpia ya no la cree.
> - **Imprimibles**: el patrón de `MatrizPrintDocument` evolucionó (portal `print:block` + clase `body.print-*` para orientación, layout de dos bloques FOR-005); los FOR-007/FOR-008 lo reutilizan.
> - **UX "Mis talleres"**: la columna "Estado" hoy muestra el **estado del workflow de la matriz** (no el del taller); los estados de impartición se exponen con la acción por fila (o columna propia), no en esa columna.

> **Decisiones del usuario (2026-10-08):** #2 **firma digital del EV al confirmar material** — con el mismo patrón de la bitácora del motor (firma + fecha + usuario, como en Solicitudes de RH al autorizar/cancelar); #3 **`EnCurso` obligatorio pero sin candado de horario** (no siempre habrá tiempo de marcar Iniciar/Cerrar a tiempo: se puede hacer después); #4 **cancelación por GV y AEM** — se agrega la acción "Cancelar" a esos roles, desde `Autorizado`/`Programado` con motivo; #5 **`Realizado` exige ≥1 evidencia y ≥1 asistencia**, validado en el servicio; #6 **sí, eliminar `taller_aprobaciones`**; #8 **sí, `talleres.fecha_realizado`**.
>
> **Aclaración de captura (2026-10-08):** el papel sigue existiendo — el material se llena/escanea y **se sube como evidencia** además del formulario digital; la lista de asistencia se llena a mano en sitio, se **transcribe al sistema** y se sube **foto de evidencia de la lista firmada**. #1 **`Programado` es un estado manual del AEM, sin workflow** (botón "Programar taller"; queda auditoría de quién/cuándo); #7 **sí, imprimibles pre-llenados FOR-007/FOR-008** (además del escaneo como evidencia). **Decisiones #1–#8: todas resueltas.**

> **Revisión 2026-10-10 (captura de asistencia, decisión del usuario).** Se elimina la firma por asistente: subir la foto/escaneo de la firma de cada médico (hasta 20 por taller) es excesivo por seguridad de datos personales y tiempo de captura. La lista se sigue firmando a mano en sitio; el equipo la **transcribe** (cédula, puesto, contacto, observaciones médico líder +/−) y adjunta **una sola foto/escaneo de la hoja firmada**, guardada como **evidencia del taller** (`taller_evidencias`, tipo `documento`, descripción fija "Hoja de lista de asistencia firmada"). Ajusta la decisión #3 y la aclaración de captura 2026-10-08. Script `0031` elimina `taller_asistencias.firma_url`.

> **Revisión 2026-10-09 (estados operativos post-matriz).** Por decisión del usuario (2026-10-09) se ajustan las decisiones #1, #3 y #4 y se agregan las #9–#13; el resto del ADR no cambia:
> - **`Programado` automático al cerrar la matriz**: el `CERRAR` del DC escribe directo `Programado` en los talleres (historial con origen Automático). `Autorizado` deja de ser estado de reposo. **Supersede la decisión #1** (antes manual del AEM).
> - **`EnCurso` manual con sugerencia**: el usuario lo marca cuando pueda (sin candado de horario); el sistema **sugiere/destaca** la acción el día del taller (`fecha_taller = hoy`). Sin jobs ni scheduler. Ajusta la decisión #3.
> - **Cancelación también por CEM** además de GV/AEM, con motivo, desde `Programado`/`EnCurso`. Ajusta la decisión #4.
> - **Historial de estados** en tabla hija `taller_estados_historial` — no JSON embebido (eventos discretos consultables: quién, cuándo, origen, motivo). Decisión #12.
> - **UI con transiciones permitidas**: el select de estados solo ofrece lo válido por rol y estado. Decisión #13.
> - **Panel de situación del equipo** (decisión #14): KPIs + barra de avance + badges con icono por estado en "Mis talleres" (v1) y reutilización del resumen en el Dashboard de Educación Médica (v2).
> - **Solicitud de cambio del equipo** (con ADR-00010): con el candado puesto o la matriz fuera de captura, "Mis talleres" ofrece **"Solicitar cambio"**; la resolución vive en la **Matriz General** (pendientes arriba con icono), sin bandeja nueva.
> - `Elaborado`/`Revisado` quedan como vocabulario legacy sin uso.

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fases|Fases]]
  - [[#Fase 0 — Decisiones de diseño (el porqué de cada una)|Fase 0 — Decisiones de diseño]]
  - [[#Fase 1 — Base de datos (script 0023)|Fase 1 — Base de datos]]
  - [[#Fase 2 — Backend|Fase 2 — Backend]]
  - [[#Fase 3 — Frontend|Fase 3 — Frontend]]
  - [[#Fase 4 — Verificación y cierre|Fase 4 — Verificación y cierre]]
- [[#Validación contra la operación documentada|Validación contra la operación documentada]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

El ciclo **posterior a la Matriz autorizada** se digitaliza así:

```
Matriz autorizada (talleres en estado Autorizado, ADR-00007)
        │
        │  AEM prepara el paquete y entrega (IDT-004 5.8)
        ▼
Material del taller (FOR-007, 1:1)   EnPreparacion ──entrega──▶ Entregado
        │                                    EV confirma recepción (firma FOR-007)
        ▼
Taller: Autorizado ──▶ Programado ──▶ EnCurso ──▶ Realizado
                          │             │            ▲
                          │             │            └─ asistencias (FOR-008) + evidencias
                          └────────────▶ Cancelado (motivo)
```

1. **Sin workflow nuevo**: la impartición es ejecución, no autorización. La máquina de estados (`talleres.estado`) se valida en servicio (como definió el ADR-00001) y usa los permisos ya sembrados.
2. **Material (FOR-007, `taller_materiales`, 1:1)**: el AEM registra el paquete (producto/cantidad + checklist de 6 ítems + fecha de entrega) y el EV **confirma la recepción con firma digital** (mismo patrón de la bitácora del motor: firma + fecha + usuario, como en Solicitudes de RH al autorizar/cancelar). El papel sigue usándose: se llena el formato de entrega a mano **o** se escanea/fotografía y **se sube como evidencia** al expediente del taller, además del formulario digital (aclaración del usuario 2026-10-08). Regla de entrega del instructivo (CDMX/ZM presencial; foránea 7 días calendario antes) queda como dato (`fecha_entrega`) + aviso informativo, no como candado.
3. **Asistencia (FOR-008, `taller_asistencias`, 1:N máx. 20)**: la lista **se llena a mano en sitio**; después el equipo la **transcribe al sistema** (cédula, puesto, contacto, observaciones médico líder +/−) y adjunta **una sola foto/escaneo de la hoja firmada** como evidencia del taller (revisión 2026-10-10; se elimina `firma_url` por asistente). CHECK 1–20 ya existe en BD.
4. **Evidencias (`taller_evidencias`, 1:N)**: fotos/videos/documentos con `archivo_url` del servicio de archivos existente; se capturan desde que el taller está EnCurso.
5. **UI sin pantalla nueva**: botones por fila en `MisTalleresPage` que abren modales (Material, Asistencia, Evidencias, Estado). El **AEM gestiona el material desde `MatrizTalleresPage`** (no pertenece a un equipo de pareo y no ve "Mis talleres"). Lectura de asistencias/evidencias para AEM/GV/CA/DC/CQ.
6. **`taller_aprobaciones` se elimina** (script 0023): el log Elaboró/Revisó/Autorizó por taller es redundante con la bitácora del motor; no hay datos en operación.
7. **Imprimibles (decisión 7 ✔)**: FOR-007 (acuse de material) y FOR-008 (lista de asistencia) **pre-llenados** con los datos del taller, reutilizando el patrón actualizado de `MatrizPrintDocument`; el papel firmado/escaneado se sigue subiendo como evidencia.
8. **Estados operativos post-matriz (revisión 2026-10-09)**: al cerrar la matriz (DC `CERRAR`) los talleres pasan **automáticamente a `Programado`**; `EnCurso` lo marca el usuario con **sugerencia** el día del taller; `Realizado` exige ≥1 evidencia y ≥1 asistencia; `Cancelado` (GV/AEM/CEM) exige motivo y aplica desde `Programado`/`EnCurso`. **Cada transición se registra en `taller_estados_historial`** (origen Automático/Manual, motivo, usuario, fecha) y la UI solo ofrece transiciones permitidas por rol/estado.
9. **Panel de situación del equipo (revisión 2026-10-09)**: "Mis talleres" muestra un panel con KPIs del mes (total, Programados, En curso, Realizados, Cancelados), barra de avance `Realizados/Total` y badges con icono por estado; el modal de estado incluye un **stepper** del taller. La v2 reutiliza el resumen en el Dashboard del módulo (hoy stub). La Matriz General (GV/CEM) muestra el panorama por taller/equipo con las **solicitudes de cambio pendientes arriba** (ADR-00010).

## Fases

### Fase 0 — Decisiones de diseño (el porqué de cada una)

1. **Reutilizar "Mis talleres" con modales (no pantalla nueva)**
   *Por qué:* el equipo EV+EP ya trabaja ahí durante la captura de la Matriz; la impartición es la continuación natural del mismo taller y evita una pantalla más que mantener. Decisión del usuario (2026-10-07).
2. **Sin motor de workflow para la impartición**
   *Por qué:* el motor existe para **autorizar documentos** (Matriz: GV→AEM→CA→DC). La impartición es **ejecución operativa** con evidencia; un workflow añadiría pasos y participantes sin valor. La cadena de estados se valida en servicio (precedente del ADR-00001: *"el state machine se valida en servicio"*).
3. **Material 1:1 por taller y confirmación del EV**
   *Por qué:* el papel firma **un FOR-007 por entrega de taller** (Anexo 2 IDT-004, lista de hasta 8 renglones); el ADR-00001 ya decidió 1:1 con `UNIQUE (id_taller)`. La recepción la firma el EV (IDT-004 §5.9: *"firma de recibido en formato ASK-CEM-FOR-007"*).
4. **Estados y transiciones en servicio** (revisado 2026-10-09):
   - **Cierre de matriz → `Programado`** (**automático**: el `CERRAR` del DC escribe `Programado` directo con historial origen Automático — decisión 9 ✔; supersede el "estado manual del AEM" de la decisión 1).
   - `Programado → EnCurso` (EP/EV; **obligatorio pero sin candado de horario**: pueden marcarlo cuando puedan, con **sugerencia** cuando `fecha_taller = hoy` — decisión 10 ✔).
   - `EnCurso → Realizado` (EP/EV, al cerrar; **exige ≥1 evidencia y ≥1 asistencia**, validado en el servicio — decisión 5 ✔).
   - `Programado/EnCurso → Cancelado` (acción "Cancelar" para **GV, AEM y CEM**, motivo obligatorio — decisión 11 ✔; borrar el taller sigue disponible mientras la Matriz esté en `Creada`).
   - **Historial**: cada transición se registra en `educacion_medica.taller_estados_historial` (`estado_anterior`, `estado_nuevo`, `origen` Automático/Manual, `motivo`, `id_usuario`, `fecha`) — decisión 12 ✔.
   *Por qué:* refleja el flujo real (material → taller → cierre) y alimenta `cobertura_taller` del ranking, que lee `estado = 'Realizado'` por hospital. El historial da trazabilidad operativa sin depender del motor (que solo autoriza).
5. **Asistencias y evidencias viven en sus tablas existentes**
   *Por qué:* ya modelan el FOR-008 y las fotos del cierre (IDT-005 §5.2.2: *"Toma fotografías del taller como evidencia"*); no requieren cambios de esquema (solo `archivo_url` vía servicio de archivos; la hoja firmada de asistencia es una evidencia más — revisión 2026-10-10).
6. **`taller_aprobaciones` se elimina**
   *Por qué:* decisión del usuario; la bitácora del motor cubre las firmas con más información (usuario, comentario, snapshot, firma digital). Sin datos en operación.
7. **AEM gestiona material desde la Matriz, EV confirma desde "Mis talleres"**
   *Por qué:* el AEM no pertenece a un equipo de pareo; su unidad de trabajo es la matriz general. El EV recibe físicamente el material y firma (IDT-004 §5.9).
8. **Archivos con el servicio existente**
   *Por qué:* `/api/archivos` ya resuelve subida/listado/borrado por `EntidadTipo`; se agrega `TallerEvidencia` (fotos/documentos, incluida la hoja firmada de asistencia) con su carpeta, sin almacenamiento propio (revisión 2026-10-10: se retira `TallerAsistencia` para firmas).
9. **Historial de estados en tabla hija (no JSON embebido)** (revisión 2026-10-09)
   *Por qué:* un historial son **eventos discretos** que se consultan ("cancelaciones con motivo", "quién inició el taller"); un JSON embebido no se indexa ni se filtra sin parsear y se reescribe completo en cada transición. La tabla espeja el patrón de `ajustes_post_cierre` (ADR-00010) y deja `talleres.estado` como estado actual (decisiones 12 y 13 ✔). Si se requieren datos extra, un `datos_json` opcional absorbe el crecimiento sin migrar esquema.
10. **Panel de situación del equipo** (revisión 2026-10-09)
    *Por qué:* el equipo EV/EP vive en "Mis talleres" y su adopción depende de ver avance; el área busca que el equipo se motive y venda más, y los datos ya existen en `MisTalleresResponse` (sin backend nuevo en v1). El Dashboard del módulo (hoy stub) reutiliza el mismo resumen en v2 sin duplicar lógica.

**0.9 Decisiones del usuario:**

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿`Programado` automático al confirmar el material, o manual del AEM? | **Automático al cerrar la matriz (revisado 2026-10-09)**: el `CERRAR` del DC escribe `Programado` directo (historial origen Automático); antes manual del AEM (2026-10-08) |
| 2 | ¿Firma digital del EV al confirmar material? | **Sí (2026-10-08)**: `firma_url`, `fecha_recepcion`, `id_usuario_recepcion` en `taller_materiales` (script 0023), con el patrón de la bitácora del motor (firma + fecha + usuario) |
| 3 | ¿`EnCurso` obligatorio o se puede saltar a `Realizado`? | **Obligatorio sin candado de horario (2026-10-08) + sugerencia el día del taller (revisado 2026-10-09)**: se marca cuando puedan, incluso después; el sistema destaca la acción cuando `fecha_taller = hoy` |
| 4 | ¿Quién cancela y desde qué estados? | **GV + AEM + CEM (revisado 2026-10-09)**: acción "Cancelar" con motivo obligatorio desde `Programado`/`EnCurso`; borrar el taller sigue disponible mientras la Matriz esté en `Creada` |
| 5 | ¿`Realizado` exige asistencias? | **Sí (2026-10-08)**: ≥1 evidencia **y** ≥1 asistencia, validado en el servicio |
| 6 | ¿Eliminar `taller_aprobaciones`? | **Sí (2026-10-07)**: DROP en script 0023 + quitarla de `0016` (instalación limpia) |
| 7 | ¿Imprimibles FOR-007/FOR-008 en este módulo? | **Sí, pre-llenados (2026-10-08)**: FOR-007 (acuse de material) y FOR-008 (lista de asistencia) con los datos del taller, además del escaneo/evidencia del papel |
| 8 | ¿Fecha de realización para indicadores? | **Sí (2026-10-08)**: `fecha_realizado DATE NULL` en `talleres` (script 0023) |
| 9 | ¿Cuándo pasa a `Programado`? | **Automático al cerrar la matriz (2026-10-09)**: lo escribe `MatrizTalleresService` en el `CERRAR` del DC, con historial origen Automático |
| 10 | ¿`EnCurso` automático? | **Manual con sugerencia (2026-10-09)**: sin jobs/scheduler; el botón se destaca el día del taller |
| 11 | ¿Quién cancela tras el cierre? | **GV + AEM + CEM (2026-10-09)**, con motivo, desde `Programado`/`EnCurso` |
| 12 | ¿Historial de estados? | **Tabla hija `taller_estados_historial` (2026-10-09)**, no JSON embebido: eventos consultables con origen, motivo y usuario |
| 13 | ¿Select libre de estados? | **Solo transiciones permitidas (2026-10-09)**: la UI ofrece lo válido por rol/estado |
| 14 | ¿Panel de situación del equipo? | **Sí (2026-10-09)**: v1 en "Mis talleres" (KPIs + barra de avance + badges con icono + stepper); v2 en el Dashboard del módulo |

**Estado (2026-10-09):** **decisiones #1–#14 resueltas.** Los cambios del 2026-10-08 (permisos/guards del ADR-00009, renombre `Borrador`→`Creada`, nuevo patrón de imprimibles) solo ajustan la implementación (nota de revisión arriba); la revisión 2026-10-09 ajusta los disparadores de estado, agrega el historial y el panel de situación.

### Fase 1 — Base de datos (script 0023)

`lefarma.database/educacion-medica/0023_20261008-1000_educacion-medica_imparticion-talleres.lefarma.sql`, idempotente, transacción única:

1. **DROP `educacion_medica.taller_aprobaciones`** (guardado con `IF EXISTS`; sin datos en operación). Decisión del usuario (2026-10-07). Además, **quitar la tabla de `0016`** (instalación limpia ya no la crea; el DROP aplica a BD existentes).
2. **`taller_materiales`**: columnas `firma_url NVARCHAR(500) NULL`, `fecha_recepcion DATETIME2 NULL`, `id_usuario_recepcion INT NULL` (fidelidad del FOR-007 digital; decisión 2 ✔ 2026-10-08).
3. **`talleres`**: columna `fecha_realizado DATE NULL` (indicadores; decisión 8 ✔ 2026-10-08). Los talleres de una matriz cerrada pasan a `Programado` (revisión 2026-10-09); no requiere columna nueva (la máquina vive en `estado`).
4. **`taller_estados_historial` (nueva, revisión 2026-10-09 — decisión 12 ✔)**: `id_historial INT IDENTITY PK`, `id_taller INT NOT NULL` (FK física → `talleres`), `estado_anterior VARCHAR(15) NULL`, `estado_nuevo VARCHAR(15) NOT NULL`, `origen VARCHAR(12) NOT NULL` CHECK (`Automatico`|`Manual`), `motivo NVARCHAR(500) NULL`, `id_usuario INT NULL`, `fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME()`, `datos_json NVARCHAR(MAX) NULL`; índice `IX_taller_estados_historial_taller (id_taller, fecha)`; `MS_Description` (tabla y columnas).
5. `MS_Description` de lo agregado; nada más cambia (asistencias/evidencias ya tienen todo).
6. Sin backfill (no hay talleres en operación).

### Fase 2 — Backend

1. **Entidades + EF**: `TallerMaterial` (1:1), `TallerAsistencia` (1:N), `TallerEvidencia` (1:N) + configuraciones + DbSets (las tablas ya existen).
2. **`TallerImparticionService`** (`api/educacion-medica/talleres`, se extiende el controlador existente; cada endpoint con `[HasPermission]`, mapa en el punto 4):
   - `GET/PUT /{id}/material` (AEM) + `POST /{id}/material/confirmar` (EV; estampa firma + fecha + usuario, patrón bitácora — decisión 2).
   - `GET/POST/PUT/DELETE /{id}/asistencias` (EV/EP; máx. 20; transcripción de la lista; la hoja firmada se adjunta como evidencia — revisión 2026-10-10).
   - `GET/POST/DELETE /{id}/evidencias` (EV/EP desde `EnCurso`).
   - `POST /{id}/estado` `{nuevoEstado, motivo?}` (máquina de estados en servicio; permisos por rol).
   - `GET /{id}/documento-material` y `GET /{id}/documento-asistencia` (imprimibles).
3. **Máquina de estados** (revisión 2026-10-09 — decisiones 9/10/11/12/13 ✔): validación de transiciones permitidas + rol autorizado; el cierre de matriz escribe `Programado` (automático, historial origen Automático); `EnCurso` obligatorio **sin candado de horario** (sugerido el día del taller); `Realizado` exige **≥1 evidencia y ≥1 asistencia**; `Cancelado` exige motivo y lo ejecutan **GV/AEM/CEM** desde `Programado`/`EnCurso`; escribe `fecha_realizado` (decisión 8 ✔) y **cada transición registra `taller_estados_historial`** (origen, motivo, usuario, fecha). Nuevo `GET /{id}/estados` (historial; permiso `talleres.puede_ver`).
4. **Permisos (patrón ADR-00009)**: los códigos ya sembrados, por endpoint — `GET /{id}/material` y documentos → `talleres.puede_ver`; registrar/editar entrega (AEM) → `materiales.puede_gestionar`; confirmar recepción (EV) → `materiales.puede_confirmar`; asistencias (EV/EP) → `talleres.puede_capturar`; evidencias → `evidencias.puede_gestionar`. **`POST /{id}/estado` → `talleres.puede_ver` + validación fina de rol/transición en el servicio** (una sola acción con permisos distintos por transición; mismo principio que "firmar" en ADR-00009). Sin permisos nuevos.
5. **Archivos**: `ENTIDAD_ARCHIVOS` backend/frontend += `TallerAsistencia` (carpeta `educacion-medica-asistencias`) y `TallerEvidencia` (carpeta `educacion-medica-evidencias`).
6. **Pruebas**: servicio (transiciones válidas/ inválidas, límite 20, 1:1 material, confirmación EV, candado de evidencias), integración con archivos.

### Fase 3 — Frontend

1. **API/tipos**: `talleres.material.*`, `talleres.asistencias.*`, `talleres.evidencias.*`, `talleres.cambiarEstado` + DTOs.
2. **`MisTalleresPage`** (sin pantalla nueva): por fila, botones que abren modales — **Material** (ver/confirmar recepción), **Asistencia** (tabla 1–20 con firma), **Evidencias** (subir/listar), **Estado** (select con **solo las transiciones permitidas** por rol/estado — decisión 13 ✔; sugerencia de Iniciar el día del taller; Cancelar con motivo) e **Historial de estados** (decisiones 12 ✔). Modo lectura cuando el rol no puede capturar.
3. **Panel de situación del equipo** (decisión 14 ✔): en `MisTalleresPage`, fila de KPIs del mes (Total, Programados, En curso, Realizados, Cancelados) + barra de avance `Realizados/Total` (componente `Progress`, patrón de RH) + badges con icono y color por estado en la tabla (lucide: `CalendarClock` Programado, `PlayCircle` EnCurso, `CheckCircle2` Realizado, `XCircle` Cancelado) + **stepper** del taller en el modal de estado. En `MatrizTalleresPage`, panorama de estados por taller/equipo con **solicitudes de cambio pendientes arriba con icono** (ADR-00010). v2: reutilizar el resumen en `EducacionMedicaDashboard` cuando exista el endpoint de resumen.
4. **`MatrizTalleresPage`**: acción por taller para el AEM — **Material** (crear/editar entrega) y lectura de asistencias/evidencias.
5. **Imprimibles**: `MaterialPrintDocument` (FOR-007) y `AsistenciaPrintDocument` (FOR-008) con el patrón de `MatrizPrintDocument`.
6. `pnpm run build` y ESLint en verde.

### Fase 4 — Verificación y cierre

- E2E: Matriz cerrada (DC `CERRAR`) → talleres pasan **automáticamente a `Programado`** → AEM registra material → EV confirma (firma digital) → EP inicia (`EnCurso`, sugerido el día del taller) → asistencias + evidencias → cierra (`Realizado`; exige ≥1 evidencia y ≥1 asistencia) → `cobertura_taller` del ranking refleja el taller; cancelación con motivo por GV/AEM/CEM; **historial de estados completo por taller** (origen, usuario, motivo).
- Verificar que cada transición quedó en `taller_estados_historial` y que la UI solo ofrece transiciones permitidas por rol/estado.
- Sincronizar `tareas/00008`, `reglas-negocio.md` (nueva §5.12 "Impartición de talleres (digital)" y §6 modelo) y los diagramas nuevos (`000008_*`), sin tocar los históricos.
- Registrar lecciones.

## Validación contra la operación documentada

| Paso digital | Fuente | Cita / dato |
|---|---|---|
| Paquete de material y entrega (CDMX/foránea) | `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` (IDT-004) §5.8 | *"Forma paquetes conformados de la siguiente manera: 1. Producto · 2. Folletos · 3. Registro de asistencia · 4. Dulces · 5. Computadora y/o proyector en caso de aplicar. … Foránea: … envía los paquetes 7 días calendario antes del Taller Médico."* |
| Recepción y firma del EV (FOR-007) | IDT-004 §5.9 | *"Recibe el material y revisa: 1. Cantidad y condiciones… Si todo está bien, firma de recibido en formato ASK-CEM-FOR-007 'Material para talleres médicos' y lo entrega al Auxiliar Administrativo de Educación Médica."* |
| Checklist del FOR-007 | `Formularios/ASK-CEM-FOR-007 Material para Talleres Médicos.md` (Anexo 2 IDT-004) | Columnas: *"Fecha · Hospital · Cargo / Puesto · Nombre del Producto · Cantidad de Producto · Lista de asistencia · Flayers · Equipo de cómputo · Proyector · Dulces · Modelo anatómico · Observaciones"* + *"Nombre y Firma del Ejecutivo que recibe"* |
| Registro de asistencia el día del taller | `Instructivos/Impartición de Talleres Médicos.md` (IDT-005) §5.1.6–5.1.7 | *"EP: Recibe y da la bienvenida a los participantes… solicita que se registren en el formato 'Registro de asistencia'. … EV: Entrega el box lunch… Revisa que el número de asistentes registrados… coincida con el número de asistentes en la sala."* |
| Evidencias fotográficas al cierre | IDT-005 §5.2.2 | *"EV: Recoge y resguarda el equipo y materiales… Toma fotografías del taller como evidencia y las envía por correo electrónico al Auxiliar Administrativo de Educación Médica, anexando el 'Registro de Asistencia'."* |
| Lista de asistentes (campos) | `Formularios/ASK-CEM-FOR-008 Registro de Asistencia.md` (Anexo 1 IDT-005) | *"No. · Nombre · Puesto · Teléfono celular · Correo electrónico · Firma"* (encabezado: Fecha, Hora inicio, Hora fin, Tema, Nombre del Especialista) |
| Eliminación de `taller_aprobaciones` | ADR-00007 §Decisión 1 + decisión del usuario | El log de papel *"Elaboró/Revisó/Autorizó"* por taller queda cubierto por `config.workflow_bitacora` (motor); sin datos en operación |

**Decisiones de digitalización (interpretación, no cita):** modales sobre "Mis talleres"; sin workflow para impartición; `Programado` **automático al cerrar la matriz** (sin workflow) y `EnCurso` manual con sugerencia (revisión 2026-10-09); confirmación de material con firma digital del perfil (patrón bitácora: firma + fecha + usuario); `EnCurso` obligatorio sin candado de horario; `Realizado` exige ≥1 evidencia y ≥1 asistencia (validado en servicio); cancelación con motivo por **GV/AEM/CEM**; `fecha_realizado` al cierre; **historial de transiciones** en `taller_estados_historial`; imprimibles **pre-llenados** FOR-007/FOR-008 además del escaneo como evidencia. **Decisiones #1–#13 resueltas (revisión 2026-10-09).**

## Consequences

**Positivas**
- Cierra el ciclo del taller de punta a punta: captura → matriz → autorización → material → impartición → evidencias, con trazabilidad por usuario.
- Sin pantallas nuevas ni motor nuevo: reutiliza "Mis talleres", permisos, servicio de archivos y el patrón de imprimibles ya construidos.
- `Realizado` alimenta el ranking (`cobertura_taller`) y habilita los indicadores de asistencia.
- Elimina una tabla muerta (`taller_aprobaciones`) y consolida el registro de firmas en el motor.
- **Revisión 2026-10-09**: `Programado` automático elimina un paso manual y el historial (`taller_estados_historial`) da trazabilidad operativa completa (quién, cuándo, origen y motivo) sin depender del motor.
- **Panel de situación** (decisión 14): el equipo ve su avance del mes en "Mis talleres" (KPIs, barra de avance, estados con icono), lo que apoya la adopción y la motivación comercial del área; se reutiliza en el Dashboard en v2 sin lógica nueva.

**Negativas**
- La confirmación de material con firma digital agrega 3 columnas y un paso de UI (decisión 2 ✔); es el precio de la fidelidad del FOR-007.
- Los modales en una tabla densa pueden crecer en complejidad (asistencia 1–20); se mitiga con componentes por modal.
- El cierre de matriz escribe `Programado` directo (revisión 2026-10-09): se pierde el reposo `Autorizado`; si negocio necesita distinguirlo, se revierte el disparador sin cambiar el modelo.

**Neutras**
- La regla "7 días antes" (foránea) queda como aviso informativo, no como candado (igual que el ADR-00007 con el paso AEM).
- CQ/Tecnovigilancia quedan como lectura al cierre (sin pantalla propia).
- El select de estados ofrece solo transiciones válidas (sin edición libre) — menos flexible, a prueba de errores (decisión 13).

## Anexo — Fuentes

- `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` (ASK-CEM-IDT-004 v01) — §5.8, §5.9, Anexo 2 (FOR-007).
- `Instructivos/Impartición de Talleres Médicos.md` (ASK-CEM-IDT-005 v01) — §5.1, §5.2, Anexo 1 (FOR-008).
- `Formularios/ASK-CEM-FOR-007 Material para Talleres Médicos.md` — checklist y firma de recibido.
- `Formularios/ASK-CEM-FOR-008 Registro de Asistencia.md` — lista de asistentes.
- `decisiones/00001_esquema-datos-educacion-medica.md` — §1.2.8–1.2.11 (tablas `taller_materiales`/`asistencias`/`evidencias`), §2.1 "Talleres (Slice 2 - proceso core)" (endpoints propuestos `GET/PUT /talleres/{id}/materiales`, `GET/POST/DELETE /talleres/{id}/asistencias`, `GET/POST/DELETE /talleres/{id}/evidencias`), §3.2 (permisos).
- `decisiones/00007_modulo-matriz-talleres.md` — estados del taller y exclusión explícita de impartición.
- `reglas-negocio.md` — §4.4 (pasos posteriores), §5.9 (materiales), tabla FOR-007/FOR-008.
- `presentacion-proceso.md` — §4.5 (material) y cierre del taller (fotos + asistencia).
- `lefarma.database/educacion-medica/0003_20260806-1556_...sql` — DDL de las tablas hijas.
