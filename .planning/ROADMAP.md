# Roadmap: Lefarma CxP — Ordenes de Compra y Cuentas por Pagar

**Created:** 2026-03-30
**Core Value:** El flujo completo de una orden de compra — desde captura hasta cierre contable — con trazabilidad total y autorizaciones configurables.
**Total v1 Requirements:** 34
**Phases:** 6

## Build Order Rationale

The roadmap follows a strict dependency chain derived from architecture research:

```
Phase 1 (Workflow + Proveedores + Config)
  ├── Foundation: Pago + Comprobacion entities, EF configs, repos, migration
  ├── Workflow: Firma5Handler + TesoreriaHandler + ComprobacionHandler + seeding
  └── Features: Provider approval + Config UI
       │
Phase 2 (Tesoreria) ← needs EnTesoreria state from Phase 1
       │
Phase 3 (Comprobacion) ← needs Pagada state from Phase 2
       │
Phase 4 (Reportes) ← needs payment + comprobacion data from Phases 2-3
       │
Phase 5 (Integracion Contable) ← needs Cerrada state from Phase 3
       │
Phase 6 (Dashboard) ← aggregates ALL prior data
```

**Key dependency rule:** No phase can start until the prior phase's state transitions work end-to-end. The EstadoOC state machine is the backbone — each phase produces states that the next phase consumes.

---

## Phase 1: Workflow + Proveedores + Configuracion

**Goal:** Complete the authorization chain (Firma 5), provider approval workflow, and configurable firma levels. This phase unlocks ALL subsequent phases by ensuring OCs can reach EnTesoreria state.

**Requirements:** WORK-01, WORK-02, WORK-03, PROV-01, PROV-02, PROV-03, CONF-01, CONF-02 (8 total)

**Implementation Prerequisites (not user-facing requirements, but must be done first):**
- Create `Pago` entity + `EstadoPago` enum + EF config + repository
- Create `Comprobacion` entity + `TipoComprobacion` + `EstadoComprobacion` enums + EF config + repository
- Run EF migration to create new tables
- Register all new services/repositories in DI (`Program.cs`)
- Add new permissions to `AuthorizationConstants.cs`

**Backend Deliverables:**
- `Firma5Handler` — IStepHandler implementation for DireccionCorp approval (pure approval, no extra data)
- `TesoreriaHandler` — pass-through handler that transitions OC to EnTesoreria via WorkflowEngine
- `ComprobacionHandler` — validates comprobacion sum, triggers closure
- Workflow seeding — new pasos + acciones + condiciones in database
- Provider approval service — authorize/reject pending providers
- Configuration service — CRUD for workflow conditions (monto, tipo gasto, empresa)

**Frontend Deliverables:**
- Provider approval inbox page (CxP role)
- Workflow configuration page (Admin role)
- Extended AutorizacionesOC to support Firma 5 step

**Success Criteria:**
1. DireccionCorp user can approve or reject an OC at Firma 5, with mandatory rejection reason that notifies all 4 prior signers
2. OCs approved at Firma 5 automatically transition to EnTesoreria state without manual intervention
3. Admin can configure firma levels via UI — add/remove steps, set conditions by monto/tipo/empresa — and changes take effect on new OCs immediately
4. CxP can approve or reject pending providers with optional rejection reason; approved providers appear in official catalog
5. Providers created inline during OC capture appear with "Sin Autorizar" flag and are hidden from official catalog until CxP approves

**Dependencies:** None — this is the first phase. Uses existing WorkflowEngine, IStepHandler pattern, and notification infrastructure.

**Estimated Complexity:** HIGH — foundation entities + workflow handlers + provider workflow + config UI is the broadest phase. But individual pieces are straightforward following existing patterns.

---

## Phase 2: Tesoreria / Pagos

**Goal:** Enable Tesoreria to register payments (partial or total) against authorized OCs, with automatic saldo tracking and state transitions to Pagada.

**Requirements:** TES-01, TES-02, TES-03, TES-04, TES-05, TES-06, TES-07 (7 total)

