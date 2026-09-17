---
fecha_creacion: 2026-09-12 13:00
fecha_modificacion: 2026-09-12 13:00
resumen: Integración del motor genérico de workflow del sistema (config.workflows) a la autorización de la Selección mensual y las Rutas de Educación Médica — dos workflows con código propio (EDUCACION_MEDICA_SELECCION / EDUCACION_MEDICA_RUTAS) resueltos directo por código, firma digital exigida, cadena GG→GV en la selección y GV→CA→DC en las rutas, la versión de rutas como entidad autorizable (rutas_versiones) y la Bandeja de Autorizaciones funcional.
---

# 00006 — Workflow de autorización: Selección mensual y Rutas

## Status

Proposed

> Complementa al ADR-00001 (esquema de datos) y al ADR-00004 (reparto y planificación de rutas; su decisión 12 definió los estados separados de selección y rutas, que este ADR ahora gobierna con el motor de workflow). Sustituye la **doble firma casera** de `SeleccionMensualService` (endpoint `POST /autorizar` con `{rol: 'GV'|'GG'}`) y la confirmación directa de rutas (`POST /confirmar` sin firmas).

> **Contexto técnico:** el sistema ya opera un motor de workflow configurable (`config.workflows`, usado por Órdenes de Compra y Solicitudes de Personal) con pasos, acciones, participantes, condiciones, campos dinámicos, notificaciones y bitácora. Este ADR decide **cómo Educación Médica se integra a ese motor** en lugar de seguir con máquinas de estado y validaciones propias.

> **Revisión 2026-09-12 (revisión del usuario)** — Se adopta **un solo proceso, `EDUCACION_MEDICA`**, en lugar de dos códigos de proceso separados. El ruteo entre la fase de selección y la de rutas se hace con el mecanismo de la plataforma para esto: un **scope nuevo `SUBPROCESO`** (1 = selección, 2 = rutas) en `workflow_scope_types` y **dos `workflow_mappings`** que apuntan a dos workflows específicos (patrón documentado en `lefarma.database/legacy/025_workflow_scopes_categoria_tipo_solicitud.sql`). Las dos definiciones siguen existiendo (cadenas y entidades distintas; la versión de rutas es iterativa) pero el **proceso es uno** y su configuración queda agrupada por el proceso `EDUCACION_MEDICA`.

> **Revisión 2026-09-12 (entidades y huella en el motor)** — Se precisan las entidades que entran al motor: `SeleccionMensual` (existente) y `RutaVersion` (nueva, tabla `rutas_versiones`), ambas con `id_workflow`/`id_paso_actual`/`id_estado`. Se agregan las mejoras de modelo de las decisiones 16–18 (FK `rutas.id_ruta_version`, navegación `EstadoWorkflow`, `fecha_confirmacion` en la versión, impl explícita de `IdUsuarioCreador`) y se documenta la huella real en código compartido (decisión 19): **un solo método del motor**.

> **Revisión 2026-09-15 (workflow por gerencia + mappings)** — Diseño final acordado: **4 workflows lineales** (selección/rutas × IMSS/Descentralizado) con el **mismo código base por fase** (`EDUCACION_MEDICA_SELECCION` / `EDUCACION_MEDICA_RUTAS`) y **mappings por scope `TIPO_GERENCIA`** (1 = IMSS, 2 = Descentralizado) configurados en el admin de workflows. **Se eliminan las condiciones `IdTipoGerencia`** (las cadenas son lineales). Los **mappings son obligatorios**: sin ellos, el fallback por código compartido puede elegir la variante equivocada. Manual en el frontend: los 4 mappings + los participantes por paso.

## Índice

