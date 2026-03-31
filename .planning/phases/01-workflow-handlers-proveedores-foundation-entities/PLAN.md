# Phase 1 Plan: Workflow Handlers + Proveedores + Foundation Entities

**Created:** 2026-03-31
**Status:** Ready for execution
**Context:** See `01-CONTEXT.md`

---

## Execution Strategy

**Total Tasks:** 12
**Execution Order:** Sequential (each task depends on prior)
**Estimated Complexity:** MEDIUM (most work already built)

Tasks are ordered by dependency chain — foundation entities first, then handlers, then seeding, then endpoints, then frontend.

---

## Task 1: Pago Entity + Enum + EF Configuration

**Type:** Backend — Foundation Entity
**Requirement:** Foundation for Phase 2 (TES-01 through TES-07)
**Files to CREATE:**

```
lefarma.backend/src/Lefarma.API/Domain/Entities/Operaciones/Pago.cs
lefarma.backend/src/Lefarma.API/Domain/Entities/Operaciones/EstadoPago.cs
lefarma.backend/src/Lefarma.API/Domain/Interfaces/Operaciones/IPagoRepository.cs
lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Operaciones/PagoConfiguration.cs
lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/Operaciones/PagoRepository.cs
```

**Implementation:**

### EstadoPago enum
```csharp
namespace Lefarma.API.Domain.Entities.Operaciones
{
    public enum EstadoPago
    {
        Pendiente = 0,
        Aplicado = 1,
        Cancelado = 2
    }
}
```

### Pago entity
```csharp
namespace Lefarma.API.Domain.Entities.Operaciones
{
    public class Pago
    {
        public int IdPago { get; set; }
        public int IdOrdenCompra { get; set; }
        public decimal Monto { get; set; }
        public DateTime FechaPago { get; set; }
        public int IdMedioPago { get; set; }
        public string? Referencia { get; set; }
        public string? Nota { get; set; }
        public EstadoPago Estado { get; set; } = EstadoPago.Pendiente;
        public int IdUsuarioRegistra { get; set; }
        public DateTime FechaRegistro { get; set; }
        public DateTime? FechaModificacion { get; set; }

        // Navigation
        public virtual OrdenCompra? OrdenCompra { get; set; }
    }
}
```

### IPagoRepository
- `GetByIdAsync(int id) → Pago?`
- `GetByOrdenAsync(int idOrden) → IEnumerable<Pago>`
- `AddAsync(Pago pago) → Pago`
- `UpdateAsync(Pago pago) → Pago`
- `GetTotalPagadoByOrdenAsync(int idOrden) → decimal`

### PagoConfiguration (EF)
- `ToTable("Pagos")`
- PK: `IdPago`
- FK: `IdOrdenCompra → OrdenesCompra.IdOrden`
- Required: Monto, FechaPago, IdMedioPago, Estado, IdUsuarioRegistra
- Precision: `Monto` with `(18,2)`
- Index on `IdOrdenCompra`

### PagoRepository
- Standard CRUD following existing repository pattern

---

## Task 2: Comprobacion Entity + Enums + EF Configuration

**Type:** Backend — Foundation Entity
**Requirement:** Foundation for Phase 3 (COMP-01 through COMP-10)
**Files to CREATE:**

```
lefarma.backend/src/Lefarma.API/Domain/Entities/Operaciones/Comprobacion.cs
lefarma.backend/src/Lefarma.API/Domain/Entities/Operaciones/TipoComprobacion.cs
lefarma.backend/src/Lefarma.API/Domain/Entities/Operaciones/EstadoComprobacion.cs
lefarma.backend/src/Lefarma.API/Domain/Interfaces/Operaciones/IComprobacionRepository.cs
lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Operaciones/ComprobacionConfiguration.cs
lefarma.backend/src/Lefarma.API/Infrastructure/Data/Repositories/Operaciones/ComprobacionRepository.cs
```

**Implementation:**

### TipoComprobacion enum
```csharp
public enum TipoComprobacion
{
    CfdiXml = 1,        // CFDI 4.0 XML (factura electrónica SAT)
    NoDeducible = 2,    // Ticket/recibo no deducible
    DepositoBancario = 3 // Ficha de depósito bancario
}
```

### EstadoComprobacion enum
```csharp
public enum EstadoComprobacion
{
    Pendiente = 0,
    Validada = 1,
    Rechazada = 2
}
```

