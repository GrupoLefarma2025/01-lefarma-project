# Design: Carátulas por Cuenta de Proveedor

> SDD design phase for change `caratulas-por-cuenta-proveedor`.
> Authoritative inputs: `proposal.md` (§4 binding rules), `specs/proveedores/spec.md`,
> `specs/caratulas-proveedor/spec.md`, `explore.md` + Engram #312–#315.
> Source evidence confirmed against current code (file:line below).

## 1. Overview & Key Decisions

**Architectural approach (summary):**

- Carátula moves from a 1:1 column on `proveedores_detalle` to an **optional column
  `caratula_path` on the account row** — both live (`catalogos.proveedor_forma_pago_cuentas`)
  and staging (`staging.proveedor_forma_pago_cuentas`). One carátula per account, supplier owns N.
- A single migration `025` adds the column to both tables, **adds the missing `id_cuen`** to
  staging (drift fix), back-fills ~14 legacy carátulas onto each supplier's first active account,
  and keeps the legacy column nullable for rollback.
- Carátula upload now **routes by supplier estatus**: prospecto (`Nuevo`/`Rechazado`) writes
  directly; authorized (`Aprobado`/`EditadoPendiente`) enters the **full staging workflow**
  (visible diff → approve/reject), reversing the documented bypass at `ProveedorService.cs:476-477`.
- `GenerarDiff` gains a per-account `CampoDiff` whose human label is
  `Carátula cuenta ••{last4} actualizada` / `… agregada`.
- Frontend replaces the single row thumbnail with a **count badge** + new "Ver carátulas"
  modal, and relocates the upload slot into each account card.

**Three delegated decisions — RESOLVED:**

### Decision 1 — Exact "first active account" ordering

- **Choice:** `ORDER BY id_cuenta ASC` (the IDENTITY PK), filtered `WHERE activo = 1`.
  Implemented as `MIN(id_cuenta)` per supplier.
- **Alternatives considered:** `fecha_creacion ASC` (DEFAULT `GETUTCDATE()`); a dedicated
  `es_principal`/priority column.
- **Rationale:** the IDENTITY PK is the canonical, monotonic, **unique** insertion-order
  proxy — no ties, no millisecond collisions, no nullability. `fecha_creacion` can collide and
  is nullable-ish in practice; adding a priority column is out of scope (spec §5 non-goal).
  `spec.md` scenario explicitly says "by insertion order", which `MIN(id_cuenta)` satisfies
  deterministically. Verified PK column name: `id_cuenta` (`005_alter_proveedores_formas_pago.sql:86`,
  EF maps `IdCuen → id_cuenta` in `ProveedorFormaPagoCuentaConfiguration.cs:15`).

### Decision 2 — Exact CampoDiff string

- **Campo (machine key):** `CuentasFormaPago[{id_cuenta}].Caratula` — consistent with the
  existing `CuentasFormaPago[{id}].NumeroCuenta` family (`ProveedorService.cs:1101`).
- **Label (human, rendered by the diff viewer):**
  - Replace → `Carátula cuenta ••{last4} actualizada`
  - First-time on that account → `Carátula cuenta ••{last4} agregada`
  - Removal (account had carátula, now cleared) → `Carátula cuenta ••{last4} eliminada`
  (removal is not asserted by spec but included for completeness)