**Backend Deliverables:**
- `Features/Tesoreria/` — TesoreriaService, ITesoreriaService, TesoreriaController, DTOs, Validators
- `Domain/Entities/Operaciones/Pago.cs` entity (already created in Phase 1 foundation)
- Payment registration with partial payment support
- Saldo calculation: Sum(Pago.Monto) vs OrdenCompra.Total
- Automatic state transition to Pagada when fully paid (via WorkflowEngine)
- Payment receipt file upload (via existing ArchivoService EntidadTipo/EntidadId pattern)
- Notification to OC creator on each payment
- Daily pending payments digest email to Tesoreria role

**Frontend Deliverables:**
- `PagosBandeja.tsx` — payment queue showing OCs in EnTesoreria state
- `RegistrarPago.tsx` — payment form with monto, fecha, medio pago, referencia, file upload
- `tesoreriaService.ts` + `tesoreria.types.ts`

**Success Criteria:**
1. Tesoreria user can register a payment (monto, fecha, medio de pago, referencia) against any OC in EnTesoreria state
2. Multiple partial payments can be registered against a single OC until total is covered — each payment independently tracked
3. OC automatically transitions to Pagada state when sum of registered payments equals or exceeds OC total
4. Tesoreria can upload a payment receipt (image/PDF) per payment, viewable from the payment detail
5. OC creator receives a notification (in-app + email) for each payment registered against their OC

**Dependencies:** Phase 1 complete — needs EnTesoreria state, Pago entity, TesoreriaHandler in workflow.

**Estimated Complexity:** MEDIUM — straightforward CRUD service following existing patterns. Main complexity is concurrent partial payment handling (optimistic concurrency via RowVersion).

**Critical Pitfall:** Race condition on concurrent partial payments — two Tesoreria users paying the same OC simultaneously. Mitigated by optimistic concurrency + atomic saldo validation.

---

## Phase 3: Comprobacion de Gastos

**Goal:** Enable users to upload expense verification (CFDI XML + non-deductible + bank deposit) and CxP to validate/reject, completing the verification cycle and closing OCs.

**Requirements:** COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, COMP-09, COMP-10 (10 total)

**Backend Deliverables:**
- `Features/Comprobacion/` — ComprobacionService, IComprobacionService, ComprobacionController, DTOs, Validators
- `CfdiParserService` — CFDI 4.0 XML parsing using System.Xml.Linq + XPath (no third-party CFDI libraries)
- Comprobacion entity lifecycle: Pendiente → Validada/Rechazada
- Gran Total calculation: Sum(CFDI) + Sum(NoDeducibles) + DepositoBancario
- Gran Total validation: must be >= OC.Total (can exceed, never less)
- UUID deduplication: UNIQUE constraint + service-level check with OC reference
- CxP validation gate: validate/reject with mandatory rejection reason
- Automatic OC closure when all comprobaciones validated and total covered
- Notifications: CxP on upload, creator on validate/reject

**Frontend Deliverables:**
- `SubirComprobacion.tsx` — upload zone with CFDI XML auto-extraction, non-deductible form, deposit slip form
- `ComprobacionesBandeja.tsx` — inbox for CxP to review pending comprobaciones
- `ValidarComprobacion.tsx` — CxP validation view with approve/reject actions
- `CfdiUploader.tsx` — specialized XML upload component with auto-preview of extracted data
- `comprobacionService.ts` + `comprobacion.types.ts`

**Success Criteria:**
1. User uploads a CFDI XML file and the system automatically extracts and displays UUID, RFC emisor/receptor, total, subtotal, IVA, retenciones, and fecha — no manual data entry required
2. User uploads a non-deductible receipt with manual monto entry + receipt image, and a bank deposit slip with manual importe — all three comprobacion types work independently
3. System calculates Gran Total and rejects submission if it's less than OC importe — displays clear error with the shortfall amount
4. System detects duplicate CFDI by UUID and rejects with message indicating which OC already registered that UUID
5. CxP can validate a comprobacion (transitioning it to Validada) or reject it with mandatory reason — rejected comprobacion notifies the user to correct

**Dependencies:** Phase 2 complete — comprobantes are uploaded AFTER payment. Needs Pagada state. Needs Comprobacion entity from Phase 1 foundation.