### Comprobacion entity
```csharp
public class Comprobacion
{
    public int IdComprobacion { get; set; }
    public int IdOrdenCompra { get; set; }
    public TipoComprobacion TipoComprobacion { get; set; }
    public EstadoComprobacion Estado { get; set; } = EstadoComprobacion.Pendiente;

    // CFDI fields (TipoComprobacion = CfdiXml)
    public string? Uuid { get; set; }
    public string? RfcEmisor { get; set; }
    public string? RfcReceptor { get; set; }
    public decimal? Subtotal { get; set; }
    public decimal? TotalIva { get; set; }
    public decimal? TotalRetenciones { get; set; }
    public decimal? Total { get; set; }
    public DateTime? FechaCfdi { get; set; }

    // No Deducible / Deposito fields
    public decimal? MontoManual { get; set; }
    public string? Descripcion { get; set; }

    // Common
    public int IdUsuarioSube { get; set; }
    public int? IdUsuarioValida { get; set; }
    public string? MotivoRechazo { get; set; }
    public DateTime FechaSubida { get; set; }
    public DateTime? FechaValidacion { get; set; }
    public DateTime? FechaModificacion { get; set; }

    // Navigation
    public virtual OrdenCompra? OrdenCompra { get; set; }
}
```

### IComprobacionRepository
- `GetByIdAsync(int id) → Comprobacion?`
- `GetByOrdenAsync(int idOrden) → IEnumerable<Comprobacion>`
- `GetByUuidAsync(string uuid) → Comprobacion?` (for UUID dedup in Phase 3)
- `AddAsync(Comprobacion c) → Comprobacion`
- `UpdateAsync(Comprobacion c) → Comprobacion`

### ComprobacionConfiguration (EF)
- `ToTable("Comprobaciones")`
- PK: `IdComprobacion`
- FK: `IdOrdenCompra → OrdenesCompra.IdOrden`
- Required: TipoComprobacion, Estado, IdUsuarioSube
- Precision: all decimal fields with `(18,2)`
- **UNIQUE constraint** on `Uuid` (for CFDI dedup in Phase 3)
- Index on `IdOrdenCompra`, `Uuid`

### ComprobacionRepository
- Standard CRUD following existing repository pattern

---

## Task 3: Register Foundation Entities in DbContext + DI

**Type:** Backend — Wiring
**Files to MODIFY:**

```
lefarma.backend/src/Lefarma.API/Infrastructure/Data/ApplicationDbContext.cs  — Add DbSet<Pago> + DbSet<Comprobacion>
lefarma.backend/src/Lefarma.API/Program.cs                                    — Add DI for IPagoRepository, IComprobacionRepository
```

**ApplicationDbContext changes:**
```csharp
// DbSets - Operaciones (CxP)
public DbSet<Pago> Pagos { get; set; }
public DbSet<Comprobacion> Comprobaciones { get; set; }
```

**Program.cs DI additions (near existing repository registrations):**
```csharp
builder.Services.AddScoped<IPagoRepository, PagoRepository>();
builder.Services.AddScoped<IComprobacionRepository, ComprobacionRepository>();
```

---

## Task 4: Firma5Handler

**Type:** Backend — Workflow Handler
**Requirement:** WORK-01
**Files to CREATE:**

```
lefarma.backend/src/Lefarma.API/Features/OrdenesCompra/Firmas/Handlers/Firma5Handler.cs
```

**Implementation:** Follows Firma4 pattern EXACTLY — pure approval handler, no validation, no data application. DireccionCorp just approves or rejects with comment.

```csharp
using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    /// <summary>
    /// Firma 5 - Dirección Corporativa: aprobación final antes de Tesorería.
    /// No requiere datos adicionales — es una aprobación pura.
    /// El rechazo obligatorio se maneja via RequiereComentario en el WorkflowPaso.
    /// </summary>
    public class Firma5Handler : IStepHandler
    {
        public string HandlerKey => "Firma5Handler";

        public Task<string?> ValidarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
            => Task.FromResult<string?>(null); // Aprobación pura, sin datos extra

        public Task AplicarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
            => Task.CompletedTask; // No modifica la OC
    }
}
```

---

## Task 5: ComprobacionHandler (Stub)

**Type:** Backend — Workflow Handler (Stub)
**Requirement:** Foundation for Phase 3 (COMP-08)
**Files to CREATE:**

```
lefarma.backend/src/Lefarma.API/Features/OrdenesCompra/Firmas/Handlers/ComprobacionHandler.cs
```

**Implementation:** No-op stub. Will be implemented in Phase 3 when ComprobacionService exists.

```csharp
using Lefarma.API.Domain.Entities.Operaciones;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    /// <summary>
    /// Comprobación de Gastos — STUB para Phase 1.
    /// Implementación real en Phase 3 (validar suma de comprobaciones, trigger cierre OC).
    /// </summary>
    public class ComprobacionHandler : IStepHandler
    {
        public string HandlerKey => "ComprobacionHandler";

        public Task<string?> ValidarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
            => Task.FromResult<string?>(null);

        public Task AplicarAsync(OrdenCompra orden, Dictionary<string, object>? datos)
            => Task.CompletedTask;
    }
}
```

