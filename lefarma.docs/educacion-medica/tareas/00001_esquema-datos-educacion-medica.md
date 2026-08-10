# Tareas — 00001 Esquema de datos del módulo Educación Médica

> Vinculada a: [[decisiones/00001_esquema-datos-educacion-medica]]
> Misma división por fases que la decisión: 0 Planificación, 1 Base de datos, 2 Backend, 3 Frontend.

## Fase 0 — Planificación

- [x] Documentar procesos de negocio (ASK-CEM-DDP-001, ASK-VEN-DDP-001) en pdf-to-md
- [x] Extraer formularios FOR-002…008 a `referencias/pdf-to-md/`
- [x] Digitalizar FOR-004 y FOR-007 desde los anexos de IDT-003/IDT-004 (no tenían PDF propio) → `referencias/pdf-to-md/Formularios/`
- [x] Redactar propuesta del módulo (ahora integrada en la decisión 00001)
- [x] Decidir: schema propio, catálogos Asokam por FK lógica, 11 tablas
- [x] Crear ADR 00001 y sus tareas

## Fase 1 — Base de datos

### 1.1 Schema `educacion_medica` (script 0002)

- [x] Crear script `0002_..._create-schema.lefarma.dev.prod.sql`
- [x] Ejecutar `0002_..._create-schema` en **LefarmaDev** (dev)
- [x] Ejecutar `0002_..._create-schema` en **Lefarma** (prod)

### 1.2 Catálogo + tablas operacionales (script 0003)

- [x] Crear script `0003_..._create-tablas-operacionales.lefarma.sql` (catálogo `tipo_gerencia` + 11 tablas)
- [x] Validar contra Asokam (solo lectura): `tipo_gerencia` NO existe → catálogo propio; `zona`/`genEstadosCat`/`clues`/`ciudad` sí existen; municipio NO → captura propia
- [x] Convención de nombres: columnas `id_*` (no `codigo_*`), `fecha` (no `anio`), gerencia como FK física al catálogo
- [x] Documentar con `MS_Description` (schema, tablas y columnas)
- [ ] Ejecutar `0003_..._create-tablas-operacionales` en **LefarmaDev**
- [ ] Validar en dev: columnas PERSISTED (AT/AG/AR/AE/AS/MO/MNO), CHECK `estado`, UNIQUE `id_taller`, catálogo `tipo_gerencia` sembrado, `MS_Description` visibles en SSMS
- [ ] Ejecutar `0003_..._create-tablas-operacionales` en **Lefarma** (prod)

### 1.3 Índices para FKs lógicas (script 0004)

- [ ] Crear script `0004_..._create-indices-fks-logicas.lefarma.sql` con índices en `id_hospital`, `id_producto`, `id_ejecutivo`, `id_especialista`, `id_usuario_creacion/modificacion` (tablas que consultan Asokam)
- [ ] Verificar índices existentes en Asokam: `genContactosCat.codigoContacto`, `genProductosCat.codigoProducto`
- [ ] Aplicar en **LefarmaDev** y validar planes de ejecución de las consultas cross-DB
- [ ] Aplicar en **Lefarma** (prod)

## Fase 2 — Backend

### 2.1 Catálogos (Slice 1)

- [ ] Agregar 4 DbSets read-only a `AsokamDbContext` (Hospitales, Productos, Gerencias, EquiposVentas)
- [ ] POCOs en `Domain/Entities/Asokam/` + Configurations en `Infrastructure/Data/Configurations/Asokam/`
- [ ] Feature `Features/EducacionMedica/` (Talleres, ProgramasAnuales, SeleccionesMensuales)
- [ ] Servicios con validación cross-DB (FKs lógicas a Asokam, sin capa Repository)
- [ ] Permisos `educacion-medica.*` en `app.Permisos` (Asokam)
- [ ] Verificar: alta de hospital con cálculo AT/AG/AR automático

### 2.2 Taller completo (Slice 2, proceso core)

- [ ] CRUD **Programas Anuales** (FOR-003) + detalles N:M
- [ ] CRUD **Selecciones Mensuales** (FOR-004) + hospitales
- [ ] CRUD **Talleres** (FOR-005) con state machine `Borrador → Elaborado → Revisado → Autorizado → Programado → EnCurso → Realizado/Cancelado`
- [ ] Recursos polimórficos (`taller_recursos`) + costo total calculado en servicio
- [ ] Materiales 1:1 (`taller_materiales`, FOR-007)
- [ ] Asistencias 1:N (`taller_asistencias`, FOR-008)
- [ ] Aprobaciones como log (`taller_aprobaciones`: Elaboró/Revisó/Autorizó)
- [ ] Evidencias (`taller_evidencias`)
- [ ] Verificación end-to-end: crear un taller de principio a fin, firmar, registrar asistencia, calcular costo total

## Fase 3 — Frontend

### 3.1 Catálogos (Slice 1)

- [ ] Servicio `services/educacionMedica.api.ts` (cliente axios central)
- [ ] Pantalla **Hospitales** (con cálculos automáticos AT/AG/AR)
- [ ] Pantalla **Ejecutivos** (read-only desde Asokam)
- [ ] Pantalla **Productos** (read-only desde Asokam)
- [ ] Rutas en `EducacionMedicaRoutes.tsx` + entradas en `menuItems.tsx`
- [ ] Permiso hub: `baseapp.hub.puede_ver_educacion_medica` (verificado en `_registry.ts`)

### 3.2 Taller completo (Slice 2)

- [ ] Pantalla **Selección Mensual**
- [ ] Pantalla **Programa Anual**
- [ ] Pantalla **Calendario**
- [ ] Pantalla **TallerDetail** (Matriz + Asistencia + Materiales + Aprobaciones como tabs)
- [ ] Pantalla **Evidencias**
- [ ] Verificación: taller completo desde la SPA (crear → firmar → asistencia → costo)

## Fase 4 — Ventas IMSS (Slice 3) — requiere nueva decisión

> Fuera del alcance del ADR 00001. Necesita su propia decisión (00002+) y su archivo de tareas `tareas/00002_...`.

- [ ] Crear ADR 00002 — Ventas IMSS (metas, plan de trabajo, reportes, indicador)
- [ ] Definir tablas (no existen aún: metas, planes, visitas, indicador)
- [ ] Implementar por fases (espejo de Fases 2–3)