- **`{last4}` source:** `RIGHT(Clabe, 4)` when CLABE present, else `RIGHT(NumeroCuenta, 4)`,
  else literal `"????"`. CLABE is preferred (it is the most stable account identifier and the
  one already used by `GenerarDiff` for the account's display value at line 1080/1087).
- **`••` handling:** two literal U+2022 (BULLET) code points, exactly as written in the spec.
  The C# string literal is `"Carátula cuenta ••"` + `{last4}` + `" actualizada"`. The accent on
  `Carátula`/`actualizada`/`agregada` is preserved (UTF-8). Verify tests assert exact equality
  against this literal.
- **ValorAnterior / ValorNuevo:** the stored file **paths** (`caratula_path`), not the masked
  string — so the diff viewer can still show old/new paths if needed, while the Label carries
  the masked human message. For a first-time carátula, `ValorAnterior = null`.

### Decision 3 — Estatus → code-path decision table

| Estatus (const) | Value | Carátula code path | Rationale |
|-----------------|-------|--------------------|-----------|
| `Nuevo` | 1 | **DIRECT WRITE** | Prospecto — binding rule #6. Matches existing `UpdateAsync` routing (`ProveedorService.cs:249` region routes Nuevo to direct update). No staging row, no diff, no estatus change. |
| `Rechazado` | 3 | **DIRECT WRITE** | A rejected supplier is **not authorized** (its last authorization was denied). Consistent with `UpdateAsync` which routes `Rechazado` to direct update (`ProveedorService.cs:573`). Re-enters staging only when re-submitted for authorization. |
| `Aprobado` | 2 | **FULL STAGING** | Authorized — binding rule #2. Upsert staging, flip to `EditadoPendiente`. |
| `EditadoPendiente` | 4 | **FULL STAGING** | Already has pending staging — update the existing staging row in place, stay `EditadoPendiente`. |
| Any other / unknown | — | **REJECT with `Conflict`** | Defensive. `EstatusProveedor.GetDescripcion` already returns "Desconocido" for unknown. Catches a future estatus added without updating this table. |

> **Exhaustiveness guard:** the routing lives in one private method
> `RutarCaratulaPorEstatusAsync(proveedor, cuentaId, newPath)` with a `switch` on
> `proveedor.Estatus`. A new estatus value MUST be added here or it throws — no silent default.

---

## 2. Database Layer — Migration `025_caratula_por_cuenta.sql`

> **Placement (conceptual):** `lefarma.database/025_caratula_por_cuenta.sql`.
> sdd-apply creates the actual file; this is the production-ready, idempotent content.

```sql
-- ============================================================================
-- LEFARMA - 025: Caratula por cuenta de proveedor (1:1 -> 1:N)
-- ============================================================================
-- Fecha: 2026-07-09
-- Descripcion:
--   1. Agrega caratula_path NVARCHAR(500) NULL a catalogos.proveedor_forma_pago_cuentas
--   2. Agrega caratula_path NVARCHAR(500) NULL a staging.proveedor_forma_pago_cuentas
--   3. Agrega id_cuen INT NULL a staging.proveedor_forma_pago_cuentas (FIX DRIFT: el
--      codigo C# mapea IdCuen -> id_cuen pero NINGUNA migracion creaba esa columna;
--      dependia de un ALTER ad-hoc. Ver explore.md #313 / migration 008:61-72).
--   4. Migra ~14 caratulas legacy de proveedores_detalle a la PRIMER CUENTA ACTIVA
--      de cada proveedor (silencioso, idempotente).
--   5. Asegura que proveedores_detalle.caratula_path quede NULLABLE (rollback).
-- Reglas: idempotente (re-ejecutable sin error). NUNCA usar dotnet ef migrations.
-- ============================================================================

USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INICIANDO 025_caratula_por_cuenta.sql';
PRINT '============================================================';
PRINT '';
GO

-- ============================================================================
-- PASO 1: catalogos.proveedor_forma_pago_cuentas.caratula_path
-- ============================================================================
IF COL_LENGTH('catalogos.proveedor_forma_pago_cuentas', 'caratula_path') IS NULL
BEGIN
    ALTER TABLE catalogos.proveedor_forma_pago_cuentas
    ADD caratula_path NVARCHAR(500) NULL;

    PRINT 'Columna [catalogos].[proveedor_forma_pago_cuentas].[caratula_path] agregada';
END
ELSE
BEGIN
    PRINT 'Columna [catalogos].[proveedor_forma_pago_cuentas].[caratula_path] ya existe (sin cambios)';
END
GO

-- ============================================================================
-- PASO 2: staging.proveedor_forma_pago_cuentas.caratula_path
-- ============================================================================
IF COL_LENGTH('staging.proveedor_forma_pago_cuentas', 'caratula_path') IS NULL
BEGIN
    ALTER TABLE staging.proveedor_forma_pago_cuentas
    ADD caratula_path NVARCHAR(500) NULL;

    PRINT 'Columna [staging].[proveedor_forma_pago_cuentas].[caratula_path] agregada';
END
ELSE
BEGIN
    PRINT 'Columna [staging].[proveedor_forma_pago_cuentas].[caratula_path] ya existe (sin cambios)';
END
GO

-- ============================================================================
-- PASO 3: staging.proveedor_forma_pago_cuentas.id_cuen  (FIX DE DRIFT)
-- ============================================================================
-- El codigo C# (StagingProveedorFormaPagoCuenta.IdCuen, copiado en
-- ProveedorService.cs:492) requiere esta columna, pero la migracion 008 NO la creo.
-- En produccion dependia de un ALTER manual. Esto lo formaliza de forma idempotente.
IF COL_LENGTH('staging.proveedor_forma_pago_cuentas', 'id_cuen') IS NULL
BEGIN
    ALTER TABLE staging.proveedor_forma_pago_cuentas
    ADD id_cuen INT NULL;

    PRINT 'Columna [staging].[proveedor_forma_pago_cuentas].[id_cuen] agregada (fix drift)';
END
ELSE
BEGIN
    PRINT 'Columna [staging].[proveedor_forma_pago_cuentas].[id_cuen] ya existe (sin cambios)';
END
GO

-- ============================================================================
-- PASO 4: Migracion de caratulas legacy -> primer cuenta activa
-- ============================================================================
-- Copia cada caratula_path legacy (de proveedores_detalle) a la PRIMER CUENTA ACTIVA
-- del proveedor (MIN(id_cuenta) = orden de insercion, ver Decision 1).
-- Idempotente:
--   * c.caratula_path IS NULL  -> no pisa una cuenta ya migrada o con caratula real
--   * proveedor sin cuenta activa -> la subquery MIN devuelve NULL -> no hay match
--     -> la caratula legacy se PRESERVA en proveedores_detalle (spec scenario).
DECLARE @caratulas_migradas INT = 0;

UPDATE c
    SET c.caratula_path = d.caratula_path,
        c.fecha_modificacion = GETUTCDATE()
FROM catalogos.proveedor_forma_pago_cuentas c
INNER JOIN catalogos.proveedores_detalle d
    ON d.id_proveedor = c.id_proveedor
WHERE d.caratula_path IS NOT NULL
  AND d.caratula_path <> ''
  AND c.caratula_path IS NULL
  AND c.activo = 1
  AND c.id_cuenta = (
      SELECT MIN(c2.id_cuenta)
      FROM catalogos.proveedor_forma_pago_cuentas c2
      WHERE c2.id_proveedor = c.id_proveedor
        AND c2.activo = 1
  );

SET @caratulas_migradas = @@ROWCOUNT;
PRINT 'Caratulas legacy migradas a la primer cuenta activa: ' + CAST(@caratulas_migradas AS VARCHAR(10));
GO

-- ============================================================================
-- PASO 5: Asegurar que proveedores_detalle.caratula_path sea NULLABLE (rollback)
-- ============================================================================
-- La migracion 007 ya la creo como NULL; este paso es defensivo/idempotente por si
-- un entorno la creo NOT NULL por error. No se DROPEA la columna (preserva rollback).
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'catalogos'
      AND TABLE_NAME = 'proveedores_detalle'
      AND COLUMN_NAME = 'caratula_path'
      AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE catalogos.proveedores_detalle
    ALTER COLUMN caratula_path NVARCHAR(500) NULL;

    PRINT 'Columna [catalogos].[proveedores_detalle].[caratula_path] marcada como NULLABLE';
END
ELSE
BEGIN
    PRINT 'Columna [catalogos].[proveedores_detalle].[caratula_path] ya es NULLABLE (sin cambios)';
END
GO

-- ============================================================================
-- PASO 6: Verificacion
-- ============================================================================
PRINT '';
PRINT 'Verificacion: columnas nuevas presentes';
SELECT
    s.name AS [schema],
    t.name AS tabla,
    c.name AS columna,
    ty.name AS tipo,
    c.max_length,
    c.is_nullable
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE (s.name IN ('catalogos', 'staging')
       AND t.name = 'proveedor_forma_pago_cuentas'
       AND c.name IN ('caratula_path', 'id_cuen', 'id_cuenta'))
   OR (s.name = 'catalogos' AND t.name = 'proveedores_detalle' AND c.name = 'caratula_path')
ORDER BY s.name, t.name, c.column_id;
GO

PRINT '';
PRINT '============================================================';
PRINT '025_caratula_por_cuenta.sql COMPLETADO';
PRINT '============================================================';
PRINT '';
GO
```

**Rollback notes (how to undo):**

1. The legacy `proveedores_detalle.caratula_path` column is intentionally **kept nullable** and
   **not dropped** — no data loss. The old direct-write path can be restored by reverting the
   backend commits; legacy rows still hold their original paths (the migration only *copied*,
   never deleted).
2. The two new `caratula_path` columns on the cuenta tables and the `id_cuen` drift fix can be
   left in place (nullable, unused) with zero impact, or dropped by a `026_revert_caratula_cuenta.sql`.
3. **The `id_cuen` drift fix MUST NOT be reverted** — it was a latent bug; reverting it re-breaks
   staging account edits on environments without the ad-hoc ALTER.
4. To re-point a migrated carátula back to legacy manually (only if a misassignment is found):
   the legacy column still holds the original value, so `UPDATE proveedores_detalle SET
   caratula_path = <original>` is a no-op; simply NULL the account row if needed.

---

## 3. Backend — Domain & EF

| File | Action | Change |
|------|--------|--------|
| `Domain/Entities/Catalogos/ProveedorFormaPagoCuenta.cs` | Modify | Add `public string? CaratulaPath { get; set; }` |
| `Domain/Entities/Catalogos/StagingProveedorFormaPagoCuenta.cs` | Modify | Add `public string? CaratulaPath { get; set; }` (`IdCuen` already exists on the entity — confirmed; only the DB column was missing, fixed by migration step 3). |
| `Domain/Entities/Catalogos/ProveedorDetalle.cs` | Modify | Keep `CaratulaPath`; add XML doc `/// <summary>Obsolete: carátula ahora vive en ProveedorFormaPagoCuenta.CaratulaPath. Conservada solo para rollback/migracion.</summary>` + `[Obsolete("Use ProveedorFormaPagoCuenta.CaratulaPath")]` on the property. Do NOT delete. |
| `Infrastructure/Data/Configurations/Catalogos/ProveedorFormaPagoCuentaConfiguration.cs` | Modify | Add `builder.Property(e => e.CaratulaPath).HasColumnName("caratula_path").HasMaxLength(500);` (optional — no `.IsRequired()`). |
| `Infrastructure/Data/Configurations/Catalogos/StagingProveedorFormaPagoCuentaConfiguration.cs` | Modify | Map `CaratulaPath → caratula_path` (len 500) and confirm `IdCuen → id_cuen` is already mapped (it is, per entity). |

> **EF note:** both new columns are nullable strings — no migration generated by EF (manual SQL
> rule). The configuration only declares the mapping so queries/projections include it.

---

## 4. Backend — Service Layer (`ProveedorService.cs`)

### 4.1 New routing method

```csharp
private async Task<ErrorOr<bool>> RutarCaratulaPorEstatusAsync(
    Proveedor proveedor, int cuentaId, string newCaratulaPath)
{
    // cuentaId must reference a real, persisted account of this proveedor
    var cuenta = proveedor.CuentasFormaPago.FirstOrDefault(c => c.IdCuen == cuentaId);
    if (cuenta is null)
        return CommonErrors.NotFound("cuenta", cuentaId.ToString());

    return proveedor.Estatus switch
    {
        EstatusProveedor.Nuevo or EstatusProveedor.Rechazado
            => await EscribirCaratulaDirectoAsync(cuenta, newCaratulaPath),
        EstatusProveedor.Aprobado or EstatusProveedor.EditadoPendiente
            => await StagearCaratulaAsync(proveedor, cuenta, newCaratulaPath),
        _ => Error.Conflict($"Estatus de proveedor no soportado para caratula: {proveedor.Estatus}")
    };
}
```

### 4.2 Direct write (prospecto / rechazado)

`EscribirCaratulaDirectoAsync(cuenta, path)`: sets `cuenta.CaratulaPath = path`,
`cuenta.FechaModificacion = UtcNow`, `SaveChangesAsync`. **No staging row, no diff, no estatus
flip.** This path also serves the legacy prospecto exemption (binding rule #6). The
orphan-detalle 409 (`ProveedorService.cs:653-657`) **disappears** — the account always exists.

### 4.3 Stage carátula (authorized)

`StagearCaratulaAsync(proveedor, cuenta, newPath)` — standalone upload to an authorized supplier:

1. Save file to disk (`caratulas/cuentas/...`).
2. Load current live supplier state (snapshot of scalar + detalle + cuentas).
3. **Upsert `StagingProveedor`**: if a staging row exists, update it; else create one as a
   clone of live (so the diff shows ONLY the carátula change). Set `Estatus = EditadoPendiente`.
4. **Rebuild `StagingProveedorFormaPagoCuenta`** children = live cuentas cloned, **except** the
   target account whose `CaratulaPath = newPath`. **Preserve `IdCuen`** (the C# fix at
   `ProveedorService.cs:492` already sets `IdCuen = cuenta.IdCuen > 0 ? cuenta.IdCuen : null`;
   migration step 3 makes the column exist so this stops throwing).
5. Flip `proveedor.Estatus = EditadoPendiente`, `SaveChangesAsync`.

When the carátula arrives **inside a normal edit** (`UpdateProveedorRequest` with cuentas
carrying `CaratulaUrl`), the existing `GuardarEnStagingAsync` is extended to copy
`CaratulaPath` per cuenta into the staging child (same line ~492 block). No separate path.

### 4.4 `GenerarDiff` (`ProveedorService.cs:1032`) — carátula CampoDiff

Inside the existing **`Intersect` loop** (lines 1091–1112), after the `Activo` comparison:

```csharp
if (StringsDifieren(orig.CaratulaPath, stag.CaratulaPath))
{
    var last4 = Ultimos4(stag.Clabe, stag.NumeroCuenta);
    var accion = string.IsNullOrWhiteSpace(orig.CaratulaPath) ? "agregada"
               : string.IsNullOrWhiteSpace(stag.CaratulaPath) ? "eliminada"
               : "actualizada";
    diffs.Add(new CampoDiff
    {
        Campo = $"CuentasFormaPago[{id}].Caratula",
        Label = $"Carátula cuenta ••{last4} {accion}",
        ValorAnterior = orig.CaratulaPath,
        ValorNuevo = stag.CaratulaPath
    });
}
```

For a **new account** (staging-only, `IdCuen` null) that carries a carátula, add a matching
`… agregada` entry in the "Nueva cuenta" branch (lines 1084–1089), deriving `last4` from the
staging cuenta's `Clabe`/`NumeroCuenta`.

Helper:

```csharp
private static string Ultimos4(string? clabe, string? numeroCuenta)
{
    var src = (!string.IsNullOrWhiteSpace(clabe) ? clabe : numeroCuenta) ?? "";
    return src.Length >= 4 ? src[^4..] : (src.Length > 0 ? src : "????");
}
```

### 4.5 `AutorizarEdicionAsync` (`ProveedorService.cs:723`) — promote staged carátula

In the account-promotion loop (lines 804–814 onward), when copying a staged cuenta to its live
match, also copy `cuentaOriginal.CaratulaPath = cuentaStaging.CaratulaPath`. The legacy
`proveedor.Detalle.CaratulaPath = staging.Detalle.CaratulaPath` line (767) is left in place but
becomes a no-op for carátula (staging detalle carátula stays null under the new model).

### 4.6 Reject path — carátula reverts

Reject (line ~926–940) discards the staging row entirely. Because the live
`ProveedorFormaPagoCuenta.CaratulaPath` was **never touched** during staging (only the staging
child held the new path), the live carátula is untouched by construction — no explicit revert
code needed. Estatus returns to `Aprobado`. This satisfies spec scenario "Approver rejects the
carátula staging → live carátula reverts to its prior value".

---

## 5. Backend — Controller & DTOs

| File | Action | Change |
|------|--------|--------|
| `ProveedoresController.cs` | Add | `POST {id}/cuentas/{idCuen}/caratula` (multipart, same validation as current upload: jpg/jpeg/png/gif/webp/pdf, 10 MB). File name `caratula_cuenta_{idCuen}_{guid}{ext}` under `caratulas/cuentas/`. Calls `RutarCaratulaPorEstatusAsync`. |
| `ProveedoresController.cs` | Add | `DELETE {id}/cuentas/{idCuen}/caratula` — same estatus routing (delete = a carátula change; authorized suppliers stage it, prospecto deletes directly). |
| `ProveedoresController.cs` | Add | `GET {id}/caratulas` → `[{ cuentaId, ultimos4, caratulaUrl }]` for the "Ver carátulas" modal (filters to accounts with non-null `caratula_path`). |
| `ProveedoresController.cs` | Modify | Old `POST {id}/caratula` and `DELETE {id}/caratula` → **deprecated shim**: `[Obsolete]`, returns 410 Gone with a message pointing to the new cuenta-scoped route (bulk-upload CSV audit pending; hard-remove deferred per proposal §6). |
| `DTOs/ProveedorDTOs.cs` | Modify | `ProveedorFormaPagoCuentaResponse`: add `public string? CaratulaUrl { get; set; }`. `StagingProveedorFormaPagoCuentaResponse`: add `CaratulaUrl`. Cuenta request DTOs: add optional `CaratulaUrl`. |
| `DTOs/ProveedorDTOs.cs` | Add | `CaratulaCuentaResponse { int CuentaId; string Ultimos4; string? CaratulaUrl; }` for the GET endpoint. |
| `Extensions/ProveedorExtensions.cs` | Modify | Map `CaratulaPath ↔ CaratulaUrl` for both cuenta response types (existing `CaratulaUrl = entity.CaratulaPath` pattern at line 40). |

---

## 6. Frontend — Components

### `ProveedoresList.tsx` (1800 lines, local `useState` — keep style, NO Zustand)

| Lines | Action | Change |
|-------|--------|--------|
| 722–755 (Razón Social cell) | **Replace** | Remove the single thumbnail (`caratulaUrl`/`fullSrc`/`<img>`/`<FileText>`). Render a **count badge** computed from row data: `const n = row.original.cuentasFormaPago?.filter(c => c.caratulaUrl).length ?? 0;` → if `n > 0` render a `<Badge variant="secondary">{n} carátula{n>1?'s':''}</Badge>` that calls `setCaratulasModalProveedor(row.original)` on click. Keep the `Building` icon + razonSocial + rfc stack. |
| 1243–1290 (Datos de Contacto carátula) | **Remove** | Delete the entire carátula `<Input type="file">` + preview block. Remove `caratulaFile`/`caratulaChanged`/`caratulaPreview` state (273–275) and `handleCaratulaChange` (428–435) IF no other path uses them — **audit first** (see Risks). |
| 1294–1551 (account cards) | **Modify** | Inside each account card, add a carátula slot: if `cuenta.caratulaUrl` → preview thumb + "Reemplazar" + "Eliminar"; else → upload control. Each calls `proveedorApi.uploadCuentaCaratula(id, idCuen, file)` / `deleteCuentaCaratula`. |
| 574–605 (`handleSaveProveedor` carátula bypass) | **Remove** | The "cover-only change goes straight to the carátula endpoint (bypasses staging)" block is gone — carátula is now per-account via the new endpoint, not part of the supplier save. |
| 859–942 (actions column) | **Modify** | Add a "Ver carátulas" action button (icon) → opens `CaratulasPreviewModal`. |
| ~1672–1740 (diff modal) | **No change** | Already renders `diferencias[].Label` — the new `Carátula cuenta ••…` labels render for free. |

### New component `CaratulasPreviewModal.tsx` (same folder)

**Props:** `{ proveedorId: number; open: boolean; onOpenChange; }`.
**Behavior:** on open, calls `proveedorApi.getCaratulas(proveedorId)` → list of
`{ cuentaId, ultimos4, caratulaUrl }`. Renders one entry per carátula (last-4 + preview button).
Preview button reuses the existing fullscreen viewer (`setFullscreenImage`). **Empty state:**
"No hay carátulas para este proveedor." Uses shadcn `Dialog` + `ScrollArea` + `Badge`.

---

## 7. Frontend — API client (`services/api.ts`)

Extend `proveedorApi` (currently only autorizar/rechazar/bulkUpload, lines 125–136):

```ts
uploadCuentaCaratula: (id: number, idCuen: number, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post(
    `/catalogos/Proveedores/${id}/cuentas/${idCuen}/caratula`, formData,
    { headers: { 'Content-Type': 'multipart/form-data' } });
},
deleteCuentaCaratula: (id: number, idCuen: number) =>
  apiClient.delete(`/catalogos/Proveedores/${id}/cuentas/${idCuen}/caratula`),
getCaratulas: (id: number) =>
  apiClient.get(`/catalogos/Proveedores/${id}/caratulas`),
```

> **Decision:** formalize into `proveedorApi` (not raw `API.post`) — keeps the carátula surface
> alongside the existing autorizar/rechazar/bulkUpload helpers and removes the inline
> `API.post(`${ENDPOINT}/${savedId}/caratula`)` call at line 604.

---

## 8. Risks & Mitigations

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **`ProveedoresList.tsx` fragility** (1800 lines, coupled `useState`, `buildProveedorSnapshot`). Moving carátula UI risks regressions in diff/snapshot. | **High** | Surgical edits only; keep `buildProveedorSnapshot` intact; manual QA on edit + diff + approve; the diff modal needs zero change (renders Label). |
| 2 | **`id_cuen` migration ordering** — staging column MUST exist before any data UPDATE/staging write. | **High** | Migration step 3 (`ALTER … ADD id_cuen`) runs **before** backend deploy. The data UPDATE (step 4) doesn't touch `id_cuen`, so order within 025 is safe; the cross-step risk is deploy order (DB → backend), documented in §10. |
| 3 | **File-name collisions** for per-account carátulas. | Low | Convention `caratula_cuenta_{idCuen}_{guid}{ext}`; GUID guarantees uniqueness. New accounts in an edit (no live `IdCuen` yet) use `caratula_cuenta_new_{guid}{ext}` and are uploaded only after the account is persisted/approved. |
| 4 | **Estatus enum exhaustiveness** — a future estatus silently misroutes. | Med | `RutarCaratulaPorEstatusAsync` `switch` has no default → compiler exhaustiveness + runtime `Conflict` for unknown. |
| 5 | **`detalle?.caratulaUrl` references** — full audit: lines 80, 89, 273–275, 428–435, 465–470, 574–605, 723–725, 1243–1290 (34 grep hits). Some state (`caratulaFile`/`caratulaPreview`) may be reusable by the account-card slot — **do not delete blindly**; relocate. | Med | sdd-tasks produces a dedicated "audit + relocate carátula state" task; verify build passes after removal. |
| 6 | **Standalone upload to authorized supplier** must produce a diff showing ONLY the carátula (not a full re-diff). | Med | `StagearCaratulaAsync` clones live state into staging so `GenerarDiff` yields exactly one carátula entry. Verify test asserts diff length == 1. |
| 7 | **Old `/{id}/caratula` callers** (bulk-upload CSV). | Low | Deprecated shim returns 410 with migration message; audit `ProveedorService.BulkUpload.cs` during apply. |

---

## 9. Test Strategy (high-level — sdd-verify details)

| Layer | What | Approach |
|-------|------|----------|
| Unit | `GenerarDiff` emits exact `Carátula cuenta ••1234 actualizada` / `… agregada` labels; `Ultimos4` CLABE-vs-cuenta fallback; estatus routing table (all 4 + unknown→Conflict). | xUnit + FluentAssertions in `Lefarma.UnitTests`; assert `diffs.Single().Label == "Carátula cuenta ••1234 actualizada"`. |
| Unit | Migration logic: first-active-account selection (MIN id_cuenta), idempotency (re-run no-op), no-active-account preservation. | SQL replay on a seeded InMemory/LocalDB fixture, or pure C# port of the selection predicate. |
| Integration | Authorized supplier: upload → staging row + estatus `EditadoPendiente` + live untouched; approve → promote; reject → live untouched + estatus `Aprobado`. | `Lefarma.IntegrationTests` (`WebApplicationFactory` + EF InMemory). |
| Integration | Prospecto (`Nuevo`) upload → direct write, no staging row, no estatus change. | Same harness. |
| Frontend | Badge renders correct count from `cuentasFormaPago`; zero → no badge; badge opens modal; modal lists correct carátulas + empty state. | Component render tests (Playwright optional — none wired today). |

---

## 10. Migration Rollout Plan

**Order (strict):**

1. **DB migration `025`** — run on target environment. Idempotent, zero downtime (all ADD COLUMN
   are nullable; the data UPDATE is a bounded ~14-row copy). No schema locks beyond the brief
   ALTER. `id_cuen` drift fix lands here.
2. **Backend deploy** — new entities/configs/DTOs/service/controller. The old `/{id}/caratula`
   becomes a 410 shim. Backend is backward-compatible with both pre- and post-migration DB
   (nullable columns), so a brief overlap is safe.
3. **Frontend deploy** — badge + modal + per-account slot. Must ship **after** backend (depends
   on `GET /{id}/caratulas` and cuenta-scoped upload routes).

**Backward-compat window:** between steps 1 and 3, the old frontend still calls `/{id}/caratula`
→ hits the 410 shim → upload fails gracefully. Acceptable for a short window; coordinate same-day
deploys. **No data loss** at any point — legacy `caratula_path` is never dropped.

**Downtime risk:** none expected. All schema changes are additive nullable columns + one bounded
UPDATE. If the UPDATE is slow (it won't be at ~14 rows), it can run in a transaction off-hours.

---

## Open Questions

- None blocking. Minor (deferred to apply): exact deprecated-shim HTTP semantics (410 vs 200
  no-op); whether to clean up the dead `proveedores_detalle.caratula_url` duplicate column
  (added by migration 008:97-98, never used by code) — out of scope here, candidate for a later
  cleanup script.
