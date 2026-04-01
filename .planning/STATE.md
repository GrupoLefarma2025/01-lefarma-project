# State: Lefarma CxP — Ordenes de Compra y Cuentas por Pagar

**Initialized:** 2026-03-30
**Current Phase:** Phase 1 — Context captured, ready for planning
**Overall Progress:** 2 / 35 requirements complete (PROV-01 validated, CONF-01 mostly done)

> **Updated 2026-03-31:** Code scan + Playwright audit revealed that ~70% of Phase 1 was already built.
> WorkflowEngine, IStepHandler pattern, WorkflowDiagram editor (5 tabs), Proveedor CRUD with AutorizadoPorCxP,
> and all 11 catalog pages are COMPLETE. Phase 1 scope significantly reduced.

## Phase Status

| Phase | Name | Status | Progress | Requirements |
|-------|------|--------|----------|-------------|
| 1 | Workflow Handlers + Proveedores + Foundation | Context Captured | 2/8 | WORK-01/02/03, PROV-02/03, CONF-02 (PROV-01 ✅, CONF-01 ✅) |
| 2 | Tesoreria / Pagos | Not Started | 0/7 | TES-01 through TES-07 (+ Bancos/MedioPago frontend) |
| 3 | Comprobacion de Gastos | Not Started | 0/10 | COMP-01 through COMP-10 |
| 4 | Reportes | Not Started | 0/5 | REP-01 through REP-05 |
| 5 | Integracion Contable | Not Started | 0/3 | CONT-01 through CONT-03 |
| 6 | Dashboard | Not Started | 0/2 | DASH-01, DASH-02 |

## Current Phase Detail

**Phase:** Phase 1 — Workflow Handlers + Proveedores + Foundation
**Started:** 2026-03-31
**Status:** Context captured, ready for planning
**Milestones:** 01-CONTEXT.md created with 5 gray area decisions

## Already Built (validated by code scan)

### Backend
- ✅ WorkflowEngine + WorkflowService + WorkflowsController (full CRUD API at api/config/Workflows)
- ✅ IStepHandler keyed DI pattern + Firma3Handler + Firma4Handler
- ✅ FirmasService + FirmasController (resolves handler, executes engine)
- ✅ Proveedor entity + DTOs + validator + service (filters by AutorizadoPorCxP) + repo
- ✅ EstadoOC enum with ALL 12 states (EnRevisionF5, EnTesoreria, Pagada, EnComprobacion, Cerrada)
- ✅ AuthorizationConstants — 8 roles, 12 permissions
- ✅ NotificationService multi-canal (Email, Telegram, In-App/SSE)
- ✅ FileUploader + ArchivoService (entidadTipo/entidadId pattern)
- ✅ 14 catalog entities + controllers (Empresas, Sucursales, Areas, Gastos, CentrosCosto, CuentasContables, Proveedores, FormasPago, MediosPago, Bancos, RegimenesFiscales, EstatusOrden, UnidadesMedida, Medidas)
- ✅ DatabaseSeeder — seeds roles + permissions + role-permission mappings

### Frontend
- ✅ WorkflowsList.tsx (491 lines) — CRUD with stats, search, modal
- ✅ WorkflowDiagram.tsx (1160+ lines) — visual timeline + editor modal with 5 tabs (Pasos, Acciones, Condiciones, Participantes, Notificaciones)
- ✅ ProveedoresList.tsx (536 lines) — CRUD with Autorizado CxP badge, Regimen Fiscal dropdown
- ✅ AutorizacionesOC.tsx (825 lines) — inbox with timeline, dynamic firma forms, historial
- ✅ 11 catalog pages with routes (Empresas, Sucursales, Areas, Gastos, CentrosCosto, CuentasContables, Proveedores, FormasPago, EstatusOrden, RegimenesFiscales, Medidas)
- ✅ DataTable component with filterConfig, column visibility, search
- ✅ Modal, Form (React Hook Form + Zod), Badge, Button patterns established

### Missing Catalog Frontend (needed in Phase 2)
- ❌ BancosList.tsx — backend exists, frontend missing
- ❌ MediosPagoList.tsx — backend exists, frontend missing

## Requirement Status

### Phase 1: Workflow Handlers + Proveedores + Foundation
- [x] ~~PROV-01: Providers created inline with "Sin Autorizar" flag~~ **VALIDATED** — entity + DTOs + filter + UI badge
- [x] ~~CONF-01: Admin configures firma levels via UI~~ **MOSTLY DONE** — WorkflowDiagram editor has full CRUD
- [ ] WORK-01: Firma 5 (Direccion Corporativa) approval/rejection
- [ ] WORK-02: Auto-transition to EnTesoreria after Firma 5
- [ ] WORK-03: Configurable firma levels by monto/tipo/empresa (seeding needed)
- [ ] PROV-02: CxP approves pending providers (needs dedicated endpoint)
- [ ] PROV-03: CxP rejects pending providers with reason
- [ ] CONF-02: Gerente Admon authorizes catalog contable changes

