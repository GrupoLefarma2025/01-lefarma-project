# Tareas — 00006 Workflow de autorización (Selección mensual y Rutas)

> Vinculada a: [[decisiones/00006_workflow-seleccion-y-rutas]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend, 4 Verificación y cierre.
> Sustituye la doble firma casera de [[tareas/00004_reparto-y-planificacion-rutas]] (fase 2.2, endpoint `autorizar`) y la confirmación directa de rutas (fase 2.3, endpoint `confirmar`).

## Diagramas

> Pendientes de crear en `diagramas/` con numeración de esta decisión (`000006_<tipo>_<nombre>`), si se requieren:

- [ ] `000006_flujo_workflow_seleccion_rutas.html` — flujo de firmas de los workflows EDUCACION_MEDICA_SELECCION (GG→GV) y EDUCACION_MEDICA_RUTAS (GV→CA→DC) con condiciones por gerencia
- [ ] `000006_er_workflow_em.html` — `rutas_versiones` + columnas de workflow en `selecciones_mensuales` + tablas del motor involucradas
- [ ] Variantes Mermaid `.mmd`/`.svg` opcionales

## Fase 0 — Planificación

- [x] Analizar el motor genérico de workflow del sistema (engine, resolver, query service, firma helper, integraciones OC/RH) y la documentación del módulo (IDT-003 §5.1.3/§5.2.3, IDT-004 §5.2, reglas-negocio §4.2 D4/D6, §4.4–4.5)
- [x] Detectar el hueco de seguridad actual: `AutorizarAsync` no valida quién firma (recibe `{rol}` del request)
- [x] Acordar con el área: alcance selección + rutas; orden **GG → GV**; cadena **GV → CA → DC**; **firma digital obligatoria**; condición por gerencia dentro de cada workflow
- [x] Decisiones del usuario (2026-09-12 / 2026-09-15): diseño final **workflow por gerencia + mappings** — 4 workflows lineales con código base por fase y scope `TIPO_GERENCIA`; manual en el frontend: mappings + participantes
- [x] Decidir `rutas_versiones` como entidad autorizable del proceso de rutas
- [x] Crear ADR 00006 y sus tareas
- [x] Revisión de entidades y huella en el motor (2026-09-12): `SeleccionMensual` (existente, +3 columnas de workflow) y `RutaVersion` (nueva, tabla `rutas_versiones`); **único cambio obligatorio en código compartido = `WorkflowEngine.ResolveEntityContextAsync`**; mejoras de modelo incluidas (decisiones 16–18 del ADR: FK `rutas.id_ruta_version`, navegación `EstadoWorkflow`, `fecha_confirmacion` en la versión, impl explícita de `IdUsuarioCreador`)
- [x] **Revisión final del usuario de este plan y del ADR** (aprobado 2026-09-12; inicio de ejecución)
- [ ] Recolectar datos para el seed: usuarios de **GV IMSS**, **GV Descentralizado**, **GG**, **CA** y **DC**; confirmar que cada uno cargará su firma digital en Perfil
- [ ] Definir con el área si se siembran permisos `educacion_medica.*` o el acceso queda solo por participación del workflow (hoy el módulo no tiene permisos sembrados)
- [x] Redactar el script 0014 en disco (ver Fase 1; sintaxis validada con `PARSEONLY`, sin aplicar)

## Fase 1 — Base de datos

### 1.1 Script 0014 (solo disco, sin aplicar)

- [x] Crear `0014_20260912-1300_educacion-medica_workflow-seleccion-rutas.lefarma.sql`
  - [x] Esquema idempotente: tabla `rutas_versiones` (`id_seleccion_mensual`, `version`, `id_tipo_gerencia`, `estado` CHECK `Draft/Confirmada/Cancelada/Archivada`, `fecha_confirmacion`, `id_workflow`, `id_paso_actual`, `id_estado`, auditoría; `UNIQUE (id_seleccion_mensual, version)`) — **ya aplicado en dev por el usuario**; el bloque no hace nada si existe
  - [x] ALTER `selecciones_mensuales`: `id_workflow`, `id_paso_actual`, `id_estado` (INT NULL) — **ya aplicado en dev por el usuario**
  - [x] ALTER `rutas`: `id_ruta_version INT NULL` + FK física a `rutas_versiones` + índice — **ya aplicado en dev por el usuario**
  - [x] `MS_Description` en tablas nuevas
  - [x] **Estados: se reutilizan los EXISTENTES** del catálogo (sin crear estados EM), con la convención del workflow de OC: `CREADA` (inicio), `REVISION` (firmas), `PREPARACION` (revisión de costos CA), `REVISION_DIRECTOR` (autorización DC), `APROBACION` (final), `CANCELADA` (cancelada)
  - [x] Scope type `TIPO_GERENCIA` en el script (necesario para crear los mappings por gerencia en el frontend)
  - [x] Seed 2 variantes de `EDUCACION_MEDICA_SELECCION`: 'Selección mensual - IMSS' (Borrador → GG → GV IMSS → Autorizada) y 'Selección mensual - Descentralizado' (Borrador → GG → GV Desc. → Autorizada); acciones `ENVIAR`, `AUTORIZAR`, `DEVOLVER` — **sin condiciones** (cadenas lineales)
  - [x] Seed 2 variantes de `EDUCACION_MEDICA_RUTAS`: 'Rutas - IMSS' y 'Rutas - Descentralizado' (Draft → GV → CA → DC → Confirmada + Cancelada); acciones `ENVIAR`, `AUTORIZAR`, `DEVOLVER`, `CANCELAR` — **sin condiciones**
  - [x] Sin backfill: las selecciones/versiones existentes se enganchan al workflow al enviar a revisión / al generar la propuesta
  - [x] **Mappings y participantes: NO van en el script** — se configuran en el admin de workflows del frontend (4 mappings de scope `TIPO_GERENCIA` + participantes por paso)
- [x] Validar sintaxis idempotente (guards `OBJECT_ID`/`COL_LENGTH`/`IF NOT EXISTS`) y `PARSEONLY` contra LefarmaDev sin ejecutar
- [ ] **Revisión del usuario del script**
- [ ] Ejecutar `0014` en **LefarmaDev** (solo seed; el esquema ya está aplicado)
- [ ] En el **frontend (admin de workflows)**: crear los 4 mappings (`EDUCACION_MEDICA_SELECCION` / `EDUCACION_MEDICA_RUTAS` + scope `TIPO_GERENCIA`: 1 = IMSS, 2 = Descentralizado) y los participantes por paso (GG, GV IMSS, GV Desc., CA, DC). **Advertencias:** sin participantes el paso queda abierto a cualquier usuario autenticado; sin mapping el resolver puede elegir la variante equivocada
- [ ] Validar en dev: los 4 workflows visibles en el diagrama de admin, pasos/acciones correctos, mappings y participantes configurados
- [ ] Ejecutar `0014` en **Lefarma** (prod; aplicar con el usuario)

## Fase 2 — Backend

### 2.1 Motor y entidades

- [x] `Shared/Constants/CodigoProceso.cs`: constante del proceso `EDUCACION_MEDICA` + constantes de `tipoEntidad` para las dos entidades (`EDUCACION_MEDICA_SELECCION` / `EDUCACION_MEDICA_RUTAS`)
- [x] Resolución por gerencia en ambos servicios: `ResolveWorkflowIdAsync(EDUCACION_MEDICA_SELECCION / _RUTAS, { TIPO_GERENCIA: idTipoGerencia })`; constante `WorkflowScope.TIPO_GERENCIA`; error claro si falta gerencia o mapping
- [x] `WorkflowEngine.ResolveEntityContextAsync`: +2 casos EM (cargar `SeleccionMensual` / `RutaVersion` por id) — **único cambio obligatorio en código compartido** (verificado 2026-09-12)
- [ ] `WorkflowReminderService`: **post-MVP** — solo se toca si se activan recordatorios (su switch no estorba mientras no existan recordatorios EM)
- [x] Caso `TIPO_GERENCIA` en `WorkflowService.GetMappingsAsync` para mostrar "IMSS/Descentralizado" en el admin
- [x] `SeleccionMensual` implementa `IWorkflowEntity` (impl explícita de `Id` e `IdUsuarioCreador` con `id_usuario_creacion ?? 0`) + propiedades `IdWorkflow`/`IdPasoActual`/`IdEstado` + navegación `EstadoWorkflow` + config EF de columnas nuevas
- [x] `RutaVersion` (entidad nueva): implementa `IWorkflowEntity`, expone `IdTipoGerencia` (condición del GV) y navegación `EstadoWorkflow`; config EF (UNIQUE selección+versión, relación con `rutas` por `id_ruta_version`)
- [ ] Nota: `WorkflowContext` exige posicionalmente `OrdenCompra Orden` (campo muerto para el motor) — EM pasa `null!`; su limpieza/nullable queda como deuda técnica opcional

### 2.2 Servicios

- [ ] `SeleccionMensualService`:
  - [x] `enviar-revision` ejecuta `ENVIAR` por el motor (valida participante del paso inicial)
  - [x] `FirmarAsync(idAccion, comentario)`: valida participante + `hasFirma` (patrón OC/RH), ejecuta acción, sincroniza `estado` (Borrador/EnRevision/Autorizada) y `firma_gv_fecha`/`firma_gg_fecha`
  - [x] `DEVOLVER` con comentario obligatorio: regresa a Borrador y limpia fechas de firma
  - [x] Retirar `AutorizarAsync`/endpoint `POST /autorizar`
- [ ] `RutasService`:
  - [x] `generar` crea la fila de `rutas_versiones` (con `id_tipo_gerencia` denormalizado) y la deja en el paso Draft del workflow; regenerar solo si la versión activa está en `Draft`/`Cancelada` (nunca con firmas en vuelo)
  - [x] Sincronización versión → filas de `rutas` (`estado`, `fecha_confirmacion`) en cada transición, para no romper consultas/pantallas existentes
  - [x] `FirmarAsync`: cadena GV (condición por gerencia) → CA → DC; al completar DC marca `Confirmada` y publica asignaciones
  - [x] `DEVOLVER` regresa la versión a `Draft` (editable de nuevo) con motivo; `CANCELAR` libera regenerar
  - [x] Retirar `POST /confirmar` como endpoint suelto (pasa a ser efecto de la acción de DC)
- [x] Firma digital: bloqueo de acciones sin `hasFirma` (mismo mensaje/UX que OC/RH)

### 2.3 Endpoints y bandeja

- [x] Por entidad: `GET .../acciones-disponibles`, `POST .../firmar`, `GET .../historial` (reutilizando `WorkflowQueryService`)
- [x] `GET /api/educacion-medica/aprobaciones/documentos?filtro=pendientes|mios|todos`: selecciones y versiones de rutas con filtro por usuario (participación / creador / sin filtro); incluye documento, solicitante, pendiente-con, estado, fecha, versión de rutas, `esPendiente` y `acciones` (alias `/pendientes` conservado). Tests: `AprobacionesServiceTests` (4)
- [ ] Pruebas unitarias (Lefarma.UnitTests):
  - [x] GG→GV: GV antes de GG rechazado
  - [x] No-participante rechazado en cada paso (selección y rutas)
  - [x] La gerencia determina el workflow (routing por scope `TIPO_GERENCIA`): flujo completo IMSS y flujo Descentralizado
  - [x] `DEVOLVER` con comentario regresa a Borrador/Draft y limpia firmas
  - [x] Cadena completa de rutas GV→CA→DC confirma y publica asignaciones
  - [x] Sin firma digital → rechazado
  - [x] Regenerar con versión en firma → rechazado
  - [x] Sincronización `rutas_versiones` → `rutas` (`estado` y `fecha_confirmacion`) en cada transición
  - [ ] `acciones-disponibles` respeta paso actual y participante (cubierto indirectamente por el harness del motor)
  - [ ] Bandeja `pendientes` lista solo lo que a cada usuario le toca firmar
  - [x] Suite completa en verde (mínimo: 160 actuales + nuevos)

## Fase 3 — Frontend

### 3.1 API y tipos

- [x] `educacionMedica.api.ts`: acciones disponibles, firmar, historial (selección y rutas), pendientes
- [x] `educacionMedica.types.ts`: tipos de acción disponible, historial, pendiente de bandeja, `RutaVersion`

### 3.2 Selección mensual

- [x] `SeleccionMensualPage`: reemplazar botones hardcodeados por acciones del workflow (GG primero, luego GV de la gerencia)
- [x] Modal de firma: comentario obligatorio en `DEVOLVER`; bloqueo con aviso si falta firma digital (`hasFirma` + `SignatureAlert`)
- [x] Estado bloqueado (solo lectura) tras enviar a revisión; mensaje "quien firma no edita"
- [x] `ResumenSeleccionModal`: etiquetas de firma según orden GG→GV y fechas sincronizadas

### 3.3 Rutas

- [x] `RutasPage`: `Confirmar rutas` → `Enviar a autorización`; badges `Draft / Pendiente: GV / Pendiente: CA / Pendiente: DC / Confirmada`
- [x] Solo editable en Draft; devolución visible con motivo; cancelación con motivo
- [ ] Selector de versión mostrando estado de autorización de cada versión

### 3.4 Bandeja de Autorizaciones (operativa de pendientes)

- [x] Sustituir wireframe `BandejaAprobacionesPage` por implementación real (patrón RH: fila por pendiente, botón Firmar, modal con acciones y comentario)
- [x] Detalle del pendiente: resumen (selección: gerencia/vigencia/hospitales/regiones/firmas; rutas: versión/paso/equipos/hospitales planificados/visitas), acciones del paso e historial (bitácora)
- [x] Componentes compartidos: `WorkflowAccionesPanel`, `WorkflowAccionModal` (comentario obligatorio al devolver) y `WorkflowHistorial` — usados por la bandeja y por Selección/Rutas (misma vía de endpoints y reglas del motor)
- [x] Deep-link al documento: selección con `?idSeleccion=` (preselección implementada) y rutas por la ruta con id
- [x] Tab **"Todos los documentos"** (bandeja con dos tabs estilo RH: *Pendientes* | *Todos*). Un solo endpoint con filtro: `GET /aprobaciones/documentos?filtro=pendientes|mios|todos` (`pendientes` default; `mios` soportado en backend para una futura tab "Mis documentos"); alias `/pendientes` conservado. El listado "todos" marca "Pendiente de tu firma" y permite detalle/acciones cuando aplican
- [ ] Guard de permisos `educacion_medica.*` — **diferido** (decidido; hoy el acceso se rige por participación en el workflow)

## Fase 4 — Verificación y cierre

- [x] `dotnet test` completo en verde
- [x] `npm run build` en verde
- [ ] Prueba E2E manual con usuarios distintos (CEM, GG, GV IMSS, GV Desc., CA, DC): selección → firma GG → firma GV → generar rutas → enviar → firma GV → revisión CA → autorización DC → publicada en Mis asignaciones
- [ ] Sincronizar `reglas-negocio.md` (TO-BE §5; §4.2 D4/D6 con el sistema digital) y `Propuesta final de rediseño—Planificación de rutas.md` (estados y CTA de confirmación)
- [ ] Marcar ADR-00006 como `Accepted` y actualizar [[tareas/00004_reparto-y-planificacion-rutas]] (nota de que la doble firma/confirmación migró al workflow)

---

## Explicación de lo que haremos (lenguaje llano)

**El problema que resolvemos.** Hoy la "doble firma" de la selección mensual es un botón que cualquiera puede apretar: el sistema no verifica que quien firma sea realmente el Gerente General o el Gerente de Ventas. Además, no queda un historial formal de quién firmó, cuándo y con qué comentario; y las rutas se "confirman" sin que nadie las firme.

**La solución.** Usar el mismo motor de flujo de aprobaciones que ya usan Órdenes de Compra y Solicitudes de Personal. Ese motor funciona con "pasos" configurables: cada paso dice quién puede firmar, qué acciones hay (aprobar, devolver), y deja registro en una bitácora. Para Educación Médica se registra **un solo proceso llamado `EDUCACION_MEDICA`**, que internamente rutea a dos flujos según la fase (el sistema lo decide solo; para ti es un proceso con dos etapas):

**Flujo 1 — Selección mensual (el FOR-004).**
1. El coordinador arma la selección y la envía a revisión (hasta ahí puede editarla; después ya no).
2. **Primero firma el Gerente General** (así lo dice el instructivo).
3. Después firma **el Gerente de Ventas de la gerencia correspondiente** (si la selección es de IMSS, firma el GV de IMSS; si es de Descentralizados, el GV de Descentralizados — el sistema lo manda automáticamente al paso correcto).
4. Al completarse ambas firmas, la selección queda **Autorizada** y se pueden generar rutas.
5. Si GG o GV no está de acuerdo, **devuelve con un comentario obligatorio** y la selección regresa a Borrador para corregirse (así funciona en el papel: "contacta al Ejecutivo para corregir").

**Flujo 2 — Rutas (la planeación de visitas).**
1. El planificador genera la propuesta (como hoy) y la puede editar mientras está en borrador.
2. Cuando termina, la **envía a autorización** (ya no se edita más).
3. **Firma el Gerente de Ventas** de la gerencia (mismo mecanismo de arriba).
4. **Revisa y firma el Coordinador Administrativo** (la revisión de costos del instructivo).
5. **Autoriza Dirección Corporativa** — con esta firma las rutas quedan **Confirmadas** y se publican las asignaciones a los Ejecutivos de Venta.
6. Igual que en la selección: cualquier firmante puede devolver con motivo, y eso regresa a borrador para corregir.

**Detalles importantes para quien opera:**
- **Toda firma requiere firma digital**: cada firmante debe subir su imagen de firma en su Perfil (igual que ya se hace en Órdenes de Compra). Sin ella, el sistema no deja firmar.
- **Quien firma no edita**: en cuanto algo se envía a revisión, se congela; solo se cambia devolviéndolo.
- **Bandeja de Autorizaciones**: la pantalla que hoy es un dibujo de ejemplo se vuelve real: cada usuario ve ahí únicamente lo que a él le toca firmar, con un botón para revisar y firmar.
- **Nada se pierde**: cada paso queda en un historial consultable (quién, cuándo, comentario). Las versiones anteriores de rutas conservan su propia historia.
- **Lo que NO cambia**: el resto de pantallas y datos siguen igual (los estados Borrador/Autorizada/Draft/Confirmada se mantienen); lo que cambia es cómo se llega a ellos.
- **Lo que se necesita antes de arrancar**: los usuarios reales de GV IMSS, GV Descentralizado, GG, CA y DC, y que cada uno suba su firma digital.
