# Phase 1 Plan: Provider Approval Endpoints + Frontend

**Created:** 2026-03-31
**Updated:** 2026-04-06
**Status:** Ready for execution
**Context:** See `01-CONTEXT.md`

---

## Execution Strategy

**Total Tasks:** 6
**Execution Order:** Sequential
**Estimated Complexity:** LOW

> **Nota:** Cada tarea tiene una validación inicial de "qué existe vs qué falta"

---

## State of Implementation (as of 2026-04-06)

### ✅ ALREADY BUILT

| Component | Status | Location |
|-----------|--------|----------|
| Firma5Handler | ✅ Done | `Features/OrdenesCompra/Firmas/Handlers/Firma5Handler.cs` |
| ComprobacionHandler (stub) | ✅ Done | `Features/OrdenesCompra/Firmas/Handlers/ComprobacionHandler.cs` |
| Pago entity + EstadoPago enum | ✅ Done | `Domain/Entities/Operaciones/Pago.cs` |
| PagoConfiguration + PagoRepository | ✅ Done | Infrastructure/Data |
| Comprobacion entity + enums | ✅ Done | `Domain/Entities/Operaciones/Comprobacion.cs` |
| ComprobacionConfiguration + Repository | ✅ Done | Infrastructure/Data |
| Handler DI registration | ✅ Done | `Program.cs` lines 164-165 |
| Repository DI registration | ✅ Done | `Program.cs` lines 150-151 |
| Workflow pasos (8 pasos) | ✅ Done | `DatabaseSeeder.cs` lines 470-593 |
| Permissions `proveedores.autorizar/rechazar` | ✅ Done | `AuthorizationConstants.cs` lines 117-118 |
| **Permission seeding in DB** | ✅ Done | Already seeded |
| **ProveedoresController** | ✅ Done | Already exists with CRUD endpoints |
| API builds | ✅ Done | `dotnet build` passes |

### ❌ NOT BUILT — THIS PHASE

| Component | Priority |
|-----------|----------|
| DTOs (RechazarProveedorRequest) | HIGH |
| ProveedorService methods (AutorizarAsync, RechazarAsync) | HIGH |
| **New endpoints** in ProveedoresController | HIGH |
| Frontend API service | HIGH |
| Frontend buttons + modals | HIGH |

---

## Task 1: Validate — DTOs

**Type:** Validation
**Purpose:** Check if RechazarProveedorRequest DTO already exists

### Validation

```bash
# Check if DTO exists
ls lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/DTOs/RechazarProveedorRequest.cs
```

**If exists:** Skip this DTO, document what exists
**If not exists:** Create it

### If needs creation

```csharp
// lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/DTOs/RechazarProveedorRequest.cs
using System.ComponentModel.DataAnnotations;

namespace Lefarma.API.Features.Catalogos.Proveedores.DTOs;

public class RechazarProveedorRequest
{
    [Required(ErrorMessage = "El motivo es requerido")]
    [MinLength(10, ErrorMessage = "El motivo debe tener al menos 10 caracteres")]
    public string Motivo { get; set; } = string.Empty;
}
```

---

## Task 2: Validate + Implement — ProveedorService Methods

**Type:** Backend — Service
**Files to MODIFY:**

```
lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/ProveedorService.cs
lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/IProveedorService.cs
```

### Validation

```bash
# Check if methods already exist
grep -n "AutorizarAsync\|RechazarAsync" lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/IProveedorService.cs
grep -n "AutorizarAsync\|RechazarAsync" lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/ProveedorService.cs
```

**If exists:** Document what exists, verify it matches requirements
**If not exists:** Add the methods

### If needs implementation

**IProveedorService additions:**
```csharp
Task<ErrorOr<ProveedorResponse>> AutorizarAsync(int id, int idUsuario);
Task<ErrorOr<ProveedorResponse>> RechazarAsync(int id, string motivo, int idUsuario);
```

**ProveedorService implementation:**