---

## Task 6: Register Handlers in DI

**Type:** Backend — Wiring
**Files to MODIFY:**

```
lefarma.backend/src/Lefarma.API/Program.cs — Add 2 keyed DI registrations
```

**Changes (after existing Firma3/Firma4 lines ~160-161):**
```csharp
builder.Services.AddKeyedScoped<IStepHandler, Firma5Handler>("Firma5Handler");
builder.Services.AddKeyedScoped<IStepHandler, ComprobacionHandler>("ComprobacionHandler");
```

---

## Task 7: EF Migration

**Type:** Backend — Database
**Command:**
```bash
cd lefarma.backend/src/Lefarma.API && dotnet ef migrations add AddPagoAndComprobacionEntities
```

**Expected outcome:** Migration creates `Pagos` and `Comprobaciones` tables with all columns, indexes, and constraints defined in Tasks 1-2.

---

## Task 8: Workflow Seeding

**Type:** Backend — Seeding
**Requirement:** WORK-01, WORK-02, WORK-03, CONF-01
**Files to MODIFY:**

```
lefarma.backend/src/Lefarma.API/Infrastructure/Data/Seeding/DatabaseSeeder.cs
```

**Implementation:** Add `SeedWorkflowAsync()` method called from `SeedAsync()`.

**Seed data for ORDEN_COMPRA workflow:**

### WorkflowConfig
| Field | Value |
|-------|-------|
| Nombre | "Orden de Compra" |
| CodigoProceso | "ORDEN_COMPRA" |
| Version | 1 |
| Activo | true |

### Pasos (7 steps)
| Orden | Nombre | CodigoEstado | HandlerKey | EsInicio | RequiereComentario | RequiereFirma |
|-------|--------|-------------|------------|----------|--------------------|---------------|
| 1 | Firma 1 - Gerente Área | EN_REVISION_F2 | null | true | false (reject yes) | true |
| 2 | Firma 2 - CxP | EN_REVISION_F3 | Firma3Handler | false | false | true |
| 3 | Firma 3 - GAF | EN_REVISION_F4 | Firma4Handler | false | false | true |
| 4 | Firma 4 - Dirección Corp | EN_REVISION_F5 | Firma5Handler | false | true (reject) | true |
| 5 | Tesorería | EN_TESORERIA | null | false | false | false |
| 6 | Comprobación | EN_COMPROBACION | ComprobacionHandler | false | false | false |
| 7 | Cerrada | CERRADA | null | false | false | false |

### Acciones (per paso)
Each paso gets: "Autorizar" (APROBACION) + "Rechazar" (RECHAZO) actions.
- Autorizar: routes to next paso
- Rechazar: routes back to step 1 or sets RECHAZADA state

### Condiciones (dynamic routing on Firma 4 paso)
| Campo | Operador | Valor | Destino |
|-------|----------|-------|---------|
| Total | >= | 100000 | Firma 4 - Dirección Corp |

This means OCs < $100,000 MXN skip Firma5 and go directly to Tesorería from Firma 3 (GAF).

### Participantes (role mapping)
| Paso | Rol |
|------|-----|
| Firma 1 | GerenteArea |
| Firma 2 | CxP |
| Firma 3 | GerenteAdmon |
| Firma 4 | DireccionCorp |
| Tesorería | Tesoreria |

### Notificaciones
Each "Autorizar" action: AvisarAlSiguiente=true
Each "Rechazar" action: AvisarAlCreador=true, AvisarAlAnterior=true

**Idempotency:** Check `if (await _context.Set<Workflow>().AnyAsync()) return;` before seeding.

---

## Task 9: New Permissions for Provider Approval

**Type:** Backend — Authorization
**Requirement:** PROV-02, PROV-03
**Files to MODIFY:**

```
lefarma.backend/src/Lefarma.API/Shared/Constants/AuthorizationConstants.cs
lefarma.backend/src/Lefarma.API/Infrastructure/Data/Seeding/DatabaseSeeder.cs
```

**AuthorizationConstants.cs additions:**
```csharp
public static class Proveedores
{
    public const string Autorizar = "proveedores.autorizar";
    public const string Rechazar = "proveedores.rechazar";
}
```

**DatabaseSeeder.cs additions:**
- 2 new permissions (IdPermiso 23 + 24): Proveedores.Autorizar, Proveedores.Rechazar
- CxP role (IdRol=3) gets both permissions
- GerenteAdmon role (IdRol=4) gets both permissions
- Administrador role (IdRol=8) gets both permissions

---

## Task 10: Provider Approval Endpoints

**Type:** Backend — Feature
**Requirement:** PROV-02, PROV-03
**Files to CREATE:**

```
lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/DTOs/AutorizarProveedorResponse.cs
lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/DTOs/RechazarProveedorRequest.cs
```

