---
fecha_creacion: 2026-10-23 10:00
fecha_modificacion: 2026-10-23 10:00
resumen: Define el candado por taller después de autorizada la matriz y el canal de solicitudes de cambio. La selección y la matriz conservan su autorización; la ruta es un draft sin workflow. Una vez autorizada la matriz, cada taller queda bloqueado y cualquier cambio se pide por taller (fecha, hora, hospital, participantes, producto/cantidades), se aprueba/rechaza por el autorizador y se aplica con auditoría y recálculo de totales, sin desbloquear la matriz completa. Los cambios estructurales generan nueva versión de matriz y reautorización.
---

# ADR-00018 — Candado por taller y solicitudes de cambio de matriz

## Status

Proposed

> **Decisiones confirmadas por el usuario (2026-10-23):**
> - Se autoriza la **selección** y la **matriz**; la ruta es **draft sin workflow**.
> - El candado simple es **por taller**.
> - La matriz cerrada puede tener cambios; se actualiza **por solicitud de taller**.
> - El “enviar a autorización” es un candado que se bloquea/desbloquea, no un flujo nuevo por cada cambio.
>
> Depende de ADR-00006 (workflow), ADR-00007 (matriz), ADR-00010 (ajustes/solicitudes), ADR-00015 (ruta por especialista) y ADR-00017 (tercera gerencia).

## Índice