```csharp
public async Task<ErrorOr<ProveedorResponse>> AutorizarAsync(int id, int idUsuario)
{
    var proveedor = await _proveedorRepository.GetByIdAsync(id);
    if (proveedor == null)
        return Error.NotFound("Proveedor no encontrado");

    if (proveedor.AutorizadoPorCxP == true)
        return Error.Conflict("El proveedor ya está autorizado");

    proveedor.AutorizadoPorCxP = true;
    proveedor.FechaModificacion = DateTime.UtcNow;

    await _proveedorRepository.UpdateAsync(proveedor);

    _logger.LogInformation("Proveedor {Id} autorizado por usuario {Usuario}", id, idUsuario);

    return proveedor.ToResponse();
}

public async Task<ErrorOr<ProveedorResponse>> RechazarAsync(int id, string motivo, int idUsuario)
{
    var proveedor = await _proveedorRepository.GetByIdAsync(id);
    if (proveedor == null)
        return Error.NotFound("Proveedor no encontrado");

    if (proveedor.AutorizadoPorCxP == true)
        return Error.Conflict("El proveedor ya está autorizado — no se puede rechazar");

    proveedor.NotasGenerales = string.IsNullOrEmpty(proveedor.NotasGenerales)
        ? $"[RECHAZO] {motivo}"
        : $"{proveedor.NotasGenerales}\n[RECHAZO] {motivo}";
    proveedor.FechaModificacion = DateTime.UtcNow;

    await _proveedorRepository.UpdateAsync(proveedor);

    _logger.LogInformation("Proveedor {Id} rechazado por usuario {Usuario}: {Motivo}", id, idUsuario, motivo);

    // TODO: NotificationService.SendAsync() — notificar al capturista

    return proveedor.ToResponse();
}
```

---

## Task 3: Validate + Add — ProveedoresController Endpoints

**Type:** Backend — Controller
**Files to MODIFY:**

```
lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/ProveedoresController.cs
```

### Validation

```bash
# Check if endpoints already exist
grep -n '"/{id}/autorizar"\|"/{id}/rechazar"' lefarma.backend/src/Lefarma.API/Features/Catalogos/Proveedores/ProveedoresController.cs
```

**If exists:** Document what exists, verify it matches requirements
**If not exists:** Add the new endpoints

### If needs addition

Add these TWO new endpoints to existing controller:

```csharp
/// <summary>
/// Autorizar proveedor para uso en órdenes de compra
/// </summary>
[HttpPost("{id}/autorizar")]
[SwaggerOperation(Summary = "Autorizar proveedor")]
public async Task<IActionResult> Autorizar(int id)
{
    var userId = GetCurrentUserId(); // from claims
    var result = await _proveedorService.AutorizarAsync(id, userId);
    return result.Match(
        proveedor => Ok(proveedor),
        error => error.Code == "NotFound" ? NotFound(error) : Conflict(error)
    );
}

/// <summary>
/// Rechazar proveedor pendiente con motivo obligatorio
/// </summary>
[HttpPost("{id}/rechazar")]
[SwaggerOperation(Summary = "Rechazar proveedor")]
public async Task<IActionResult> Rechazar(int id, [FromBody] RechazarProveedorRequest request)
{
    if (!ModelState.IsValid)
        return BadRequest(ModelState);

    var userId = GetCurrentUserId(); // from claims
    var result = await _proveedorService.RechazarAsync(id, request.Motivo, userId);
    return result.Match(
        proveedor => Ok(proveedor),
        error => error.Code == "NotFound" ? NotFound(error) : Conflict(error)
    );
}
```

---

## Task 4: Validate — Frontend API Service

**Type:** Frontend — API
**Files to MODIFY:**

```
lefarma.frontend/src/services/api.ts
```

### Validation

```bash
# Check if methods already exist
grep -n "autorizar\|rechazar" lefarma.frontend/src/services/api.ts
```

**If exists:** Document what exists, verify it matches
**If not exists:** Add the methods

### If needs implementation

```typescript
export const proveedorApi = {
  autorizar: (id: number) => api.post(`/catalogos/Proveedores/${id}/autorizar`),
  rechazar: (id: number, motivo: string) => 
    api.post(`/catalogos/Proveedores/${id}/rechazar`, { motivo }),
};
```

---

## Task 5: Validate + Implement — Frontend ProveedoresList Buttons

**Type:** Frontend — UI
**Files to MODIFY:**

```
lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx
```

### Validation

```bash
# Check if Autorizar/Rechazar buttons already exist
grep -n "Autorizar\|Rechazar\|autorizar\|rechazar" lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx
```

**If exists:** Document what exists, verify functionality
**If not exists:** Add buttons + modal

### If needs implementation

1. Add state for reject modal:
```typescript
const [rejectModal, setRejectModal] = useState<{ open: boolean; proveedorId: number | null }>({ open: false, proveedorId: null });
const [rejectMotivo, setRejectMotivo] = useState('');
```

2. Add action buttons (visible only when `autorizadoPorCxP === false` and user has permission):
```tsx
{(row.autorizadoPorCxP === false && hasPermission('proveedores.autorizar')) && (
  <>
    <Button
      size="sm"
      variant="outline"
      className="text-green-600 border-green-600 hover:bg-green-50"
      onClick={() => handleAutorizar(row.id)}
    >
      <Check className="h-4 w-4 mr-1" />
      Autorizar
    </Button>
    <Button
      size="sm"
      variant="outline"
      className="text-red-600 border-red-600 hover:bg-red-50"
      onClick={() => setRejectModal({ open: true, proveedorId: row.id })}
    >
      <X className="h-4 w-4 mr-1" />
      Rechazar
    </Button>
  </>
)}
```

