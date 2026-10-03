# Tareas — 00007 Módulo Matriz de Talleres

> Vinculada a: [[decisiones/00007_modulo-matriz-talleres]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend, 4 Verificación y cierre.
> Complementa [[tareas/00006_workflow-seleccion-y-rutas]]: reutiliza su patrón de motor, bandeja y componentes compartidos.
> Las tablas base de talleres ya existen (script `0003_..._create-tablas-operacionales`) y **no tienen datos** en operación.

## Diagramas

> Pendientes de crear en `diagramas/` con numeración de esta decisión (`000007_<tipo>_<nombre>`), si se requieren:

- [ ] `000007_flujo_matriz_talleres.html` — captura → matriz individual → matriz general → cadena GV→AEM→CA→DC
- [ ] `000007_er_matriz_talleres.html` — `matrices_individuales` + `matrices_generales` + columnas nuevas de `talleres`
- [ ] Variantes Mermaid `.mmd`/`.svg` opcionales

## Fase 0 — Planificación

- [x] Analizar el estado actual de talleres: tablas del script 0003 (`talleres`, `taller_recursos`, `taller_materiales`, `taller_asistencias`, `taller_aprobaciones`, `taller_evidencias`), entidad `Taller` sin servicio/controlador, wireframe `TallerPage.tsx`, `MisAsignacionesPage` y bandeja existentes
- [x] Detectar que **no existe `costo_total`**: los totales se calculan con `SUM(taller_recursos.subtotal)` en servicio (ADR-00001 ya lo definía así)
- [x] Detectar el cambio de plataforma: `config.workflow_tipos_accion` ahora exige `codigo_proceso` (único por `codigo + codigo_proceso`) y `WorkflowService` valida que el tipo pertenezca al proceso del workflow (`CreateAccionAsync`/`UpdateAccionAsync`)
- [x] Detectar que **no hay endpoint para crear tipos de acción** (solo `GET tipos-accion`): los tipos EM deben sembrarse por script
- [x] Decisiones del usuario (2026-10-02): cadena según instructivos (GV → AEM → CA → DC) configurable después; matriz individual por equipo de pareo; matriz general automática por gerencia + mes; generar individual bloquea y el GV reabre
- [x] Ajustes del usuario (2026-10-02, segunda revisión):
  - [x] **Sin tipo de acción nuevo** `CONFIRMAR`: el paso AEM usa `ENVIAR`
  - [x] **Acciones EM por proceso** (`codigo_proceso`) + remapeo de los workflows EM existentes (ADR-00006)
  - [x] **Candado de edición estilo OC/Solicitudes**: editar solo en el paso inicial (`estado CREADA`), sin "Borrador" propio
- [x] Crear ADR 00007 y estas tareas
- [ ] Recolectar datos para configuración final: usuarios de **GV IMSS**, **GV Descentralizado**, **AEM**, **CA** y **DC**; confirmar que cada uno cargará su firma digital en Perfil
- [ ] Confirmar con el cliente la vigencia del paso AEM (Opción A con salvaguarda B); registrado en ADR-00007
- [ ] **Revisión del usuario de este plan y del ADR** (fase de aprobación antes de ejecutar)

## Fase 1 — Base de datos

### 1.1 Script 0015 (solo disco, sin aplicar)

- [x] Crear `0015_20261002-1200_educacion-medica_create-matriz-talleres-workflow.lefarma.sql` (idempotente, transacción única, estilo del 0014)
  - [x] **Tipos de acción EM por proceso** (guardas por `codigo + codigo_proceso`): `AUTORIZAR`, `ENVIAR`, `DEVOLVER`, `CANCELAR` para `EDUCACION_MEDICA_SELECCION`, `EDUCACION_MEDICA_RUTAS` y `EDUCACION_MEDICA_MATRIZ`
  - [x] **Remapeo idempotente**: acciones de workflows `EDUCACION_MEDICA%` cuyo tipo no pertenezca a su proceso se actualizan al tipo correcto por código
  - [x] Tabla `matrices_individuales`: `id_equipo` (FK física `equipos_pareo`), `periodo DATE` (`CHECK DAY(periodo) = 1`), `estado` (`CHECK EnCaptura|Generada`, default `EnCaptura`), `fecha_generacion`, auditoría, `UNIQUE (id_equipo, periodo)`
  - [x] Tabla `matrices_generales`: `id_tipo_gerencia` (FK física `tipo_gerencia`), `periodo DATE` (`CHECK DAY(periodo) = 1`), `id_workflow`/`id_paso_actual`/`id_estado` (FK lógicas al motor, **sin estado propio**), auditoría, `UNIQUE (id_tipo_gerencia, periodo)`
  - [x] ALTER `talleres`: `id_matriz_individual` e `id_matriz_general` (FKs `ON DELETE NO ACTION` + índices); sin tocar `estado`
  - [x] `MS_Description` en tablas nuevas y columnas nuevas
  - [x] Seed 2 variantes de `EDUCACION_MEDICA_MATRIZ`: `Matriz de talleres - IMSS` y `Matriz de talleres - Descentralizado`, lineales:
    - [x] Paso 0 `Concentración` (`CREADA`, inicio, sin firma — editable aquí)
    - [x] Paso 10 `Firma Gerente de Ventas - {Gerencia}` (`REVISION`, firma)
    - [x] Paso 20 `Registro de costos - AEM` (`PREPARACION`, sin firma; acción `ENVIAR`)
    - [x] Paso 30 `Revisión de costos - CA` (`REVISION`, firma)
    - [x] Paso 40 `Autorización - DC` (`REVISION_DIRECTOR`, firma)
    - [x] Paso 50 `Autorizada` (`APROBACION`, final)
    - [x] Acciones: `0→10 ENVIAR`, `10→20 AUTORIZAR`, `10→0 DEVOLVER`, `20→30 ENVIAR`, `20→0 DEVOLVER`, `30→40 AUTORIZAR`, `30→20 DEVOLVER`, `40→50 AUTORIZAR`, `40→30 DEVOLVER`
  - [x] **Mappings y participantes: NO van en el script** (manuales en el admin del frontend)
  - [x] Sin backfill (no hay talleres en operación)
- [x] Validar sintaxis idempotente (guards) y `PARSEONLY` contra LefarmaDev sin ejecutar
- [ ] **Revisión del usuario del script**
- [ ] Ejecutar `0015` en **LefarmaDev**
- [ ] En el **frontend (admin de workflows)**: crear los 2 mappings (`EDUCACION_MEDICA_MATRIZ` + scope `TIPO_GERENCIA`: 1 = IMSS, 2 = Descentralizado) y los participantes por paso (GV de la gerencia en 0 y 10, AEM en 20, CA en 30, DC en 40). **Advertencias:** sin participantes el paso queda abierto a cualquier usuario autenticado; sin mapping el resolver puede elegir la variante equivocada
- [ ] Validar en dev: 2 workflows visibles en el diagrama, pasos/acciones correctos, mappings y participantes configurados
- [ ] Ejecutar `0015` en **Lefarma** (prod; aplicar con el usuario)

## Fase 2 — Backend

### 2.1 Motor y entidades

- [x] `Shared/Constants/CodigoProceso.cs`: constante `EDUCACION_MEDICA_MATRIZ`
- [x] `MatrizIndividual` (entidad nueva) + configuración EF (`UNIQUE (id_equipo, periodo)`, FK física)
- [x] `MatrizGeneral` (entidad nueva, `IWorkflowEntity`): `IdWorkflow`/`IdPasoActual`/`IdEstado`, navegación `EstadoWorkflow`, expone `IdTipoGerencia`; configuración EF (`UNIQUE (id_tipo_gerencia, periodo)`)
- [x] `Taller`: +`IdMatrizIndividual`/`IdMatrizGeneral` + navegaciones; `TallerConfiguration` extendida (FKs + índices)
- [x] `ApplicationDbContext`: DbSets de matrices
- [x] `WorkflowEngine.ResolveEntityContextAsync`: +1 caso `EDUCACION_MEDICA_MATRIZ` (carga `MatrizGeneral` por id) — **único cambio obligatorio en código compartido**
- [x] Nota: `WorkflowContext` exige posicionalmente `OrdenCompra Orden` (campo muerto); EM pasa `null!` (misma deuda técnica que ADR-00006)

### 2.2 Servicios

- [x] `TalleresService` + `ITalleresService` + `TalleresController` (`api/educacion-medica/talleres`):
  - [x] `GET /mis-talleres?periodo=YYYY-MM` (equipo, matriz individual con estado/fecha, filas)
  - [x] `POST /`: valida que el usuario sea EV/EP del equipo asignado a la región del hospital (vía `selecciones_regiones.id_equipo`); deriva gerencia/mes de la selección; **get-or-create** de matriz individual y general; la general nace en el paso inicial del workflow resuelto por `TIPO_GERENCIA`; enlaza el taller
  - [x] `PUT /{id}` / `DELETE /{id}`: solo si la matriz general está en `CREADA` (paso inicial) y la individual en `EnCaptura` — mensaje estándar *"Solo se pueden editar ... en estado Creada."*
  - [x] `POST /matrices-individuales/{id}/generar` (bloquea, setea `fecha_generacion`)
  - [x] `POST /matrices-individuales/{id}/reabrir` (solo GV participante y general en `CREADA`)
- [x] `MatrizTalleresService` + `IMatrizTalleresService` + `MatrizTalleresController` (`api/educacion-medica/matrices-talleres`):
  - [x] `GET /?gerencia=&periodo=` (resumen) y `GET /{id}` (detalle: talleres, recursos, totales `SUM(subtotal)`)
  - [x] `GET /{id}/concentracion` (panel por equipo: Generada/EnCaptura)
  - [x] `PUT /{id}/talleres/{idTaller}/costos` (solo AEM, solo en el paso de costos; recalcula subtotales)
  - [x] `POST /{id}/firmar` `{idAccion, comentario}` (participante + firma digital; patrón ADR-00006); `AUTORIZAR` del DC → talleres `Autorizado`
  - [x] `GET /{id}/acciones-disponibles`, `GET /{id}/historial`, `GET /{id}/documento`
  - [x] **Salvaguarda Opción B**: la firma de `Revisión de costos - CA` exige que todos los talleres tengan al menos un recurso con `costo_unitario` capturado (error claro si no)
- [x] `AprobacionesService`: sección de matrices (tipo `matriz`) en `pendientes|mios|todos`; `PendienteAprobacionDto` += `IdMatrizGeneral`; documento *"Matriz de talleres {MM/yyyy} – {Gerencia}"*
- [x] Registro en DI (`Program.cs`) de ambos servicios

### 2.3 Pruebas

- [x] `TalleresServiceTests`: elegibilidad (miembro del equipo asignado), derivación gerencia/mes, get-or-create de matrices, candado `CREADA`, generar/bloqueo, reabrir GV
- [x] `MatrizTalleresServiceTests`: única por gerencia/mes, concentración, cadena GV→AEM→CA→DC, **CA sin costos = error**, devoluciones según tabla, sincronización a `Autorizado`
- [x] `AprobacionesServiceTests`: +2 casos (matriz en pendientes/todos)
- [x] `WorkflowTestHarness`: +2 workflows de matriz (IMSS/Descentralizado)
- [x] Test del caso nuevo de `WorkflowEngine`
- [x] `dotnet build` + `dotnet test` (suite completa) en verde (318 unit + 6 integration)

## Fase 3 — Frontend

### 3.1 API y tipos

- [x] `services/educacionMedica.api.ts`: `talleres.*` (mis-talleres, crear, actualizar, eliminar, generar, reabrir) y `matrices.*` (listar, detalle, concentración, costos, firmar, accionesDisponibles, historial, documento)
- [x] `types/educacionMedica.types.ts`: `Taller`, `TallerRecurso`, `MatrizIndividual`, `MatrizGeneral`, requests/DTOs
- [x] `components/workflows/workflowAccion.ts`: revisar etiquetas para las acciones EM por proceso (sin tipo nuevo) — `AUTORIZAR`/`ENVIAR`/`DEVOLVER`/`CANCELAR` ya cubiertos

### 3.2 Captura individual

- [x] `pages/taller/MisTalleresPage.tsx` (`/educacion-medica/talleres/mis-talleres`): cabecera (equipo EV+EP, mes), tabla de talleres, alta/edición con `TallerFormModal` (campos FOR-005 1–12), generar/reabrir, modo lectura al estar `Generada`
- [x] `pages/taller/components/TallerFormModal.tsx`
- [x] `MisAsignacionesPage`: acción **"Registrar taller"** por asignación (precarga hospital/región/selección) — incluye `IdSeleccionHospital` en `AsignacionDto` (backend)

### 3.3 Matriz general

- [x] `pages/taller/MatrizTalleresPage.tsx` (`/educacion-medica/talleres`, reemplaza el wireframe): selector gerencia/mes, panel "Matrices por equipo" (`MatricesEquipoPanel`), tabla concentrada (`MatrizTalleresTable`) con costos y Costo Total, `MatrizCostosEditor` (AEM), barra de acciones del workflow (componentes compartidos), historial, deep-link `?idMatriz=`
- [x] `pages/taller/components/MatrizPrintDocument.tsx` (imprimible general e individual, layout FOR-005)
- [x] Retirar `pages/taller/TallerPage.tsx` (wireframe superado)

### 3.4 Bandeja de Autorizaciones

- [x] `BandejaAprobacionesPage`: render del tipo `matriz` (badge, resumen en detalle: gerencia/mes/totales/equipos, acciones, historial) y deep-link "Abrir documento"
- [x] `BandejaTable`/tipos: soporte del tipo `matriz` si aplica

### 3.5 Navegación

- [x] `menuItems.tsx`: Operación → "Matriz de talleres" (`/talleres`) y "Mis talleres" (`/talleres/mis-talleres`)
- [x] `EducacionMedicaRoutes.tsx`: rutas nuevas

### 3.6 Verificación frontend

- [x] `pnpm run build` en verde
- [x] ESLint limpio en archivos nuevos/modificados
- [ ] Pruebas manuales: captura → generar → concentración → firmas → bandeja (requiere script 0015 aplicado + mappings/participantes)

## Fase 4 — Verificación y cierre

- [ ] E2E completo: EP/EV captura 2 talleres → genera matriz individual → aparece en concentración → GV envía a autorización y firma → AEM registra costos → CA bloqueado sin costos y firma con costos → DC autoriza → talleres `Autorizado`
- [ ] Devoluciones: GV→equipo (reabre captura), CA→AEM, DC→CA
- [ ] Bandeja: cada rol ve su pendiente (incluido AEM) y el deep-link abre la matriz correcta
- [ ] Imprimibles individual y general con layout FOR-005
- [ ] Sincronizar checkboxes de esta tarea y del ADR-00007
- [ ] `reglas-negocio.md`: §4.5 (reconciliación GG vs instructivos) y nueva §5.11 "Matriz de talleres (digital)"
- [ ] Registrar lecciones (entorno/principalmente el cambio de `codigo_proceso` en tipos de acción)