### Phase 2: Tesoreria / Pagos
- [ ] TES-01: Register payments against authorized OCs
- [ ] TES-02: Multiple partial payments until total covered
- [ ] TES-03: Auto-calculate saldo + transition to Pagada
- [ ] TES-04: Upload deposit receipt per payment
- [ ] TES-05: Notify creator per payment
- [ ] TES-06: Daily pending payments digest email
- [ ] TES-07: On-demand pending payments report

### Phase 3: Comprobacion de Gastos
- [ ] COMP-01: CFDI XML upload + auto-extraction
- [ ] COMP-02: Non-deductible receipts (manual + image)
- [ ] COMP-03: Bank deposit slip upload
- [ ] COMP-04: Gran Total calculation
- [ ] COMP-05: Gran Total >= OC Total validation
- [ ] COMP-06: Allow exceeding but not underperforming
- [ ] COMP-07: UUID duplicate detection
- [ ] COMP-08: CxP validates comprobaciones → Cerrada
- [ ] COMP-09: CxP rejects with mandatory reason
- [ ] COMP-10: Notify CxP on new comprobacion upload

### Phase 4: Reportes
- [ ] REP-01: Pending payment report
- [ ] REP-02: Pending comprobacion report
- [ ] REP-03: Filtered by usuario, antiguedad
- [ ] REP-04: Liberated comprobaciones multi-filter
- [ ] REP-05: Vendor balance aging report

### Phase 5: Integracion Contable
- [ ] CONT-01: Auto poliza generation from closed OCs
- [ ] CONT-02: CSV/XML export for external system
- [ ] CONT-03: Bank statement import + payment matching

### Phase 6: Dashboard
- [ ] DASH-01: CxP dashboard with KPIs
- [ ] DASH-02: Tesoreria dashboard with KPIs

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-30 | Reportes before Integracion Contable | Operational reports provide higher user value and don't need accounting data |
| 2026-03-30 | Foundation entities in Phase 1 (not separate) | Entities are implementation prerequisites, not user-facing phases |
| 2026-03-30 | Custom CFDI parser (no third-party) | CFDI ecosystem fragmented; built-in System.Xml.Linq safer for reading |
| 2026-03-31 | Phase 1 scope reduced from HIGH to MEDIUM | Code scan revealed ~70% already built — WorkflowEngine, diagram editor, Proveedor CRUD, all catalogs |
| 2026-03-31 | Bancos + MedioPago frontend deferred to Phase 2 | Backend exists but frontend pages missing; needed by Tesoreria module |
| 2026-03-31 | PROV-01 marked as validated | Entity flag + DTOs + service filter + UI badge/checkbox all present and working |
| 2026-03-31 | CONF-01 marked as mostly done | WorkflowDiagram.tsx editor has full CRUD for steps/actions/conditions/participants/notifications |
| 2026-03-31 | Skip TesoreriaHandler — engine handles state transition via CodigoEstado | No handler needed for pure state transition; Firma5 approval routes to Tesoreria paso |
| 2026-03-31 | ComprobacionHandler as stub in Phase 1 | Registration needed for workflow seeding consistency; implementation deferred to Phase 3 |
| 2026-03-31 | Test AutorizacionesOC for Firma5 before building new UI | Page is data-driven (reads acciones from API), should work after workflow seeding |
| 2026-03-31 | Workflow seeding via DatabaseSeeder | Follows existing pattern (idempotent, startup), workflow data IS configuration |
| 2026-03-31 | Provider approval in existing ProveedoresController | POST /{id}/autorizar + POST /{id}/rechazar endpoints, keeps architecture simple |

## Blockers

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260330-poq | Fix sidebar header in dark mode - change text to white and replace logo with .ico | 2026-03-31 | 0f7fb27 | [260330-poq-fix-sidebar-header-in-dark-mode-change-t](./quick/260330-poq-fix-sidebar-header-in-dark-mode-change-t/) |
| 260330-pyp | Quitar boton configuracion del sidebar | 2026-03-31 | 38a75a0 | [260330-pyp-quitar-boton-configuracion-del-sidebar-s](./quick/260330-pyp-quitar-boton-configuracion-del-sidebar-s/) |
| 260330-qbk | Sistema permisos dinamicos backend [HasPermission] en endpoints | 2026-03-31 | aa12521 | [260330-qbk-sistema-practico-de-permisos-hook-ui-fun](./quick/260330-qbk-sistema-practico-de-permisos-hook-ui-fun/) |
| 260401-31 | Cambiar tema por defecto a claro cuando no hay preferencias guardadas | 2026-04-01 | PENDING | [260401-31-cambiar-tema-por-defecto-a-claro](./quick/260401-31-cambiar-tema-por-defecto-a-claro/) |

Last activity: 2026-04-01 - Completed quick task 260401-31: Cambiar tema por defecto a claro cuando no hay preferencias guardadas

---

*State initialized: 2026-03-30*
*Last updated: 2026-03-31 after Phase 1 context capture*
