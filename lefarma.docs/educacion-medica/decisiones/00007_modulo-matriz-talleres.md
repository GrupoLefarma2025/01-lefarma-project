---
fecha_creacion: 2026-10-02 12:00
fecha_modificacion: 2026-10-02 12:00
resumen: Módulo Matriz de Talleres de Educación Médica — captura de talleres (FOR-005) por el equipo de pareo EV+EP, matriz individual generable/bloqueable con reapertura del GV, matriz general automática por gerencia y mes, y autorización con el motor de workflow (GV → costos AEM → CA → DC). Sin tipo de acción nuevo (el AEM usa ENVIAR), acciones por proceso (codigo_proceso) y candado de edición en el paso inicial estilo OC/Solicitudes.
---

# 00007 — Módulo Matriz de Talleres

## Status

Proposed

> Complementa al ADR-00001 (esquema de datos; tablas `talleres`, `taller_recursos` y hermanas ya creadas) y al ADR-00006 (patrón de integración al motor de workflow, bandeja de autorizaciones y componentes compartidos). No modifica ADRs previos.

> **Decisiones del usuario (2026-10-02):** cadena de autorización **según instructivos** (GV → AEM → CA → DC), editable después en el admin de workflows; **matriz individual por equipo de pareo (EV+EP)**; **matriz general por gerencia**, creada automáticamente; al generar la individual se **bloquea** y el GV puede **reabrir**.