- [[#Status|Status]]
- [[#Decisión|Decisión]]
- [[#Fases|Fases]]
  - [[#Fase 0 — Decisiones de diseño (el porqué de cada una)|Fase 0 — Decisiones de diseño]]
  - [[#Fase 1 — Base de datos (script 0014)|Fase 1 — Base de datos]]
  - [[#Fase 2 — Backend|Fase 2 — Backend]]
  - [[#Fase 3 — Frontend|Fase 3 — Frontend]]
  - [[#Fase 4 — Verificación y cierre|Fase 4 — Verificación y cierre]]
- [[#Validación contra la operación documentada|Validación contra la operación documentada]]
- [[#Consequences|Consequences]]
- [[#Anexo — Fuentes|Anexo — Fuentes]]

## Decisión

La autorización de la **Selección mensual** y de las **Rutas** deja de ser código a medida y pasa a ejecutarse con el **motor de workflow del sistema**. Tres cambios centrales:

1. **Cuatro workflows lineales (por fase y gerencia)**, con el **mismo código base por fase** y **mappings de scope `TIPO_GERENCIA`** que eligen la variante (1 = IMSS, 2 = Descentralizado). Agregar una gerencia nueva (p. ej. Privado) es otro workflow + su mapping, **sin tocar código**.

```
Workflows (elegidos por mapping TIPO_GERENCIA):
  ├─ EDUCACION_MEDICA_SELECCION · "Selección mensual - IMSS" | "- Descentralizado"
  │    Borrador ─[ENVIAR] → Firma Gerencia General (firma digital)
  │      → Firma Gerente de Ventas (condición por gerencia) → Autorizada → habilita Rutas
  │    DEVOLVER (comentario) → Borrador
  │
  └─ EDUCACION_MEDICA_RUTAS · "Rutas - IMSS" | "- Descentralizado"
       Draft ─[ENVIAR A AUTORIZACIÓN] → Firma Gerente de Ventas (condición por gerencia)
         → Revisión Coordinador Administrativo (costos) → Autorización Dirección Corporativa
         → Confirmada → publica asignaciones
       DEVOLVER (comentario) → Draft;   CANCELAR → Cancelada (libera regenerar)
```

2. **La gerencia se resuelve con un workflow por variante (mappings de scope `TIPO_GERENCIA`)**, no con condiciones: cuatro workflows lineales (selección/rutas × IMSS/Descentralizado) con el mismo código base por fase; el servicio resuelve el workflow por el mapping según `IdTipoGerencia` de la entidad (la selección lo tiene; la versión de rutas lo denormaliza al generarse). Cada variante tiene **como participante al GV de esa gerencia**, así que la validación de quién firma la hace el motor. *Los mappings son obligatorios.*

3. **La versión de rutas es la entidad autorizable**: nueva tabla `educacion_medica.rutas_versiones` (hoy `version` y `estado` viven repetidos en cada fila de `rutas` y no existe dónde registrar paso actual ni firmas). Cada versión es una **instancia limpia** del workflow de rutas: regenerar crea otra versión con su propia cadena y su propia auditoría.

Además, en ambos procesos: **firma digital obligatoria** (misma regla que OC/RH: el firmante debe tener imagen de firma en Perfil) y **quien firma no edita** (la entidad solo es editable en Borrador/Draft; una devolución la regresa a ese estado con motivo obligatorio).

## Fases

| Fase | Nombre | Qué contiene | Cómo se verifica |
|---|---|---|---|
| **0** | Planificación | Decisiones de diseño, ADR + tareas, script 0014 en disco (sin aplicar) | Este documento + script revisado por el usuario |
| **1** | Base de datos | Script 0014: `rutas_versiones`, columnas de workflow, seeds de los 2 workflows con pasos/acciones/condiciones/participantes | Script idempotente aplicado en LefarmaDev; workflows visibles en el diagrama de admin |
| **2** | Backend | Entidades `IWorkflowEntity`, casos EM en el motor, servicios de firma por acciones, endpoints `acciones-disponibles`/`firmar`/`historial`, bandeja `pendientes` | `dotnet test` en verde (suite actual + pruebas nuevas de orden, participantes y devoluciones) |
| **3** | Frontend | Selección con acciones reales + firma digital, Rutas con cadena GV→CA→DC, Bandeja de Autorizaciones funcional | `npm run build` + flujo E2E manual con usuarios distintos |
| **4** | Verificación y cierre | Documentación sincronizada, status del ADR, prueba de extremo a extremo | Selección firmada por GG→GV y rutas firmadas por GV→CA→DC en dev |

---

## Fase 0 — Decisiones de diseño (el porqué de cada una)

> Tareas: [[tareas/00006_workflow-seleccion-y-rutas#Fase 0 — Planificación]]

### Motor y procesos

1. **Se usa el motor genérico (`config.workflows`), no una máquina de estados propia.**
   *Por qué:* (a) **seguridad** — hoy `AutorizarAsync` recibe `{rol: 'GV'|'GG'}` del request y **no valida quién firma**: cualquier usuario autenticado puede invocar ambas firmas; el motor valida participantes del paso (usuario, rol o jefe inmediato) en cada acción; (b) **bitácora** — cada acción queda en `workflow_bitacora` (quién, cuándo, comentario, snapshot), hoy la firma solo deja una fecha sin actor; (c) **configurabilidad** — pasos, participantes y condiciones se ajustan desde el admin de workflows sin recompilar; (d) **consistencia** — EM se comporta como OC y RH (mismas reglas de firma digital, mismo historial, mismas notificaciones futuras).

2. **Un workflow por fase y gerencia (4 en total), elegidos por mappings de scope TIPO_GERENCIA.**
   *Por qué:* el ruteo por gerencia vive en **configuración** (mapping) y no en código ni en condiciones: cada variante es una cadena lineal, sus participantes son obvios, y una gerencia nueva se agrega con un workflow + un mapping. El costo es duplicar la definición por gerencia (2 por fase). El mismo código base por fase (`EDUCACION_MEDICA_SELECCION` / `EDUCACION_MEDICA_RUTAS`) es también el `tipoEntidad` del motor.

3. **La gerencia se resuelve con un workflow por variante (mappings), no con condiciones.**
   *Por qué:* las condiciones (`workflow_condiciones`) funcionan, pero su configuración en el admin resultó poco evidente y mezclan dos cadenas en un solo diagrama. Con workflows por gerencia el ruteo ocurre **antes** de ejecutar el flujo (al resolver el workflow por el mapping) y cada diagrama queda lineal. *Advertencia:* los mappings son obligatorios; sin ellos el fallback por código compartido puede elegir la variante equivocada.

4. **El Cierre administrativo de la selección queda fuera del workflow (v1).**
   *Por qué:* cerrar no tiene firma documentada ni decide la autorización; es un acto administrativo posterior que ya existe (`POST /cerrar`, valida rutas confirmadas). Meterlo al workflow agregaría un paso sin valor de aprobación. Si el área lo pide, se agrega como acción `CERRAR` más adelante.

### Firmas y reglas

5. **Selección: GG firma primero y después el GV de la gerencia** (`GG → GV`).
   *Por qué:* es el orden del instructivo: *"Al final de la reunión firma los formatos de cada gerencia y solicita a los Gerentes de ventas que firmen su respectivo formato"* (IDT-003 §5.1.3, actor Gerente General). Corrige el orden actual implementado (GV → GG), que no coincide con la fuente.

6. **Rutas: GV firma → CA revisa costos → DC autoriza** (cadena D6).
   *Por qué:* es la cadena documentada del concentrado/matriz: el GV *"los concentra en una sola matriz, firma el formato"* (IDT-003 §5.2.3); el Coordinador Administrativo *"revisa que todos los costos estén de acuerdo a las políticas… firma la Matriz y la envía… a Dirección Corporativa para su autorización"* (IDT-004 §5.2); Dirección Corporativa autoriza. La acción final de DC es la que **confirma y publica** las asignaciones (alimenta `GET /talleres/asignaciones/{idUsuario}`).
   > *Nota de interpretación:* el FOR-006 (Calendario) no trae bloque de firma operativa (vacío documentado en `reglas-negocio.md` §4.5). El área decidió (2026-09-12) aplicar la cadena del formato que sí la tiene (la Matriz de Talleres, D6) a la autorización de la planeación de rutas del sistema.

7. **Firma digital obligatoria en todas las firmas del workflow.**
   *Por qué:* es el estándar de la casa (OC y RH exigen `hasFirma` antes de ejecutar cualquier acción). El firmante debe tener su imagen de firma cargada en Perfil; el sistema la muestra en el historial y en el resumen imprimible. Sin firma digital el botón está bloqueado con aviso.

8. **"Quien firma no edita": la entidad solo es editable en el paso inicial.**
   *Por qué:* regla explícita del wireframe de la bandeja ("Quien firma no puede editar") y garantía de que lo firmado no cambia después. Selección: editable en `Borrador`; al enviar a revisión queda bloqueada. Rutas: editable en `Draft`; "Enviar a autorización" congela la versión y cualquier corrección se hace devolviendo (que regresa a `Draft` con motivo).

9. **Sin rechazo terminal en v1: la no-aceptación se expresa devolviendo a Borrador con motivo.**
   *Por qué:* la operación documentada no describe un estado "Rechazada" para la selección — describe corrección: *"De lo contrario contacta al Ejecutivo de Ventas para corregir la información registrada en el formato"* (IDT-003 §5.2.3). `DEVOLVER` con comentario obligatorio cubre ese bucle y no inventa estados que el negocio no usa.

### Datos, migración y alcance

10. **`rutas_versiones` como entidad del workflow de rutas.**
    *Por qué:* hoy `version` y `estado` viven repetidos en cada fila de `rutas` (una por equipo; la selección 4 de dev tiene 6 filas por versión) y la confirmación es "todas las rutas de la versión a la vez". El motor de workflow necesita **una fila con identidad propia** para colgarle `id_workflow`, `id_paso_actual` e `id_estado`, y la bitácora necesita un `idEntidad` único (`tipo_entidad` + `id_entidad`). Rutas por equipo y versión para firmar no encajan: no existe la fila "versión 2".

    **Ejemplo con datos reales (selección 4, dev):**

    ```
    Hoy                                                Con rutas_versiones
    rutas: id|version|estado                           rutas_versiones:
    5 |1|Archivada  ┐                                  1 | sel 4 | v1 | Archivada | (final)    | wf | ger 1
    ... 6 filas     │ mismo estado repetido            2 | sel 4 | v2 | Draft     | Firma GV   | wf | ger 1
    11|2|Draft      ┘                                  ▲
    ... 6 filas                                        └── rutas.id_ruta_version → 1 ó 2 (las 6 filas de la versión)
    ```

    *Alternativas descartadas:* (a) colgar el workflow de una fila de `rutas` — exige elegir una "ruta representante" y mantener 6 filas sincronizadas a mano; (b) colgarlo de `selecciones_mensuales` — esa fila ya lleva su propia cadena (GG→GV) y las versiones de rutas se repiten (v1, v2…), así que una sola fila no puede con dos cadenas ni reiniciarse sin perder quién firmó cada versión; (c) no versionar — pierde la regeneración y el historial por versiones que ya existen.

    Beneficios: cada versión es una **instancia limpia** del workflow (regenerar crea v3 con su cadena propia; la v2 archivada conserva la suya); la bandeja lista items naturales ("Rutas v2 — pendiente GV"); la bitácora queda inequívoca (`tipo_entidad = RUTAS_VERSION, id = 2`). `rutas.version`/`rutas.estado` se conservan sincronizados para no romper consultas ni la SPA (decisión 16).

11. **El campo `estado` de negocio se conserva y se sincroniza; no se elimina.**
    *Por qué:* la UI, los filtros y las validaciones (p. ej. "solo selección Autorizada puede generar rutas") ya usan las cadenas `Borrador/EnRevision/Autorizada/Cerrada` y `Draft/Confirmada/Cancelada/Archivada`. El servicio sigue escribiendo esas columnas a partir del paso alcanzado en el motor: **cero cambios de contrato para lo que ya funciona**, y el motor es quien decide las transiciones.

12. **`POST /autorizar` se retira; `POST /confirmar` de rutas se convierte en la acción final de DC.**
    *Por qué:* mantener dos caminos de firma (el viejo sin validación y el nuevo con motor) dejaría abierta la puerta trasera de seguridad. La confirmación deja de ser un endpoint suelto y pasa a ser el efecto de la acción `AUTORIZAR` de Dirección Corporativa sobre la versión. Regenerar una versión con firmas en vuelo queda prohibido: primero se cancela o se devuelve.

13. **Bandeja de Autorizaciones propia del módulo (pendientes por participación).**
    *Por qué:* el sistema **no tiene** un endpoint genérico de bandeja: cada módulo lista sus pendientes (OC filtra en `GET /ordenes`; RH en `GET /solicitudes-personal` con `verTodas`). Se crea `GET /api/educacion-medica/aprobaciones/pendientes`, que consulta selecciones y versiones de rutas en pasos intermedios donde el usuario participa. La pantalla (hoy wireframe) se implementa con el patrón ya probado de RH (`SolicitudFirmaTab`/`SolicitudFirmaModal`: acciones por `tipoAccionCodigo`, comentario obligatorio al devolver, campos dinámicos).

14. **Notificaciones y recordatorios quedan para una fase posterior.**
    *Por qué:* el motor ya los soporta (configurables), pero requieren definir canal, plantillas y destinatarios con el área. El MVP entrega el flujo de firmas y la bandeja; activar avisos es configuración, no código.

15. **Se migran los datos existentes y se documenta el cambio de orden de firma.**
    *Por qué:* hay selecciones y rutas en dev. El script 0014 backfillea: `Borrador` → paso inicio; `EnRevision` → paso inicio con aviso de re-envío (el orden cambió a GG→GV y las firmas viejas con orden GV→GG no son trasladables sin reinterpretación); `Autorizada`/`Cerrada` → paso final. Las rutas `Confirmada` existentes → versión `Confirmada` (paso final); `Draft`/`Archivada` → versión en `Draft`/`Archivada`. Las fechas de firma actuales (`firma_gv_fecha`/`firma_gg_fecha`) se conservan como dato histórico de despliegue.

### Modelo de entidades (mejoras de esta integración)

16. **La versión de rutas es la autoridad del estado; `rutas` gana `id_ruta_version` (FK física) y conserva `version`/`estado` sincronizados.**
    *Por qué:* el join limpio a la versión se hace por FK (`rutas.id_ruta_version` → `rutas_versiones`), se conserva `version` porque ya está indexado (`IX_rutas_seleccion_version`) y lo consume la SPA, y el servicio mantiene `rutas.estado` sincronizado desde la versión para no romper consultas ni pantallas existentes. `fecha_confirmacion` se muda a la versión (semántica de agregado) y se conserva sincronizada en `rutas` porque `EquiposPareoPage` la lee.

17. **Navegación `EstadoWorkflow` al catálogo `workflow_estados` en ambas entidades (patrón OC).**
    *Por qué:* OC ya expone `IdEstado` + `virtual WorkflowEstados? Estado` (`OrdenCompra.cs:19-20`); EM necesita el nombre/color del estado del motor para la bandeja y el historial sin joins manuales. Se llama `EstadoWorkflow` porque `Estado` (string de negocio) ya existe en las entidades de EM.

18. **`IWorkflowEntity.IdUsuarioCreador` (int no nulable) se implementa de forma explícita sobre `id_usuario_creacion`.**
    *Por qué:* la convención de auditoría del módulo usa columnas nullable (`id_usuario_creacion INT NULL`) y no se cambia el esquema: `int IWorkflowEntity.IdUsuarioCreador { get => IdUsuarioCreacion ?? 0; set => IdUsuarioCreacion = value; }`, igual que OC resuelve `Id` (`OrdenCompra.cs:78`). EM siempre setea el creador al crear, así que el `0` es un fallback defensivo.

19. **Huella mínima en el código compartido del motor: un solo método obligatorio.**
    *Por qué:* verificado en el código — `WorkflowEngine.ResolveEntityContextAsync` (`WorkflowEngine.cs:361-380`) es el **único** cambio obligatorio (+2 casos del switch por `tipoEntidad`, ~10 líneas). `EjecutarAccionAsync`, las condiciones (`EvaluarCondicion` evalúa por reflexión sobre `ctx.Entidad`), `WorkflowQueryService`, `WorkflowFirmaHelper` y la bitácora son genéricos. `WorkflowReminderService` solo se toca si se activan recordatorios (post-MVP); `WorkflowService.GetMappingsAsync` es cosmético (nombre del scope en el admin). Nota: `WorkflowContext` arrastra un campo posicional `OrdenCompra Orden` que el motor nunca lee — EM pasa `null!` sin tocar el record (su limpieza queda como deuda técnica opcional).

---

## Fase 1 — Base de datos (script 0014)

> Tareas: [[tareas/00006_workflow-seleccion-y-rutas#Fase 1 — Base de datos]]
> Convenciones heredadas (script 0003/0006/0007): schema `educacion_medica`, snake_case, guards idempotentes, `MS_Description`, auditoría solo en tablas madre.

**Script `0014_20260912-1300_educacion-medica_workflow-seleccion-rutas.lefarma.sql` (solo disco; lo aplica el usuario):**

| Objeto | Qué agrega y por qué |
|---|---|
| `rutas_versiones` (nueva) | Una fila por selección + versión: `id_seleccion_mensual`, `version`, `IdTipoGerencia` (denormalizado para la condición del GV), `estado` (`Draft/Confirmada/Cancelada/Archivada`), `fecha_confirmacion` (mudada de `rutas`), `id_workflow`, `id_paso_actual`, `id_estado`, auditoría completa. `UNIQUE (id_seleccion_mensual, version)` |
| `rutas` + `id_ruta_version` | FK física a `rutas_versiones` (las filas nuevas se enlazan al generar la versión; NULL-able para histórico). Se conservan `version` (índice `IX_rutas_seleccion_version` y consumo de la SPA) y `estado`/`fecha_confirmacion` **sincronizados** desde la versión |
| `selecciones_mensuales` + columnas de workflow | `id_workflow`, `id_paso_actual`, `id_estado` (INT NULL) — patrón OC/SP para que la entidad sea `IWorkflowEntity` |
| `workflow_estados` | **Sin estados nuevos**: el seed reutiliza los existentes con la convencion del workflow de OC — `CREADA` (inicio), `REVISION` (firmas), `PREPARACION` (revision de costos CA), `REVISION_DIRECTOR` (autorizacion DC), `APROBACION` (final), `CANCELADA` (cancelada) |
| `workflow_scope_types` (seed) | Scope `TIPO_GERENCIA` ("Tipo de gerencia (Educación Médica)", prioridad 20) — necesario para crear los mappings desde el frontend |
| `workflows` (seed ×4) | Dos variantes por fase con código base compartido: `EDUCACION_MEDICA_SELECCION` ("Selección mensual - IMSS" / "- Descentralizado") y `EDUCACION_MEDICA_RUTAS` ("Rutas - IMSS" / "- Descentralizado"); el mismo valor se usa como `tipoEntidad` del motor |
| `workflow_mappings` | **Manual en el admin de workflows** (4 mappings, scope `TIPO_GERENCIA`): selección/rutas × 1 = IMSS, 2 = Descentralizado |
| `workflow_pasos` (seeds) | Selección: Inicio → Firma GG → Firma GV IMSS / Firma GV Desc. (condicionales) → Autorizada. Rutas: Draft → Firma GV (condicional) → Revisión CA → Autorización DC → Confirmada |
| `workflow_acciones` (seeds) | `ENVIAR`, `AUTORIZAR` (con destino final por condición), `DEVOLVER` (a Borrador/Draft con comentario obligatorio), `CANCELAR` (rutas) |
| `workflow_participantes` | **Manual en el admin de workflows del frontend** (GG, GV IMSS, GV Descentralizado, CA, DC). *Advertencia:* mientras un paso de firma no tenga participantes, el motor permite firmar a cualquier usuario autenticado |
| `workflow_condiciones` | **No se usan**: los workflows por gerencia son lineales (el ruteo vive en el mapping) |
| Backfill | **Eliminado del script**: el workflow se asigna al enviar a revision (seleccion) y al generar la propuesta (rutas) |

## Fase 2 — Backend

> Tareas: [[tareas/00006_workflow-seleccion-y-rutas#Fase 2 — Backend]]

| Pieza | Qué hace |
|---|---|
| `Shared/Constants/CodigoProceso.cs` | Constante del proceso `EDUCACION_MEDICA` + constantes de `tipoEntidad` (`EDUCACION_MEDICA_SELECCION` / `EDUCACION_MEDICA_RUTAS`) |
| Resolución de workflow | `ResolveWorkflowIdAsync(EDUCACION_MEDICA_SELECCION / _RUTAS, { TIPO_GERENCIA: idTipoGerencia })` — el mapping elige la variante por gerencia. Constante `WorkflowScope.TIPO_GERENCIA`; error claro si falta el tipo de gerencia o el mapping |
| `WorkflowEngine.ResolveEntityContextAsync` — **único cambio obligatorio en código compartido** | +2 casos del switch por `tipoEntidad`: cargar `SeleccionMensual` / `RutaVersion` por id (hoy solo conoce OC y SP). `WorkflowReminderService` queda post-MVP (su switch no estorba mientras no haya recordatorios configurados) |

| `SeleccionMensual` (entidad existente) | Implementa `IWorkflowEntity` con impl explícita de `Id` e `IdUsuarioCreador` (`id_usuario_creacion ?? 0`, decisión 18) + propiedades `IdWorkflow`/`IdPasoActual`/`IdEstado` + navegación `EstadoWorkflow` (decisión 17) |
| `RutaVersion` (entidad nueva, tabla `rutas_versiones`) | Implementa `IWorkflowEntity`; expone `IdTipoGerencia` (condición del GV) y navegación `EstadoWorkflow`; sus filas `rutas` se enlazan por `id_ruta_version` |
| `SeleccionMensualService` | `enviar-revision` ejecuta `ENVIAR` por el motor; nuevo `FirmarAsync(idAccion, comentario)` que valida participante + `hasFirma` (vía `IProfileService`), ejecuta la acción y sincroniza `estado` y `firma_gv_fecha`/`firma_gg_fecha`; `DEVOLVER` regresa a Borrador y limpia firmas |
| `RutasService` | `generar` crea la fila de `rutas_versiones` y arranca el workflow; `FirmarAsync` recorre GV→CA→DC; la acción final de DC marca `Confirmada` y publica asignaciones; `CANCELAR` libera regenerar; regenerar solo si la versión activa está en `Draft`/`Cancelada` |
| Endpoints (por entidad) | `GET .../acciones-disponibles`, `POST .../firmar {idAccion, comentario}`, `GET .../historial` (reutilizan `WorkflowQueryService`: acciones por usuario, metadata de campos, bitácora) |
| Bandeja | `GET /api/educacion-medica/aprobaciones/pendientes` — selecciones y versiones de rutas en pasos intermedios donde el usuario es participante |
| Pruebas unitarias | Orden GG→GV (GV antes de GG → rechazado); no-participante → rechazado; `DEVOLVER` con comentario regresa a Borrador y limpia firmas; condición de gerencia enruta al GV correcto; cadena completa GV→CA→DC confirma y publica; sin firma digital → rechazado; regenerar con versión en firma → rechazado; backfill no rompe consultas existentes |

## Fase 3 — Frontend

> Tareas: [[tareas/00006_workflow-seleccion-y-rutas#Fase 3 — Frontend]]

| Pantalla | Cambios |
|---|---|
| `SeleccionMensualPage` | Los botones hardcodeados "1. Firma Gerente de Ventas / 2. Firma Gerencia General" se reemplazan por las **acciones disponibles** del workflow (GG primero, luego GV de la gerencia); modal de firma con comentario obligatorio al devolver y bloqueo si falta firma digital (`hasFirma` + `SignatureAlert`); el resumen imprimible etiqueta GG→GV |
| `RutasPage` | "Confirmar rutas" se convierte en **"Enviar a autorización"**; badges de la versión: `Draft`, `Pendiente: GV`, `Pendiente: CA`, `Pendiente: DC`, `Confirmada`; solo editable en Draft; devolución visible con motivo; cancelación con motivo |
| `BandejaAprobacionesPage` | Sustituye el wireframe por implementación real: pendientes del usuario (documento, solicitante, pendiente con, estado, acción Firmar), detalle con resumen y modal de firma (patrón RH: `SolicitudFirmaTab`/`SolicitudFirmaModal`); guard de permisos y menú |
| `educacionMedica.api.ts` / types | Endpoints y tipos nuevos (acciones disponibles, firmar, historial, pendientes) |

### Permisos (complementan ADR-00001 §3.2 y ADR-00004)

| Permiso existente (ADR-00004) | Uso con workflow |
|---|---|
| `educacion_medica.selecciones.puede_autorizar` | Gating de UI para mostrar el botón Firmar; el control duro lo hace el motor (participante del paso) |
| `educacion_medica.rutas.puede_planificar` | Editar el Draft y enviar a autorización |
| `educacion_medica.rutas.puede_confirmar` | (Se sustituye por la participación del paso DC) |
| Nuevos códigos `educacion_medica.*` | **Pendiente de definir con el área** si se siembran permisos o el acceso queda solo por participación del workflow (hoy EM no tiene permisos sembrados) |

## Fase 4 — Verificación y cierre

- Prueba E2E manual con usuarios distintos: CEM crea y envía selección → GG firma → GV de la gerencia firma → `Autorizada` → generar rutas → planificador envía → GV firma → CA revisa → DC autoriza → `Confirmada` y asignaciones publicadas.
- `dotnet test` (suite completa en verde) y `npm run build`.
- Sincronizar `reglas-negocio.md` (TO-BE §5 y §4.2 D4/D6), `Propuesta final de rediseño—Planificación de rutas.md` (estados/CTA) y marcar este ADR como `Accepted` al aprobarse.

---

## Validación contra la operación documentada

| Regla implementada | Fuente documental (cita literal) |
|---|---|
| GG firma primero y solicita la firma de los GV | `Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` (IDT-003) §5.1.3 — *"Al final de la reunión firma los formatos de cada gerencia y solicita a los Gerentes de ventas que firmen su respectivo formato."* (actor: Gerente General) |
| GV concentra y firma | Ídem §5.2.3 — *"Si todo está bien los concentra en una sola matriz, firma el formato y lo envía por correo electrónico el día 15 de cada mes al Auxiliar Administrativo de Educación Médica."* |
| Corrección por devolución, no rechazo terminal | Ídem §5.2.3 — *"De lo contrario contacta al Ejecutivo de Ventas para corregir la información registrada en el formato."* |
| CA revisa costos y firma; DC autoriza | `Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` (IDT-004) §5.2 — *"Recibe la matriz y revisa que todos los costos estén de acuerdo a las políticas establecidas. Si todo está bien firma la Matriz y la envía inmediatamente por correo electrónico a Dirección Corporativa para su autorización."* (actor: Coordinador Administrativo) |
| Firma operativa del GV sobre el concentrado (FOR-005) | `reglas-negocio.md` §4.4 (FOR-005) — *"GV firma el concentrado; CA firma revisión de costos; DC autoriza"* (citando IDT-003 §5.2.2 e IDT-004 §5.1–5.2) |
| Firma GG + GV de la selección (FOR-004) | Ídem §4.4 (FOR-004) — *"GG firma y GV firma su formato"* |

**Reglas de diseño sin fuente en el papel** (marcadas como *interpretación/operación real*, validadas con el área el 2026-09-12): orden GG→GV (el instructivo lo enuncia pero no lo numera como secuencia obligatoria); cadena GV→CA→DC aplicada a la planeación de rutas digitales aunque el FOR-006 (calendario) no traiga firma documentada (`reglas-negocio.md` §4.5); firma digital como requisito (estándar interno de OC/RH, no del papel).

## Consequences

**Positivas**
- Se cierra el hueco de seguridad actual: la firma deja de ser un campo del request y la valida el motor contra participantes configurados.
- Auditoría completa: `workflow_bitacora` registra quién firmó, cuándo, con qué comentario y sobre qué paso; el historial es consultable por API y UI.
- La configuración (pasos, participantes, condiciones) se administra sin recompilar; activar notificaciones y recordatorios es configuración futura, no desarrollo.
- La bandeja de autorizaciones deja de ser wireframe y se alinea al patrón RH ya probado.
- La versión de rutas con historia propia habilita la trazabilidad "quién firmó cada versión" y prepara el terreno para el workflow de talleres (Elaboró/Revisó/Autorizó).

**Negativas**
- Más piezas: una tabla nueva (`rutas_versiones`), columnas de workflow y seeds de configuración; la puesta en marcha exige los usuarios GV/GG/CA/DC y sus firmas digitales cargadas.
- La operación cambia para el usuario: la selección ya no "firma GV y luego GG" sino GG→GV, y las rutas requieren un paso explícito "Enviar a autorización" y tres firmas antes de publicar.
- Dependencia del motor compartido: cualquier cambio futuro al engine afecta también a EM (se mitiga con las pruebas unitarias nuevas).
- Los datos históricos de firma anteriores a la migración quedan como columnas informativas, no como bitácora del motor.

**Neutras / seguimiento**
- **Prerequisito operativo:** definir y cargar los usuarios de GV (IMSS y Descentralizado), GG, CA y DC, y que cada uno suba su firma digital en Perfil.
- **ADR futuro:** workflow de Talleres (FOR-005/006/007 con `taller_aprobaciones` Elaboró/Revisó/Autorizó); notificaciones por correo y recordatorios; permisos `educacion_medica.*` sembrados.
- El `POST /autorizar` legado se retira; cualquier integración externa que lo usara debe migrar a `acciones-disponibles` + `firmar` (no se identificaron consumidores fuera de la SPA).

## Anexo — Fuentes

**Justificación de esquema (por qué tabla nueva y no campos complementarios):**

| Criterio | Campos en `rutas` (cada fila) | Campos en `selecciones_mensuales` | Tabla nueva `rutas_versiones` |
|---|---|---|---|
| Identidad única para el motor (`idEntidad`) | ✗ 6 filas por versión → "ruta representante" frágil | ~ 1 fila, pero ya ocupada por la cadena GG→GV | ✓ una fila por versión |
| Bitácora | ✗ fragmentada en 6 filas | ✗ mezclada con la historia de la selección | ✓ inequívoca (`RUTAS_VERSION` + id) |
| Regenerar (v2 → v3) | ~ resets manuales en 6 filas | ✗ sobrescribe: pierde quién firmó v2 | ✓ instancia limpia por versión |
| Bandeja | ✗ 6 items por versión | ~ | ✓ 1 item: "Rutas v2, pendiente GV" |
| Churn en lo existente | medio (sync de 6 filas) | medio | **bajo (100% aditivo)** |

La única alternativa de "sustitución" equivalente sería refactorizar `rutas` a modelo cabecera-detalle (una fila por versión + tabla hija por equipo): mismo resultado que agregar `rutas_versiones`, con migración de filas, renombres, cambios en `rutas_visitas`, queries, SPA y tests — churn mayor sin ganancia funcional. Decisión: aditivo.

**Documentos fuente (operación en papel):**
- `referencias/pdf-to-md/Instructivos/Selección Mensual de Hospitales para Talleres Médicos.md` (IDT-003) §5.1.3 (firma GG y solicita GV), §5.2.3 (GV concentra y firma).
- `referencias/pdf-to-md/Instructivos/Solicitud y Entrega de Materiales para Talleres Médicos.md` (IDT-004) §5.2 (CA revisa costos, firma y DC autoriza).
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-004 Selección de Hospitales para Talleres Médicos.md` (FOR-004) — firma GG + GV.
- `referencias/pdf-to-md/Formularios/ASK-CEM-FOR-005 Matriz de Talleres Médicos.md` (FOR-005) — firmas GV + CA + DC.

**Planificación interna (no son fuentes documentales, son decisiones propias):**
- `reglas-negocio.md` §4.1–4.2 (D4, D6), §4.4 (formularios y firmas operativas), §4.5 (vacíos: FOR-006 sin firma).
- `decisiones/00004_reparto-y-planificacion-rutas.md` — decisión 12 (estados separados selección/rutas), tabla de permisos.
- `decisiones/00001_esquema-datos-educacion-medica.md` — §1.2.10 `taller_aprobaciones` (pie de firmas del taller, insumo del ADR futuro), permisos base.
- `tareas/00001_esquema-datos-educacion-medica.md` — planeación original de la Bandeja de Autorizaciones (`GET /aprobaciones/pendientes`).
- Revisión técnica del motor (2026-09-12): `Features/Config/Engine/WorkflowEngine.cs`, `WorkflowResolver.cs`, `WorkflowQueryService.cs`, `WorkflowFirmaHelper.cs`, `Shared/Constants/CodigoProceso.cs`, integraciones de OC (`OrdenCompraFirmasService`) y RH (`SolicitudPersonalFirmasService`).
- `lefarma.database/legacy/025_workflow_scopes_categoria_tipo_solicitud.sql` — procedimiento y precedente para agregar scope types y mappings (mismo mecanismo usado para el scope `TIPO_GERENCIA`).
- Entidades y configuraciones inspeccionadas (2026-09-12): `Domain/Entities/EducacionMedica/{SeleccionMensual,Ruta,RutaVisita}.cs`, `Infrastructure/Data/Configurations/EducacionMedica/{SeleccionMensualConfiguration,RutaConfiguration}.cs`, `Domain/Entities/Operaciones/OrdenCompra.cs` y `Domain/Interfaces/Config/IWorkflowEntity.cs` (patrón `IWorkflowEntity`, `IdEstado` + navegación `WorkflowEstados`).
- Acuerdos con el área (2026-09-12): alcance selección + rutas; orden GG→GV; cadena GV→CA→DC; firma digital obligatoria; diseño final (2026-09-15): workflow por gerencia + mappings (scope `TIPO_GERENCIA`).