**Estimated Complexity:** HIGH — CFDI XML parsing is the single highest-complexity feature (encoding issues, namespace handling, CFDI 3.3 vs 4.0). Also the largest requirement set (10 reqs).

**Critical Pitfalls:**
- CFDI XML encoding variability (Windows-1252, UTF-8) — force UTF-8 on load
- UUID duplicate across OCs — UNIQUE constraint + service validation
- Cross-empresa cuenta contable assignment — validate empresa match

---

## Phase 4: Reportes

**Goal:** Provide operational visibility into the CxP process — pending payments, pending comprobaciones, liberated comprobaciones, and vendor balances.

**Requirements:** REP-01, REP-02, REP-03, REP-04, REP-05 (5 total)

**Backend Deliverables:**
- `Features/Reportes/` — ReportesService, IReportesService, ReportesController, DTOs
- Complex aggregation queries across EstadoOC states, Pagos, Comprobaciones
- Filterable report endpoints with dynamic query building
- Export capability (Excel via ClosedXML, PDF via QuestPDF)

**Frontend Deliverables:**
- `ReportesComprobaciones.tsx` — pending payment, pending comprobacion, per-user, aging reports
- `ReportesContables.tsx` — liberated comprobaciones with multi-filter, vendor balance aging
- `reportesService.ts` + `reportes.types.ts`

**Success Criteria:**
1. Report shows all OCs pending payment (authorized but not yet paid) with OC details, monto, and dias de antiguedad
2. Report shows all OCs pending comprobacion (paid but not yet verified) with payment date and days elapsed
3. Liberated comprobaciones report is filterable by empresa, sucursal, date range, usuario, tipo de gasto, cuenta contable, and centro de costo — all filters work in combination
4. Vendor balance aging report shows outstanding balances per proveedor with aging buckets (current, 30, 60, 90+ days)
5. All reports are exportable to Excel and/or PDF with applied filters preserved

**Dependencies:** Phase 3 complete — needs comprobacion data for liberated reports. Some reports (REP-01 pending payments) could work after Phase 2, but all reports are grouped for coherent delivery.

**Estimated Complexity:** MEDIUM — complex queries but no state mutation. Read-only aggregation with filter logic.

---

## Phase 5: Integracion Contable

**Goal:** Generate automatic accounting journal entries (polizas) from closed OCs and export in formats compatible with external accounting systems.

**Requirements:** CONT-01, CONT-02, CONT-03 (3 total)

**Backend Deliverables:**
- `Features/IntegracionContable/` — IntegracionService, IIntegracionService, IntegracionController, DTOs
- Poliza generation: reads OC + Pagos + Comprobaciones for Cerrada OCs, generates debe/haber entries with cuenta contable
- CSV export layout compatible with Contpaq/SAP (exact format TBD with accounting team)
- XML export layout as alternative format
- Bank statement import (CSV/XLSX via CsvHelper/ClosedXML) and payment matching
- Conciliacion bancaria view — matched vs unmatched transactions

**Frontend Deliverables:**
- `ReportesContables.tsx` (extends Phase 4 page) — poliza generation trigger, export buttons
- `integracionService.ts` + types

**Success Criteria:**
1. System generates poliza entries (debe/haber) from closed OCs, mapping each partida to its cuenta contable and centro de costo with correct amounts
2. Polizas export in CSV and/or XML format compatible with the external accounting system, with configurable date range and empresa filters
3. Bank statements can be imported (CSV/XLSX) and system matches statement transactions with registered payments, showing matched and unmatched items

**Dependencies:** Phase 3 complete — needs Cerrada OCs with comprobaciones validadas. Phase 4 recommended but not strictly required.

**Estimated Complexity:** MEDIUM-HIGH — poliza generation logic is straightforward, but external format compatibility requires validation with accounting team. Bank statement parsing varies by bank.

**Research Flag:** External accounting system layout format (Contpaq vs SAP) must be confirmed with accounting team before implementation. Bank-specific CSV/XLSX layouts need actual statement samples from Auxiliar de Pagos.

---

## Phase 6: Dashboard

**Goal:** Provide at-a-glance visibility into CxP and Tesoreria operations with KPI dashboards.

**Requirements:** DASH-01, DASH-02 (2 total)