1. [Decisión](#decisión)
2. [Contexto](#contexto)
3. [Estados y candados](#estados-y-candados)
4. [Flujo de solicitud de cambio](#flujo-de-solicitud-de-cambio)
5. [Matriz y totales](#matriz-y-totales)
6. [Cambios estructurales](#cambios-estructurales)
7. [Base de datos y parámetros](#base-de-datos-y-parámetros)
8. [Backend y frontend](#backend-y-frontend)
9. [Fases](#fases)
10. [Validación contra la operación documentada](#validación-contra-la-operación-documentada)
11. [Consequences](#consequences)
12. [Anexo — Fuentes](#anexo--fuentes)

## Decisión

1. **La selección conserva su autorización** (`Creada → EnRevision → Cerrada`; GG→GV), sin cambios.
2. **La matriz conserva su autorización** (`MatrizGeneral` por gerencia/mes; cadena GV → AEM costos → CA → DC, configurable). La matriz es el documento que autoriza los talleres y sus costos.
3. **La ruta/calendario es un draft versionado sin workflow.** No se firma, no se cierra y no tiene bandeja de aprobación. Su versión (`rutas_versiones`) se conserva para histórico y para “regenerar”.
4. **Después de autorizada la matriz, cada taller queda bloqueado.** El bloqueo se deriva de:
   - `MatrizGeneral` en estado final/autorizado, y
   - `talleres.estado` distinto de `Creada`.
   No se agrega un flag nuevo si no hace falta; la UI muestra `bloqueado = true` en el DTO.
5. **Cualquier cambio posterior se pide por taller** mediante `taller_solicitudes_cambio` (tabla existente de ADR-00010):
   - El ejecutivo/equipo (o el CEM con captura asistida) crea la solicitud con el diff en `datos_json` y un motivo.
   - El autorizador de la matriz (GV/CA/DC según configuración) aprueba o rechaza.
   - Al aprobar: se aplica el cambio, se actualiza la fila de la matriz, se recalculan totales, se registra en `ajustes_post_cierre` y se vuelve a bloquear el taller.
   - Al rechazar: no se aplica nada; se registra el motivo y se notifica al solicitante.
6. **No se desbloquea la matriz completa.** El candado es por taller; la matriz sigue autorizada. Si el cambio es estructural, se genera una nueva versión de matriz y se reautoriza (ver §6).
7. **La solicitud no reabre el workflow de la matriz.** La matriz conserva su estado y su historial; el cambio queda como evento auditado (mismo principio de ADR-00010: “ajuste ≠ reapertura”).
8. **El botón “Enviar a autorización”** de la pantalla de planeación opera sobre la matriz del período/gerencia, no sobre el draft de rutas. Si la matriz ya está autorizada, el botón cambia a “Solicitar cambio” por taller.

## Contexto

Hoy conviven tres mecanismos:

- **Workflow de selección** (ADR-00006): GG→GV, cierra la selección.
- **Workflow de rutas** (ADR-00006): GV→CA→DC, cierra la versión de rutas. Este ADR lo retira: la ruta es draft.
- **Workflow de matriz** (ADR-00006/00007): GV→AEM costos→CA→DC, cierra la matriz y programa los talleres.
- **Ajustes post-cierre + solicitudes de cambio** (ADR-00010): cambios de fecha/hora/lugar/participantes y solicitudes del equipo cuando el candado está puesto.

El usuario quiere:

- Que la ruta no tenga otro flujo.
- Que la matriz siga siendo el documento autorizado.
- Que el candado simple sea por taller.
- Que un cambio de taller se pida y se apruebe, como ya se hace con “Solicitar cambio”.

El problema es que el mecanismo actual de `taller_solicitudes_cambio` está pensado para cambios de campos del taller, no para actualizar la matriz y sus totales. Hay que extenderlo sin crear otro flujo.

## Estados y candados

| Documento | Entidad | Estado | Candado |
|---|---|---|---|
| Selección | `selecciones_mensuales` | `Creada/EnRevision/Cerrada/Rechazada/Cancelada` | Cerrada = no editable; cambios = nueva selección/addendum (fuera de este ADR) |
| Ruta/calendario | `rutas_versiones` + `rutas` | `Creada` (borrador) / `Archivada` | Draft editable; no hay firma. Al autorizar la matriz, el calendario queda como referencia; los cambios se hacen por taller |
| Matriz | `matrices_generales` | Estado del motor (workflow) | Autorizada = matriz cerrada; los talleres quedan bloqueados |
| Taller | `talleres` | `Creada/Programado/EnCurso/Realizado/Cancelado` | `Creada` = editable; `Programado`+ = bloqueado para edición directa; cambio solo por solicitud |

**Regla de UI:** si `bloqueado = true`, el botón “Editar” desaparece y aparece “Solicitar cambio”. El inspector muestra el candado y el motivo.

## Flujo de solicitud de cambio

```text
Taller autorizado (matriz cerrada)
        │
        ├── Usuario con permiso abre "Solicitar cambio"
        │      ├── elige campos (fecha, hora, hospital, participantes, producto/cantidad)
        │      ├── escribe motivo
        │      └── envía → taller_solicitudes_cambio (Pendiente)
        │
        ├── Autorizador ve la solicitud en Matriz General / Inspector
        │      ├── Aprueba → aplica cambio + actualiza matriz + recalcula totales + auditoría + notifica
        │      └── Rechaza → registra motivo + notifica
        │
        └── Taller sigue bloqueado; la matriz sigue autorizada
```

### Quién puede solicitar

- Integrante del equipo del taller (ejecutivo/especialista) con `talleres.puede_solicitar_cambio`.
- CEM con captura asistida (`talleres.puede_capturar_asistida`) para cualquier equipo.
- AEM/CA si el cambio es de costos/cantidades y tiene el permiso correspondiente (a definir).

### Quién resuelve

- El autorizador de la matriz (participante del paso final del workflow: DC por default; configurable).
- Alternativa: GV/CA si el área quiere resolver cambios menores sin llegar a DC. Se configura en el workflow/permisos.
- La resolución se hace desde la **Matriz General** (pendientes arriba con icono), como en ADR-00010; no se crea una bandeja nueva.

### Contenido de la solicitud

- `id_taller`, `estado`, auditoría.
- `datos_json`:
  - `campos`: `{ fecha, hora, hospital, participantes, producto, cantidad, ... }`
  - `antes` / `despues`
  - `motivo`
  - `solicitante`
  - `origen`: `CALENDARIO` | `MIS_TALLERES` | `MATRIZ`
- No se guardan columnas por campo; el diff vive en JSON (patrón ADR-00010).

### Notificaciones

- In-app (campana/SSE) al autorizador al crear.
- In-app al solicitante al resolver.
- Correo opcional (hoy deshabilitado temporalmente en ADR-00010; se puede reactivar).

## Matriz y totales

- La matriz se compone de talleres + recursos (producto, folletos, envío, box lunch).
- Al aprobar una solicitud:
  1. Se aplica el cambio en `talleres`/`taller_recursos`.
  2. Se recalcula el costo del taller (`Σ cantidad × costo unitario`).
  3. Se recalcula el total de la matriz (por gerencia/mes) en lectura o se persiste si la matriz guarda snapshot.
  4. Se registra el antes/después en `ajustes_post_cierre` (`EDITAR_TALLER` o `EDITAR_MATRIZ`).
  5. Se actualiza `fecha_modificacion` y el usuario.
- La matriz conserva su estado autorizado; no se reabre el workflow.
- Si la matriz guarda un total persistido, agregar columnas de total/última actualización; si no, recalcular en consulta. La decisión técnica se toma en la tarea 00018.

### Cambios de costo

- Si el cambio altera costos, el autorizador debe ver el delta (antes/después) y el nuevo total de la matriz.
- Si el delta supera un umbral configurable, se puede exigir una reautorización de la matriz (parámetro `umbral_cambio_costo_reautorizacion`, opcional). Default: sin umbral; se aprueba por taller.

## Cambios estructurales

Se consideran estructurales y **no** se resuelven por solicitud de taller:

- Agregar un hospital que no está en la selección (fuera del alcance de extraordinario).
- Cambiar de gerencia o de matriz.
- Cambiar el período/mes.
- Reabrir la selección.
- Cancelar la matriz completa.

En esos casos:

1. Se genera una nueva versión de matriz (o se cancela y regenera).
2. Se reautoriza por el workflow.
3. Se conserva la versión anterior para histórico/auditoría.

> La visita/taller extraordinario **sí** puede resolverse por el canal de taller si el alcance parametrizado lo permite (ADR-00017); no se considera estructural si el hospital está dentro del alcance.

## Base de datos y parámetros

### Tablas existentes que se reutilizan

- `educacion_medica.taller_solicitudes_cambio` (ADR-00010): `id_solicitud`, `id_taller`, `estado` (`Pendiente/Aprobada/Rechazada/Cancelada`), `datos_json`, auditoría.
- `educacion_medica.ajustes_post_cierre` (ADR-00010): `EDITAR_TALLER`, `CANCELAR_VERSION`, etc.
- `educacion_medica.matrices_generales` y `matrices_individuales` (ADR-00007).

### Cambios propuestos

| Cambio | Por qué |
|---|---|
| `taller_solicitudes_cambio.id_matriz_general INT NULL` | Trazabilidad directa de la solicitud con la matriz; opcional si se resuelve por join. |
| `taller_solicitudes_cambio.tipo_solicitud VARCHAR(30)` | `CAMBIO_TALLER`, `CANCELAR_TALLER`, `EXTRAORDINARIO`, `CAMBIO_COSTO`; permite reportes. |
| `matrices_generales.fecha_ultima_actualizacion DATETIME2 NULL` | Saber cuándo cambió la matriz sin reabrir workflow. |
| `matrices_generales.total_actualizado DECIMAL(18,2) NULL` | Snapshot del total si se decide persistir; si no, se calcula. |
| `parametros_modulo.tipo` / `valor_texto` | Soportar enums/booleanos (`matriz_requiere_autorizacion`, `bloqueo_taller_automatico`, `alcance_hospital_extraordinario`). |

> **Alternativa más simple:** no agregar columnas a `matrices_generales`; calcular totales en lectura y usar `ajustes_post_cierre` para la fecha/actor. La tarea 00018 decide según el volumen y el requerimiento de snapshot.

### Parámetros

| Clave | Default | Uso |
|---|---|---|
| `matriz_requiere_autorizacion` | `true` | Si la matriz pasa por workflow; si es `false`, se usa solo el candado. |
| `bloqueo_taller_automatico` | `true` | Si al autorizar la matriz los talleres se bloquean automáticamente. |
| `dias_limite_cambio` | 45 | Límite para solicitar cambios (ADR-00010). |
| `umbral_cambio_costo_reautorizacion` | NULL | Si el delta de costo supera el umbral, exigir reautorización de matriz. |
| `permite_cambio_hospital` | `true` | Si la solicitud puede cambiar el hospital dentro del alcance. |
| `permite_cambio_producto` | `true` | Si la solicitud puede cambiar producto/cantidad. |

## Backend y frontend

### Backend

- Extender `TalleresService`/`MatrizTalleresService`:
  - `POST /talleres/{id}/solicitudes-cambio` (existente) con `tipo_solicitud` y `datos_json` ampliado.
  - `POST /talleres/solicitudes-cambio/{id}/resolver {aprobar|rechazar, motivo}` (existente).
  - Al aprobar: aplicar cambio, recalcular costos/matriz, escribir `ajustes_post_cierre`, actualizar `fecha_ultima_actualizacion`, notificar.
  - Al rechazar: solo motivo + notificación.
- Bloqueo:
  - `TalleresService.UpdateAsync` rechaza edición directa si `bloqueado` y no hay solicitud aprobada.
  - `MatrizTalleresService` expone `bloqueado`/`solicitudCambioPendiente` en DTO.
- `CalendarioService` expone `bloqueado` y `solicitudCambioPendiente` (ADR-00016).
- No se reabre el workflow de la matriz.

### Frontend

- **Calendario/Inspector**: candado visible; “Editar” → “Solicitar cambio” cuando está bloqueado.
- **Modal “Solicitar cambio”**: reutilizar `SolicitarCambioModal` de talleres; agregar campos según permisos y tipo de solicitud; diff antes/después; motivo obligatorio.
- **Matriz General**: pendientes arriba con icono; acción “Resolver” (aprobar/rechazar) con motivo; mostrar delta de costo y total actualizado.
- **Historial**: la solicitud y la resolución se ven en el historial del taller y en “Ajustes”; la matriz muestra la fecha de última actualización.
- **Notificaciones**: campana al autorizador/solicitante.

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **0** | Planificación | Este ADR + tarea 00018; confirmar autorizador y umbral | Documento revisado |
| **1** | Base de datos | Script 0036: columnas de solicitud/matriz, parámetros | Script idempotente, `PARSEONLY` |
| **2** | Backend | Solicitud/resolución, bloqueo, recálculo, auditoría, notificaciones | `dotnet test` |
| **3** | Frontend | Candado, modal, matriz, historial | `npm run build`, `npm run lint` |
| **4** | Verificación | E2E solicitud/aprobación/rechazo; matriz y totales | Prueba con taller real |

## Validación contra la operación documentada

| Regla | Fuente documental (cita literal) | Cómo se implementa |
|---|---|---|
| La matriz se autoriza antes del inicio de talleres | `referencias/pdf-to-md/Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` §5.2 — *“a más tardar el día 20 de cada mes, la Matriz autorizada”* | La matriz conserva su workflow/autorización. |
| Los cambios de fecha/hora son parte de la operación | `referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales.md` (nodo P2F) — *“EV: Notifica al GV para que reagende la visita para ofrecer el taller médico.”* | La solicitud de cambio por taller cubre la reagenda. |
| Reagenda documentada | `referencias/pdf-to-md/Instructivos/Impartición de Talleres Médicos.md` §5.1.1 — *“En caso de cambio, notifica inmediatamente por teléfono al especialista de producto…”* | El cambio se registra y se notifica. |
| Fecha/hora del taller | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — *“Fecha de taller…”* · *“Hora…”* | Son campos solicitable/aprobables. |
| Días laborables | `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — *“Las columnas S y D corresponden a Sábado y Domingo (días no laborables, sin registro de talleres).”* | El cambio de fecha no puede caer en sábado/domingo para talleres. |

**Reglas de digitalización sin fuente en el papel** (interpretación/operación real):

- El candado por taller y la solicitud con diff son una decisión de producto (2026-10-23), inspirada en el patrón de “Solicitar cambio” de talleres.
- La matriz no se desbloquea completa; la reautorización solo aplica a cambios estructurales o al umbral de costo.
- El autorizador y el umbral son configurables; el papel no los define.
- La ruta sin workflow es una decisión de ADR-00015; este ADR solo define el candado de talleres/matriz.

## Consequences

**Positivas**

- El cambio de un taller no obliga a reabrir la matriz ni a repetir firmas.
- El autorizador ve el diff y el impacto en costos antes de aprobar.
- La matriz conserva su autorización y su histórico; el taller queda bloqueado y auditable.
- Se reutiliza el patrón existente de solicitudes de cambio (ADR-00010), sin una bandeja nueva.
- La ruta deja de ser un cuello de botella: es un draft editable.

**Negativas**

- Hay dos niveles de cambio (solicitud por taller vs. nueva versión de matriz) que la UI debe explicar.
- El recálculo de totales y la sincronización con la matriz agregan complejidad al servicio.
- Si el autorizador no responde, el taller queda bloqueado; se necesita un recordatorio/SLA (futuro).
- El cambio de hospital/producto puede requerir validaciones adicionales (alcance de extraordinario, gerencia, costos).

**Neutras / seguimiento**

- La tabla `taller_solicitudes_cambio` se reutiliza; las columnas nuevas son aditivas.
- `matriz_requiere_autorizacion = false` permite operar solo con candado si el área lo decide.
- La reautorización por umbral de costo queda como parámetro opcional; default sin umbral.
- El correo de notificación sigue deshabilitado temporalmente (ADR-00010); se puede reactivar.

## Anexo — Fuentes

**Documentales (referencias del módulo):**

- `referencias/pdf-to-md/Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` — matriz autorizada, día 20, costos.
- `referencias/pdf-to-md/Instructivos/Impartición de Talleres Médicos.md` — víspera, cambios de cita, registro.
- `referencias/pdf-to-md/Procesos/Talleres Médicos en Hospitales.md` — reagenda (nodo P2F).
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — fecha, hora, producto, cantidades, costos.
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-006 Calendario de Talleres Médicos.md` — días laborables.

**Evidencia operativa (no son fuentes documentales formales):**

- `PREVIO de MATRIZ SESIONES DESCENTRALIZADOS AGOSTO.PDF` — matriz con ejecutivo/especialista, producto, cantidades y costos.
- `MODIFICADO CALENDARIO MENSUAL ESPECIALISTAS DE PRODUCTO 18102026.xlsx` — calendario operativo con cambios de agenda.

**Planificación interna (no son fuentes documentales):**

- `reglas-negocio.md` §5.11 (ajustes post-cierre), §5.12 (impartición) y §7.
- ADR-00006 (workflow), ADR-00007 (matriz), ADR-00008 (impartición), ADR-00010 (ajustes/solicitudes), ADR-00015 (ruta por especialista), ADR-00016 (calendario), ADR-00017 (tercera gerencia).
- Código actual: `TalleresService` (`solicitudes-cambio`, `AplicarAjusteAsync`), `MatrizTalleresService`, `TallerSolicitudCambio.cs`, `AjustePostCierre.cs`, `MatrizGeneral.cs`.
