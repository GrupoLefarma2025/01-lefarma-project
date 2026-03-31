# Phase 1 Context: Workflow Handlers + Proveedores + Foundation Entities

**Created:** 2026-03-31
**Status:** Context captured, ready for planning
**Mode:** Discuss (interactive)

---

## Phase Overview

Phase 1 adds Firma5 handler, provider approval endpoints, foundation entities (Pago, Comprobacion), and workflow seeding. This unlocks ALL subsequent phases by ensuring OCs can reach EnTesoreria state.

**Complexity:** MEDIUM (reduced from HIGH — ~70% already built)

---

## What's Already Built (no work needed)

### Backend
- WorkflowEngine + WorkflowService + WorkflowsController (full CRUD API)
- IStepHandler interface + keyed DI pattern (`AddKeyedScoped<IStepHandler, XHandler>("XHandler")`)
- Firma3Handler — validates CentroCosto + CuentaContable, applies to OC
- Firma4Handler — validates nothing (defaults), applies RequiereComprobacionPago/Gasto checkboxes
- FirmasService + FirmasController — resolves handler via KeyedService, executes engine, returns result
- Proveedor entity + DTOs + validator + service (filters by AutorizadoPorCxP) + repo + frontend page
- EstadoOC enum — ALL 12 states including EnRevisionF5, EnTesoreria, Pagada, EnComprobacion, Cerrada
- AuthorizationConstants — 8 roles (Capturista, GerenteArea, CxP, GerenteAdmon, DireccionCorp, Tesoreria, AuxiliarPagos, Administrador), 22 permissions (including Tesoreria, Comprobaciones, Workflows)
- NotificationService multi-canal (Email, Telegram, In-App/SSE)
- FileUploader + ArchivoService (entidadTipo/entidadId pattern)
- DatabaseSeeder — seeds roles + permissions + role-permission mappings
- 14 catalog entities + controllers

### Frontend
- WorkflowsList.tsx (491 lines) — CRUD with stats
- WorkflowDiagram.tsx (1160+ lines) — visual timeline + editor modal with 5 tabs
- ProveedoresList.tsx (536 lines) — CRUD with Autorizado CxP badge/checkbox
- AutorizacionesOC.tsx (825 lines) — data-driven inbox, reads acciones from API, renders based on IdPasoActual
- 11 catalog pages with routes
- DataTable, Modal, Form (React Hook Form + Zod), Badge, Button patterns

### Key Architecture Patterns
- **IStepHandler:** 2-method contract — `ValidarAsync(OrdenCompra, datos?) → string? error`, `AplicarAsync(OrdenCompra, datos?) → Task`
- **Keyed DI:** Handler registration key MUST match `HandlerKey` property AND `WorkflowPaso.HandlerKey` DB value
- **WorkflowEngine flow:** Load OC → check RequiereComentario → resolve handler → ValidarAsync → AplicarAsync → inject Total for conditions → EjecutarAccionAsync → update state
- **Dynamic routing:** `WorkflowCondicion` on `PasoOrigen` — e.g., `Total > 100000 → Firma5`
- **FirmasService.TryMapEstado:** Maps `WorkflowPaso.CodigoEstado` string to `EstadoOC` enum — already handles ALL 12 states
- **ErrorOr<T>** for service returns, **FluentValidation** for DTOs, **ApiResponse<T>** wrapper on controllers
- **WideEventAccessor** for audit logging across all services

---

## Gray Area Decisions (agreed)

### Decision 1: Skip TesoreriaHandler
- **Rationale:** State transitions happen automatically via `WorkflowPaso.CodigoEstado`. When Firma5 approves, the engine routes to "Tesoreria" paso with `CodigoEstado="EnTesoreria"`. `FirmasService.TryMapEstado` already maps it to `EstadoOC.EnTesoreria`. No handler needed for a pure state transition.
- **Action:** Do NOT create TesoreriaHandler. No DI registration. The "Tesoreria" workflow paso has `HandlerKey = null`.

### Decision 2: ComprobacionHandler as stub
- **Rationale:** Comprobaciones are Phase 3, but the workflow paso needs a HandlerKey in Phase 1 seeding. Create stub now so DI registration and seeding are consistent.
- **Action:** Create `ComprobacionHandler` with `ValidarAsync → null`, `AplicarAsync → Task.CompletedTask`. Register in DI. Implementation comes in Phase 3.

### Decision 3: Test AutorizacionesOC for Firma5
- **Rationale:** AutorizacionesOC.tsx is data-driven — it fetches available actions via `GET /api/ordenes/{id}/acciones` based on `IdPasoActual`. If workflow seeding creates the Firma5 paso correctly, the existing page should render Firma5 actions automatically. No frontend change needed.
- **Action:** Do NOT modify AutorizacionesOC.tsx. After seeding, test that Firma5 renders correctly. If it doesn't work, THEN create a targeted fix — not a new page.

### Decision 4: DatabaseSeeder extension for workflow seeding
- **Rationale:** Workflow data IS configuration data, just like roles and permissions. Extending `DatabaseSeeder` with `SeedWorkflowAsync()` follows the existing pattern — idempotent, runs on startup, ensures fresh dev environments always have the correct workflow.
- **Action:** Add `SeedWorkflowAsync()` to `DatabaseSeeder.cs`. Seed: WorkflowConfig (ORDEN_COMPRA), Pasos (Firma1-5, Tesoreria, Comprobacion), Acciones (Autorizar, Rechazar per paso), Condiciones (Total > threshold → Firma5), Participantes (role mapping per paso), Notificaciones.