**Backend Deliverables:**
- Dashboard endpoints aggregating counts, sums, and trends across all modules
- KPI calculations: OCs pendientes, pagos programados, comprobaciones vencidas, gasto del mes
- Projected cash flow calculation for Tesoreria

**Frontend Deliverables:**
- `DashboardCxP.tsx` — KPI cards + charts (Recharts) for CxP overview
- `DashboardTesoreria.tsx` — KPI cards + charts for Tesoreria overview
- New routes in AppRoutes for dashboard pages

**Success Criteria:**
1. CxP dashboard shows real-time KPIs: OCs pendientes por autorizar (count + monto), pagos programados (count + monto), comprobaciones vencidas (count + dias promedio), gasto del mes vs presupuesto
2. Tesoreria dashboard shows: pagos del dia (count + monto), pagos vencidos (count + monto + dias), flujo de efectivo proyectado (30-day chart)

**Dependencies:** All prior phases complete — dashboard aggregates data from workflow, tesoreria, comprobacion, and reportes modules.

**Estimated Complexity:** LOW-MEDIUM — read-only aggregation queries. Main effort is frontend chart design with Recharts (already installed).

---

## Coverage Verification

| Phase | Requirements | Count |
|-------|-------------|-------|
| Phase 1 | WORK-01, WORK-02, WORK-03, PROV-01, PROV-02, PROV-03, CONF-01, CONF-02 | 8 |
| Phase 2 | TES-01, TES-02, TES-03, TES-04, TES-05, TES-06, TES-07 | 7 |
| Phase 3 | COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, COMP-09, COMP-10 | 10 |
| Phase 4 | REP-01, REP-02, REP-03, REP-04, REP-05 | 5 |
| Phase 5 | CONT-01, CONT-02, CONT-03 | 3 |
| Phase 6 | DASH-01, DASH-02 | 2 |
| **Total** | | **34** |

**Unmapped requirements:** 0
**Coverage:** 100% of v1 requirements

---

## Architecture Build Order Alignment

| Roadmap Phase | Architecture Phase | Rationale |
|---------------|-------------------|-----------|
| Phase 1 | A (Foundation) + B (Workflow) | Foundation entities are implementation prerequisites within Phase 1; workflow handlers complete the authorization chain |
| Phase 2 | C (Tesoreria) | Direct match — payment module |
| Phase 3 | D (Comprobacion) | Direct match — comprobacion module |
| Phase 4 | F (Reportes) | Moved before Integracion — operational reports don't need accounting data, provide higher user value |
| Phase 5 | E (Integracion) | Accounting integration needs Cerrada OCs; lower user-facing priority than reports |
| Phase 6 | F (Dashboard) | Aggregates everything, must be last |

**Deviation from architecture:** Reportes (F) placed before Integracion Contable (E). Justified because:
1. v1 reports (REP-01 to REP-05) are operational queries on payment/comprobacion data — zero dependency on accounting integration
2. Reports provide immediate operational value (visibility into what's pending)
3. Integracion Contable is backend plumbing that exports to external systems — less urgent for daily operations

---

## Risk Register

| Risk | Phase | Impact | Mitigation |
|------|-------|--------|------------|
| Concurrent partial payment race condition | Phase 2 | Overpayment if two users pay same OC | Optimistic concurrency (RowVersion) + atomic saldo validation |
| CFDI XML encoding/structure variability | Phase 3 | Parse failures on real supplier XMLs | Force UTF-8, namespace-aware XPath, reject CFDI 3.3 with clear message |
| UUID duplicate across OCs | Phase 3 | Double-counting expenses | UNIQUE constraint + service-level check + error with OC reference |
| External accounting format unknown | Phase 5 | Export incompatible with Contpaq/SAP | Validate format with accounting team BEFORE Phase 5 implementation |
| Bank statement format varies by bank | Phase 5 | Parser fails on unknown formats | Get actual statements from Auxiliar de Pagos; defer to v2 if too complex |
| Cross-empresa cuenta contable mismatch | Phase 3/5 | Incorrect polizas | Validate CuentaContable.EmpresaId == OC.EmpresaId in backend |

---

*Roadmap created: 2026-03-30*
*Last updated: 2026-03-30*