3. Add reject modal:
```tsx
<Modal open={rejectModal.open} onClose={() => setRejectModal({ open: false, proveedorId: null })}>
  <Modal.Header>Rechazar Proveedor</Modal.Header>
  <Modal.Body>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Motivo de rechazo *</label>
        <textarea
          className="w-full border rounded px-3 py-2"
          rows={3}
          value={rejectMotivo}
          onChange={(e) => setRejectMotivo(e.target.value)}
          placeholder="Indique el motivo del rechazo (mínimo 10 caracteres)"
        />
      </div>
    </div>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="outline" onClick={() => setRejectModal({ open: false, proveedorId: null })}>
      Cancelar
    </Button>
    <Button
      variant="destructive"
      onClick={handleRechazar}
      disabled={rejectMotivo.length < 10}
    >
      Rechazar
    </Button>
  </Modal.Footer>
</Modal>
```

4. Add handler functions:
```typescript
const handleAutorizar = async (id: number) => {
  if (!confirm('¿Está seguro de autorizar este proveedor?')) return;
  try {
    await proveedorApi.autorizar(id);
    toast.success('Proveedor autorizado');
    queryClient.invalidateQueries({ queryKey: ['proveedores'] });
  } catch (error) {
    toast.error('Error al autorizar proveedor');
  }
};

const handleRechazar = async () => {
  if (!rejectModal.proveedorId) return;
  try {
    await proveedorApi.rechazar(rejectModal.proveedorId, rejectMotivo);
    toast.success('Proveedor rechazado');
    setRejectModal({ open: false, proveedorId: null });
    setRejectMotivo('');
    queryClient.invalidateQueries({ queryKey: ['proveedores'] });
  } catch (error) {
    toast.error('Error al rechazar proveedor');
  }
};
```

---

## Task 6: E2E Verification

**Type:** Verification
**Manual tests:**

1. **Provider authorization:**
   ```bash
   # Create a pending provider first
   POST /api/catalogos/Proveedores
   { "razonSocial": "Distribuidora ABC", "rfc": "DIA850101XXX" }

   # Authorize it
   POST /api/catalogos/Proveedores/{id}/autorizar
   # Should return 200 with AutorizadoPorCxP = true

   # Try to authorize again (should fail)
   POST /api/catalogos/Proveedores/{id}/autorizar
   # Should return 409 Conflict
   ```

2. **Provider rejection:**
   ```bash
   POST /api/catalogos/Proveedores/{id}/rechazar
   { "motivo": "RFC inválido - no coincide con registros del SAT" }
   # Should return 200

   # Try with short motivo (should fail)
   POST /api/catalogos/Proveedores/{id}/rechazar
   { "motivo": "corto" }
   # Should return 400 Bad Request
   ```

3. **Frontend test:**
   ```
   1. Login as CxP user
   2. Navigate to /catalogos/proveedores
   3. Verify Autorizar/Rechazar buttons appear for non-authorized providers
   4. Click Autorizar → confirm → verify success toast
   5. Click Rechazar → enter motivo → verify rejection
   ```

4. **Build verification:**
   ```bash
   dotnet build lefarma.backend/src/Lefarma.API/Lefarma.API.csproj
   # Should succeed
   ```

---

## Execution Order Summary

```
Task 1: Validate DTOs → create if missing
    ↓
Task 2: Validate ProveedorService → add methods if missing
    ↓
Task 3: Validate Controller → add endpoints if missing
    ↓
Task 4: Validate Frontend API → add methods if missing
    ↓
Task 5: Validate Frontend UI → add buttons if missing
    ↓
Task 6: E2E verification
```

---

## Success Criteria

1. ✅ `POST /api/catalogos/Proveedores/{id}/autorizar` sets `AutorizadoPorCxP = true`
2. ✅ `POST /api/catalogos/Proveedores/{id}/rechazar` saves motivo
3. ✅ Reject with short motivo returns 400 validation error
4. ✅ Authorize already-authorized provider returns 409 conflict
5. ✅ Frontend shows Autorizar/Rechazar buttons only for non-authorized providers
6. ✅ Frontend shows buttons only for users with permissions
7. ✅ API builds without errors

---

## Out of Scope (Phase 2)

- WorkflowAccion seeding
- WorkflowCondicion seeding (Total >= 100000 routing)
- WorkflowParticipante seeding
- WorkflowNotificacion seeding
- TesoreriaHandler (not needed — engine handles state)
- EF Migration (tables created manually)

---

*Plan updated: 2026-04-06*
*Ready for: Execution (Task 1 through Task 6)*