### Decision 5: Provider approval in ProveedoresController
- **Rationale:** Two new endpoints keeps it simple. Audit trail via WideEventAccessor (existing pattern). Notifications via NotificationService (existing).
- **Action:** Add `POST /api/catalogos/Proveedores/{id}/autorizar` and `POST /api/catalogos/Proveedores/{id}/rechazar` to existing `ProveedoresController`. New service methods `AutorizarAsync(id, idUsuario)` and `RechazarAsync(id, motivo, idUsuario)` in `ProveedorService`. Frontend: Add "Autorizar"/"Rechazar" buttons to ProveedoresList.tsx for CxP role.

---

## Implementation Scope

### Backend (NEW work)
1. **Firma5Handler** — IStepHandler for DireccionCorp approval (pure approval, no extra data). Follows Firma4 pattern (no validation, no data application).
2. **ComprobacionHandler** — Stub handler for Phase 3.
3. **3 DI registrations** in Program.cs: Firma5Handler + ComprobacionHandler + update handler resolution comment.
4. **Workflow seeding** — `SeedWorkflowAsync()` in DatabaseSeeder. Insert default ORDEN_COMPRA workflow with all pasos, acciones, condiciones, participantes.
5. **Provider approval endpoints** — Autorizar + Rechazar in ProveedoresController + service methods.
6. **New permissions** — `Proveedores.Autorizar` + `Proveedores.Rechazar` in AuthorizationConstants + seeding.
7. **Pago entity** — `Domain/Entities/Operaciones/Pago.cs` + `EstadoPago` enum + EF config + repository (foundation for Phase 2).
8. **Comprobacion entity** — `Domain/Entities/Operaciones/Comprobacion.cs` + `TipoComprobacion` + `EstadoComprobacion` enums + EF config + repository (foundation for Phase 3).
9. **EF migration** — Create Pago + Comprobacion tables.
10. **Register all** in Program.cs DI.

### Frontend (NEW work)
1. **Provider approval buttons** — "Autorizar" / "Rechazar" actions in ProveedoresList.tsx for CxP role, conditional on `AutorizadoPorCxP === false`.
2. **Rechazar dialog** — Modal with motivo field (required) for rejection.
3. **Notification feedback** — Toast on success/error via Sonner.
4. **Test Firma5** — Verify AutorizacionesOC renders Firma5 actions after seeding.

---

## Requirements Mapping

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| WORK-01 | Pending | Firma5Handler + workflow seeding |
| WORK-02 | Pending | Automatic via engine — Firma5 approval routes to Tesoreria paso with CodigoEstado=EnTesoreria |
| WORK-03 | Pending | Workflow seeding with conditions — configurable via WorkflowDiagram editor |
| PROV-01 | Validated | Already built |
| PROV-02 | Pending | Autorizar endpoint + service + frontend buttons |
| PROV-03 | Pending | Rechazar endpoint + service + frontend dialog |
| CONF-01 | Mostly Done | WorkflowDiagram editor — only seeding needed |
| CONF-02 | Pending | Deferred — not in Phase 1 scope (Gerente Admon catalog approval) |

---

## Out of Scope for Phase 1

- TesoreriaHandler (not needed — engine handles state transition)
- AutorizacionesOC.tsx modifications (data-driven, should work after seeding)
- CONF-02 (Gerente Admon catalog approval — separate concern)
- Bancos/MedioPago frontend (Phase 2 prerequisite)
- Pago/Comprobacion services (just entities + repos in Phase 1)
- Any UI for workflow seeding (DatabaseSeeder handles it)

---

## Dependencies

- None — this is the first phase
- Uses existing: WorkflowEngine, IStepHandler, FirmasService, NotificationService, DatabaseSeeder, WideEventAccessor

---

## Key Files to Create/Modify

### New Files
- `Features/OrdenesCompra/Firmas/Handlers/Firma5Handler.cs`
- `Features/OrdenesCompra/Firmas/Handlers/ComprobacionHandler.cs`
- `Domain/Entities/Operaciones/Pago.cs`
- `Domain/Entities/Operaciones/EstadoPago.cs`
- `Domain/Entities/Operaciones/Comprobacion.cs`
- `Domain/Entities/Operaciones/TipoComprobacion.cs`
- `Domain/Entities/Operaciones/EstadoComprobacion.cs`
- `Domain/Interfaces/Operaciones/IPagoRepository.cs`
- `Domain/Interfaces/Operaciones/IComprobacionRepository.cs`
- `Infrastructure/Data/Configurations/Operaciones/PagoConfiguration.cs`
- `Infrastructure/Data/Configurations/Operaciones/ComprobacionConfiguration.cs`
- `Infrastructure/Data/Repositories/Operaciones/PagoRepository.cs`
- `Infrastructure/Data/Repositories/Operaciones/ComprobacionRepository.cs`
- `Features/Catalogos/Proveedores/DTOs/AutorizarProveedorRequest.cs`
- `Features/Catalogos/Proveedores/DTOs/RechazarProveedorRequest.cs`

### Modified Files
- `Program.cs` — Add DI registrations (Firma5Handler, ComprobacionHandler, PagoRepository, ComprobacionRepository)
- `Infrastructure/Data/Seeding/DatabaseSeeder.cs` — Add SeedWorkflowAsync()
- `Shared/Constants/AuthorizationConstants.cs` — Add Proveedores.Autorizar + Proveedores.Rechazar permissions
- `Features/Catalogos/Proveedores/ProveedorService.cs` — Add AutorizarAsync + RechazarAsync
- `Features/Catalogos/Proveedores/ProveedoresController.cs` — Add autorizar + rechazar endpoints
- `Infrastructure/Data/ApplicationDbContext.cs` — Add DbSet<Pago> + DbSet<Comprobacion>
- `lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx` — Add approval buttons

---

*Context captured: 2026-03-31*
*Ready for: `/gsd-plan-phase 1`*