**Files to MODIFY:**

```
lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/ProveedorService.cs — Add AutorizarAsync + RechazarAsync
lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/IProveedorService.cs — Add interface methods
lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/ProveedoresController.cs — Add 2 endpoints
```

**ProveedorService.AutorizarAsync:**
- Load proveedor by id
- If not found → Error NotFound
- If already autorizado → Error Conflict ("Proveedor ya está autorizado")
- Set `AutorizadoPorCxP = true`, `FechaModificacion = now`
- Log via WideEventAccessor
- Return success response

**ProveedorService.RechazarAsync:**
- Load proveedor by id
- If not found → Error NotFound
- If not pendiente (already autorizado) → Error Conflict
- Validate `motivo` is not empty (FluentValidation)
- Set `AutorizadoPorCxP = false`, save motivo in NotasGenerales (or new field), `FechaModificacion = now`
- Log via WideEventAccessor
- Send notification to capturista (creator) via NotificationService
- Return success response

**ProveedoresController additions:**
```csharp
[HttpPost("{id}/autorizar")]
[SwaggerOperation(Summary = "Autorizar proveedor para catálogo oficial")]
// [HasPermission("proveedores.autorizar")] — if HasPermission attribute exists
public async Task<IActionResult> Autorizar(int id)

[HttpPost("{id}/rechazar")]
[SwaggerOperation(Summary = "Rechazar proveedor pendiente con motivo obligatorio")]
// [HasPermission("proveedores.rechazar")]
public async Task<IActionResult> Rechazar(int id, [FromBody] RechazarProveedorRequest request)
```

---

## Task 11: Frontend — Provider Approval Buttons

**Type:** Frontend — Feature
**Requirement:** PROV-02, PROV-03
**Files to MODIFY:**

```
lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx
lefarma.frontend/src/services/api.ts (or proveedorService.ts if it exists)
```

**Implementation:**
1. Add 2 action buttons to ProveedoresList DataTable: "Autorizar" (green) + "Rechazar" (red)
2. Buttons visible ONLY when `AutorizadoPorCxP === false` and user has CxP/GerenteAdmon role
3. "Autorizar" → confirm dialog → `POST /api/catalogos/Proveedores/{id}/autorizar` → toast success
4. "Rechazar" → modal with Zod-validated `motivo` field (required) → `POST /api/catalogos/Proveedores/{id}/rechazar` → toast success
5. On success: refresh table data

---

## Task 12: Verify End-to-End

**Type:** Verification
**Manual tests:**
1. Run `dotnet ef database update` — migration applies, tables created
2. Run `dotnet run` — seeder creates workflow steps
3. `GET /api/config/Workflows` — returns ORDEN_COMPRA workflow with 7 pasos
4. `GET /api/config/Workflows/1/diagram` (frontend) — shows all 7 steps in diagram
5. `POST /api/catalogos/Proveedores/1/autorizar` — sets AutorizadoPorCxP=true
6. `POST /api/catalogos/Proveedores/2/rechazar` with `{"motivo": "RFC inválido"}` — rejects with notification
7. Frontend ProveedoresList — "Autorizar" / "Rechazar" buttons appear for non-authorized providers
8. Existing AutorizacionesOC page — after workflow seeding, Firma5 actions should be available when OC reaches EnRevisionF5 state

---

## Execution Order Summary

```
Task 1: Pago entity + repo + config
    ↓
Task 2: Comprobacion entity + repo + config
    ↓
Task 3: Register in DbContext + DI
    ↓
Task 4: Firma5Handler
    ↓
Task 5: ComprobacionHandler (stub)
    ↓
Task 6: Register handlers in DI
    ↓
Task 7: EF Migration
    ↓
Task 8: Workflow seeding
    ↓
Task 9: New permissions + seeding
    ↓
Task 10: Provider approval endpoints
    ↓
Task 11: Frontend provider approval
    ↓
Task 12: E2E verification
```

---

## Success Criteria

1. ✅ Firma5Handler registered in DI and resolves correctly when workflow seeding references it
2. ✅ OCs approved at Firma5 automatically transition to EnTesoreria (engine handles via CodigoEstado)
3. ✅ Workflow diagram shows all 7 steps with Firma5 conditional routing (Total >= 100000)
4. ✅ CxP can autorizar/rechazar providers via dedicated endpoints with audit trail
5. ✅ Pago + Comprobacion tables exist in database for Phase 2/3 to build on
6. ✅ Frontend ProveedoresList has working Autorizar/Rechazar buttons for CxP role
7. ✅ All existing tests still pass (`dotnet test`)
8. ✅ API builds without errors (`dotnet build`)

---

*Plan created: 2026-03-31*
*Ready for: Execution (Task 1 through Task 12)*