> **Ajustes del usuario (2026-10-02, segunda revisión):**
> 1. **Sin tipo de acción nuevo**: no se crea `CONFIRMAR`; el paso de costos del AEM usa la acción `ENVIAR` (label configurable del tipo por proceso).
> 2. **Acciones por proceso**: `config.workflow_tipos_accion` ahora exige `codigo_proceso` (único por `codigo + codigo_proceso`). El script crea los tipos de acción de Educación Médica y **remapea** las acciones existentes de los workflows EM de ADR-00006 a los tipos de su proceso.
> 3. **Candado de edición estilo OC/Solicitudes**: nada de un estado "Borrador" propio; la matriz general es editable **solo en el paso inicial** (estado `CREADA`, que es el "paso 1"), como `OrdenesCompra` y `SolicitudesPersonal` (`Solo se pueden editar ... en estado Creada`).

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fases|Fases]]
  - [[#Fase 0 — Decisiones de diseño (el porqué de cada una)|Fase 0 — Decisiones de diseño]]
  - [[#Fase 1 — Base de datos (script 0015)|Fase 1 — Base de datos]]
  - [[#Fase 2 — Backend|Fase 2 — Backend]]
  - [[#Fase 3 — Frontend|Fase 3 — Frontend]]
  - [[#Fase 4 — Verificación y cierre|Fase 4 — Verificación y cierre]]
- [[#Validación contra la operación documentada|Validación contra la operación documentada]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

El ciclo mensual de la **Matriz de Talleres (FOR-005)** se digitaliza así:

```
Equipos de pareo (EV + EP) capturan talleres aceptados (FOR-005 campos 1–12)
        │  "Generar matriz individual"
        ▼
Matriz individual (equipo + mes)   EnCaptura ──generar──▶ Generada
        │                                                  │
        │  concentración automática               GV "Reabrir captura"
        ▼                                                  │
Matriz general (gerencia + mes) = ENTIDAD DEL WORKFLOW  ◀────┘
   Paso inicial "Concentración" (CREADA = editable, como OC/Solicitudes)
     ─[ENVIAR]→ Firma Gerente de Ventas (firma digital)
       ─[AUTORIZAR]→ Registro de costos – AEM (acción ENVIAR)
         ─[ENVIAR]→ Revisión de costos – CA (firma digital)
           ─[AUTORIZAR]→ Autorización – DC (firma digital)
             ─[AUTORIZAR]→ Autorizada → talleres en estado "Autorizado"
   DEVOLVER en cada paso (comentario obligatorio) según la tabla del workflow.
```

1. **Dos artefactos de matriz**:
   - `matrices_individuales`: una por **equipo de pareo + mes** (`EnCaptura` → `Generada`, con `fecha_generacion`). Al generar se bloquea la captura del equipo; el GV puede reabrirla (auditado) mientras la general siga en el paso inicial.
   - `matrices_generales`: una por **gerencia + mes**, es la **entidad autorizable del workflow**. Nace **automáticamente** con el primer taller capturado de esa gerencia/mes, ya en el paso inicial. **No tiene estado propio**: su estado es el del motor (`CREADA` mientras es editable, `REVISION`/`PREPARACION`/`REVISION_DIRECTOR` en firmas, `APROBACION` al autorizar).
2. **Captura y concentración**: cada taller enlaza `id_matriz_individual` e `id_matriz_general`; la gerencia y el periodo se derivan de la selección del hospital (`talleres.id_seleccion_hospital → selecciones_mensuales.tipo_gerencia/fecha_seleccion`). La "concentración" es la vista de la matriz general: todos los talleres de la gerencia/mes ya están ahí; el GV ve el panel por equipo (generadas vs. en captura) antes de firmar.
3. **Candado de edición (patrón de la casa)**: la matriz general y sus talleres son editables **solo si `id_estado = CREADA`** (paso inicial). Fuera de ahí, edición rechazada con el mensaje del estándar: *"Solo se pueden editar ... en estado Creada."* Referencias vivas: `OrdenCompraService.UpdateAsync` (`orden.Estado?.IdEstado != 1`) y `SolicitudPersonalService` (`soli.Estado?.Codigo != "CREADA"`). Adicionalmente, la captura del equipo exige su matriz individual en `EnCaptura`.
4. **Cadena de firmas según instructivos** (configurable después): GV firma → AEM registra costos → CA revisa costos y firma → DC autoriza. El paso del AEM es un **paso visible del workflow** sin firma digital (acción `ENVIAR`), con **salvaguarda interna** en el servicio: *el CA no puede firmar si no hay costos capturados* — así, si el área decide mañana quitar el paso del AEM desde el admin (Opción B), el candado sigue sin tocar código.
5. **Costos calculados**: subtotales y Costo Total = `SUM(taller_recursos.subtotal)` en el servicio; no se agrega columna `costo_total` (no existe hoy y el ADR-00001 ya definía el cálculo en servicio).
6. **Bandeja de Autorizaciones**: se agrega el tipo `matriz` (mismo endpoint con filtros y componentes compartidos del ADR-00006); cada rol ve su pendiente, incluido el AEM.
7. **Tipos de acción por proceso**: se crean los tipos EM (`AUTORIZAR`, `ENVIAR`, `DEVOLVER`, `CANCELAR`) para `EDUCACION_MEDICA_SELECCION`, `EDUCACION_MEDICA_RUTAS` y `EDUCACION_MEDICA_MATRIZ`, y se remapean las acciones EM existentes a los tipos de su proceso (el motor especializa `CANCELAR` por código; los códigos se conservan).

## Fases

### Fase 0 — Decisiones de diseño (el porqué de cada una)

1. **Captura por el equipo de pareo (EV+EP)**
   *Por qué:* el instructivo asigna la captura al EV; la operación real documentada (nota de campo 2026-08-10) confirma que **ambos roles capturan** y el módulo refleja la operación real. El equipo de pareo ya es una entidad del sistema (`equipos_pareo`), así que la matriz individual se ancla a él.
2. **Matriz individual generable y bloqueable**
   *Por qué:* el papel cierra la captura cuando el EV/GV envía su matriz; digitalmente "Generar" produce el documento y protege la información enviada. El GV puede reabrir (con auditoría) porque los errores de captura son la razón #1 de regreso en el proceso real.
3. **Matriz general automática por gerencia + mes**
   *Por qué:* el papel define una concentración por GV de cada gerencia (IMSS y Descentralizado por separado). Automatizarla evita un "botón de concentrar" que nadie recuerda pulsar y permite que el GV vea el avance de sus equipos desde el primer taller. Es la misma unidad que firma el GV (IDT-003 §5.2.3) y la que costea el AEM (IDT-004 §5.1).
4. **Cadena GV → AEM → CA → DC, configurable**
   *Por qué:* es la cadena literal de los instructivos; el motor permite después editar pasos/participantes (incluso invertir u omitir el paso AEM) sin despliegue.
5. **Paso AEM visible con salvaguarda (A + B)**
   *Por qué:* el AEM tiene una tarea real entre la firma del GV y la revisión del CA; modelarla como paso hace que le aparezca en la bandeja. La salvaguarda "CA sin costos = error" protege el proceso aunque el paso se elimine de la configuración.
6. **Estados reutilizados del catálogo**
   *Por qué:* mismo criterio que ADR-00006 — no se crean estados de Educación Médica: `CREADA` (inicio/editable), `REVISION` (firmas GV y CA), `PREPARACION` (costos AEM), `REVISION_DIRECTOR` (DC), `APROBACION` (final), `CANCELADA` (disponible, no usada por la matriz).
7. **Candado de edición en el paso inicial**
   *Por qué:* el usuario pidió expresamente el patrón de OC/Solicitudes (estado `CREADA`) en lugar de un "Borrador" propio; un solo mecanismo estándar reduce código y sorpresas.
8. **Sincronización al autorizar**
   *Por qué:* el ranking (`cobertura_taller`) y el futuro módulo de impartición leen `talleres.estado`; al autorizar DC los talleres de la matriz pasan a `Autorizado` (la vida posterior — `Programado/EnCurso/Realizado` — queda para el módulo de impartición).

### Fase 1 — Base de datos (script 0015)

`lefarma.database/educacion-medica/0015_20261002-1200_educacion-medica_create-matriz-talleres-workflow.lefarma.sql`, idempotente, en una transacción, con `MS_Description` (mismo estilo del script 0014):

1. **Tipos de acción EM por proceso** (requisito nuevo de plataforma):
   - `AUTORIZAR`, `ENVIAR`, `DEVOLVER`, `CANCELAR` para `EDUCACION_MEDICA_SELECCION`, `EDUCACION_MEDICA_RUTAS` y `EDUCACION_MEDICA_MATRIZ` (guardas por `codigo + codigo_proceso`).
   - Remapeo idempotente: las acciones de workflows `EDUCACION_MEDICA%` cuyo tipo no pertenezca al proceso se actualizan al tipo correcto por código.
2. **`educacion_medica.matrices_individuales`**: `id_matriz_individual`, `id_equipo` (FK física → `equipos_pareo`), `periodo DATE` (primer día del mes; CHECK `DAY(periodo) = 1`), `estado VARCHAR(15)` CHECK `EnCaptura|Generada` default `EnCaptura`, `fecha_generacion`, auditoría, `UNIQUE (id_equipo, periodo)`.
3. **`educacion_medica.matrices_generales`**: `id_matriz_general`, `id_tipo_gerencia` (FK física → `tipo_gerencia`), `periodo DATE` (CHECK primer día del mes), `id_workflow`/`id_paso_actual`/`id_estado` (FK lógicas al motor, sin columna de estado propia), auditoría, `UNIQUE (id_tipo_gerencia, periodo)`.
4. **`educacion_medica.talleres`**: columnas `id_matriz_individual` e `id_matriz_general` (FKs físicas `ON DELETE NO ACTION` + índices). No se toca la columna `estado` existente (ciclo de impartición).
5. **Workflows** `EDUCACION_MEDICA_MATRIZ` — 2 variantes lineales: `Matriz de talleres - IMSS` y `Matriz de talleres - Descentralizado`:
   - 0 `Concentración` — `CREADA` — inicio, sin firma — *editable aquí*.
   - 10 `Firma Gerente de Ventas - {Gerencia}` — `REVISION` — firma.
   - 20 `Registro de costos - AEM` — `PREPARACION` — sin firma (acción `ENVIAR`).
   - 30 `Revisión de costos - CA` — `REVISION` — firma.
   - 40 `Autorización - DC` — `REVISION_DIRECTOR` — firma.
   - 50 `Autorizada` — `APROBACION` — final.
   - Acciones: `0→10 ENVIAR`, `10→20 AUTORIZAR`, `10→0 DEVOLVER`, `20→30 ENVIAR`, `20→0 DEVOLVER`, `30→40 AUTORIZAR`, `30→20 DEVOLVER`, `40→50 AUTORIZAR`, `40→30 DEVOLVER`.
6. **Sin mappings ni participantes** (manuales en el admin, igual que ADR-00006): 2 mappings de scope `TIPO_GERENCIA` (1 = IMSS, 2 = Descentralizado) + participantes por paso (GV de la gerencia en 0 y 10, AEM en 20, CA en 30, DC en 40).
7. **Sin backfill**: no hay datos de talleres en operación.

### Fase 2 — Backend

#### 2.1 Motor y entidades
- `Shared/Constants/CodigoProceso.cs`: `EDUCACION_MEDICA_MATRIZ`.
- `MatrizIndividual` y `MatrizGeneral` (esta última implementa `IWorkflowEntity`, navegación `EstadoWorkflow`, expone `IdTipoGerencia`); `Taller` += `IdMatrizIndividual`/`IdMatrizGeneral` + navegaciones.
- Configuraciones EF (UNIQUE de ambas matrices, FKs, índices) y DbSets.
- `WorkflowEngine.ResolveEntityContextAsync`: +1 caso `EDUCACION_MEDICA_MATRIZ` (carga `MatrizGeneral` por id) — único cambio obligatorio en código compartido.

#### 2.2 Servicios
- `TalleresService` (`TalleresController`, prefijo `api/educacion-medica/talleres`):
  - `GET /mis-talleres?periodo=YYYY-MM` (equipo, matriz individual, filas).
  - `POST /` — valida que el usuario sea EV/EP del equipo asignado a la región del hospital; deriva gerencia/mes de la selección; **get-or-create** de matriz individual y general (la general nace en el paso inicial del workflow resuelto por `TIPO_GERENCIA`); enlaza el taller.
  - `PUT /{id}` / `DELETE /{id}` — solo si la general está en `CREADA` y la individual en `EnCaptura`.
  - `POST /matrices-individuales/{id}/generar` / `.../reabrir` (reabrir: solo GV participante y general en `CREADA`).
- `MatrizTalleresService` (`MatrizTalleresController`, prefijo `api/educacion-medica/matrices-talleres`):
  - `GET /?gerencia=&periodo=` / `GET /{id}` (detalle con talleres, recursos y totales `SUM(subtotal)`).
  - `GET /{id}/concentracion` (equipos + estado individual).
  - `PUT /{id}/talleres/{idTaller}/costos` (solo AEM, solo en el paso de costos).
  - `POST /{id}/firmar` `{idAccion, comentario}` (participante + firma digital, patrón ADR-00006); al ejecutar `AUTORIZAR` del DC: talleres → `Autorizado`.
  - `GET /{id}/acciones-disponibles` / `GET /{id}/historial` / `GET /{id}/documento`.
  - **Salvaguarda**: la firma de `Revisión de costos - CA` exige que todos los talleres tengan al menos un recurso con `costo_unitario` capturado (soporta la Opción B si se elimina el paso AEM).
- `AprobacionesService`: sección de matrices (tipo `matriz`), en `pendientes|mios|todos`; `PendienteAprobacionDto` += `IdMatrizGeneral`.

#### 2.3 Pruebas
- `TalleresServiceTests`: elegibilidad (miembro del equipo asignado), derivación gerencia/mes, get-or-create de matrices, candado por estado `CREADA`, generar/bloqueo, reabrir GV.
- `MatrizTalleresServiceTests`: matriz única por gerencia/mes, concentración, cadena GV→AEM→CA→DC, **CA sin costos = error**, devoluciones según tabla, sincronización a `Autorizado`.
- `AprobacionesServiceTests` +2 (matriz pendiente/todos) · `WorkflowTestHarness` +2 workflows de matriz · test del caso nuevo del engine.

### Fase 3 — Frontend

- `services/educacionMedica.api.ts` + `types/educacionMedica.types.ts`: `talleres.*` y `matrices.*`.
- `pages/taller/MisTalleresPage.tsx` (`/educacion-medica/talleres/mis-talleres`): cabecera del equipo y mes, tabla de talleres, alta/edición (modal con campos FOR-005 1–12), generar/reabrir, imprimible individual, modo lectura al estar `Generada`.
- `pages/taller/MatrizTalleresPage.tsx` (reemplaza el wireframe en `/educacion-medica/talleres`): selector gerencia/mes, panel "Matrices por equipo", tabla concentrada con costos editables (AEM) y Costo Total, barra de acciones del workflow (componentes compartidos `WorkflowAccionesPanel`/`WorkflowAccionModal`/`WorkflowHistorial`), imprimible general, deep-link `?idMatriz=`.
- `pages/taller/components/`: `TallerFormModal`, `MatrizTalleresTable`, `MatrizCostosEditor`, `MatricesEquipoPanel`, `MatrizPrintDocument`.
- `MisAsignacionesPage`: acción **"Registrar taller"** por asignación (precarga hospital/región/selección).
- `BandejaAprobacionesPage`: render del tipo `matriz` + deep-link.
- `menuItems`/`EducacionMedicaRoutes`: "Matriz de talleres" y "Mis talleres"; se retira `TallerPage.tsx`.

### Fase 4 — Verificación y cierre

- E2E: capturar → generar individual → concentración → GV firma → AEM costos → CA (bloqueado sin costos) → DC autoriza → talleres `Autorizado`; devoluciones; reapertura GV; bandeja por rol; imprimibles.
- `dotnet test` (suite completa) y `pnpm run build` en verde; ESLint limpio en archivos nuevos.
- Sincronizar `tareas/00007`; actualizar `reglas-negocio.md` §4.5 (reconciliación GG vs instructivos) y nueva §5.11.

## Validación contra la operación documentada

| Paso digital | Fuente | Cita / dato |
|---|---|---|
| Captura de talleres por el EV (campos 1–12) | `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` (IDT-003) §5.2.2; FOR-005 | *"1. Gerencia: IMSS o Descentralizados · 2. Región · 3. Hospital · 4. Estado · 5. Ciudad/Municipio · 6. No. de participantes · 7. Nombre del ejecutivo · 8. Fecha de taller · 9. Hora del taller médico · 10. ¿Requiere equipo de proyección? · 11. Nombre del Producto · 12. Cantidad (piezas) de producto"* |
| También captura el EP (operación real) | `reglas-negocio.md` §4.4 nota (2026-08-10) | *"el instructivo IDT-003 (v02, 2024) documenta que solo el EV captura FOR-005. En la operación real actual, ambos roles capturan hospitales"* |
| Concentración por GV y firma del concentrado | IDT-003 §5.2.3; `reglas-negocio.md` paso 14 | *"Si todo está bien los concentra en una sola matriz, firma el formato y lo envía por correo electrónico el día 15 de cada mes al Auxiliar Administrativo de Educación Médica."* |
| Costos del AEM (día 15) | IDT-004 §5.1; `reglas-negocio.md` paso 15 | *"Recibe el día 15… la Matriz de Talleres Médicos firmada por los Gerentes de Ventas… registra los costos totales"* (muestras, folletos, gastos de envío, box lunch) |
| Revisión de costos CA y firma | IDT-004 §5.2; `reglas-negocio.md` paso 16 | *"Recibe la matriz y revisa que todos los costos estén de acuerdo a las políticas establecidas. Si todo está bien firma la Matriz y la envía inmediatamente… a Dirección Corporativa"* |
| Autorización DC (día 20) | IDT-004 §5.2; `reglas-negocio.md` paso 17 | *"Envía… a más tardar el día 20 de cada mes, la Matriz autorizada al Auxiliar Administrativo de Educación Médica"* |
| GG en el proceso maestro (discrepancia) | `Procesos/Talleres Médicos en Hospitales.md` P3A | *"Obtiene autorización de GG, Coordinador Administrativo y Dirección Corporativa"* — **no reconciliado** con los instructivos; decisión V1: seguir los instructivos (GV→CA→DC) y dejarlo configurable en el admin |

**Decisiones de digitalización (interpretación, no cita):** matriz individual como artefacto generable/bloqueable; matriz general automática por gerencia+mes; edición solo en paso inicial (`CREADA`); salvaguarda "CA sin costos"; tipos de acción por proceso (cambio de plataforma, no de negocio).

## Consequences

**Positivas**
- El ciclo mensual de la Matriz queda trazable de punta a punta: quién capturó, quién generó su matriz, quién firmó y cuándo, con historial del motor.
- Configurable sin despliegue: la cadena (incluido el paso AEM) se edita en el admin; la salvaguarda de costos protege aunque se elimine el paso.
- Reutiliza todo lo construido en ADR-00006 (bandeja, componentes, patrón de firmas, patrones de servicio).
- El candado de edición sigue el estándar OC/Solicitudes, sin mecanismos nuevos que mantener.

**Negativas**
- Requiere configuración manual post-script: 2 mappings + participantes (GV IMSS/Desc, AEM, CA, DC) y sus firmas digitales.
- El paso AEM añade un blanco de configuración más; si el área no lo quiere, debe eliminarse desde el admin (la salvaguarda sigue).
- La cadena documentada vs. el proceso maestro (GG) queda como decisión pendiente de reconciliación formal con el área.

**Neutras**
- `talleres` se enlaza a la selección del hospital (no a la visita de ruta): más simple y suficiente para la matriz.
- Materiales, asistencias, evidencias e impartición quedan fuera de este ADR (tablas ya existen; se digitalizan aparte).

## Anexo — Fuentes

- `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` (ASK-CEM-IDT-003 v02) — §5.1.3, §5.2.2, §5.2.3.
- `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` (ASK-CEM-IDT-004 v01) — §5.1, §5.2.
- `Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` — campos 1–12 y bloque de firmas (Elaboró/Revisó/Autorizó).
- `Procesos/Talleres Médicos en Hospitales.md` (ASK-CEM-DDP-001 v02) — Fase 3, nodos P3A/P3B (discrepancia GG).
- `reglas-negocio.md` — §4.4 (pasos 13–17, tabla FOR-005), §4.5 (vacíos documentados), §5.1 (captura EV+EP), §5.3 (pareo).
- `decisiones/00001_esquema-datos-educacion-medica.md` — tablas `talleres`/`taller_recursos`.
- `decisiones/00006_workflow-seleccion-y-rutas.md` — patrón de integración al motor, bandeja y componentes.
- Código de referencia del estándar de edición: `OrdenCompraService.UpdateAsync` (`IdEstado != 1`), `SolicitudPersonalService` (`Estado.Codigo != "CREADA"`); `WorkflowTipoAccion.CodigoProceso` (tipos de acción por proceso).
