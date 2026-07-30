# Exploration: Carátulas por Cuenta de Proveedor

> SDD explore phase for change `caratulas-por-cuenta-proveedor`.
> Scope: move the supplier carátula (cover sheet PDF/image) from 1:1 with the
> supplier to 1:N — one carátula per bank account / payment method. Add
> re-authorization semantics, move the carátula UI out of the supplier-edit
> detail section and into each account, and add a "ver carátulas" button to the
> supplier list.

---

## 1. Current Architecture Map

### Entities (file paths)

| Entity | File | Key fields |
|--------|------|-----------|
| `Proveedor` | `Domain/Entities/Catalogos/Proveedor.cs` | `IdProveedor`, `Estatus`, nav `Detalle?` (1:1), nav `CuentasFormaPago` (1:N) |
| `ProveedorDetalle` | `Domain/Entities/Catalogos/ProveedorDetalle.cs` | `IdDetalle`, `IdProveedor`, contact fields, **`CaratulaPath`** (the ONLY place carátula lives today) |
| `ProveedorFormaPagoCuenta` | `Domain/Entities/Catalogos/ProveedorFormaPagoCuenta.cs` | `IdCuen`, `IdProveedor`, `IdFormaPago`, `IdBanco`, `NumeroCuenta`, `Clabe`, `NumeroTarjeta`, `Beneficiario`, `CorreoNotificacion`, `Activo`. **NO carátula column.** |
| `ProveedorFormaPago` | `Domain/Entities/Catalogos/ProveedorFormaPago.cs` | Legacy vinculacion table (id_vinculacion). NOT used for carátula. |
| `StagingProveedor` | `Domain/Entities/Catalogos/StagingProveedor.cs` | `IdStaging`, `IdProveedor`, nav `Detalle?`, nav `CuentasFormaPago` |
| `StagingProveedorDetalle` | `Domain/Entities/Catalogos/StagingProveedorDetalle.cs` | mirrors detalle, **has `CaratulaPath`** |
| `StagingProveedorFormaPagoCuenta` | `Domain/Entities/Catalogos/StagingProveedorFormaPagoCuenta.cs` | `IdStagingCuenta`, `IdCuen` (nullable, null = new), `IdStaging`, account fields. **NO carátula column.** |

### Relationships
```
Proveedor (1) ──< ProveedorFormaPagoCuenta (N)     [bank accounts / payment methods]
Proveedor (1) ──1 ProveedorDetalle (1)              [contact + carátula TODAY]
StagingProveedor (1) ──< StagingProveedorFormaPagoCuenta (N)
StagingProveedor (1) ──1 StagingProveedorDetalle (1)
```

### EF Configurations
- `ProveedorDetalleConfiguration.cs` — maps `caratula_path` NVARCHAR(500) on `catalogos.proveedores_detalle`.
- `ProveedorFormaPagoCuentaConfiguration.cs` — maps to `catalogos.proveedor_forma_pago_cuentas`, **no carátula column**.
- `StagingProveedorDetalleConfiguration.cs` — maps `caratula_path` on `staging.proveedores_detalles`.
- `StagingProveedorFormaPagoCuentaConfiguration.cs` — maps to `staging.proveedor_forma_pago_cuentas`, **no carátula column**.

### DbContext registrations (`ApplicationDbContext.cs:60-65`)
```
DbSet<Proveedor> Proveedores
DbSet<ProveedorDetalle> ProveedoresDetalle
DbSet<ProveedorFormaPagoCuenta> ProveedoresFormasPagoCuentas
DbSet<StagingProveedor> StagingProveedores
DbSet<StagingProveedorDetalle> StagingProveedoresDetalle
DbSet<StagingProveedorFormaPagoCuenta> StagingProveedoresFormasPagoCuentas
```

---

## 2. Carátula Flow Today

**Upload** — `ProveedoresController.UploadCaratula` (`ProveedoresController.cs:152-212`)
- Route: `POST /api/catalogos/Proveedores/{id}/caratula`
- Accepts `IFormFile`, validates extension (jpg/png/gif/webp/pdf), max 10 MB.
- Saves file to `{ArchivosSettings:BasePath}/caratulas/caratula_proveedor_{id}_{guid}{ext}`.
- Calls `ProveedorService.UpdateCaratulaAsync(id, relativePath)`.

**Persist** — `ProveedorService.UpdateCaratulaAsync` (`ProveedorService.cs:635-672`)
- Validates path traversal.
- Loads proveedor via `GetByIdWithDetailsAsync`.
- **Requires `proveedor.Detalle != null`** — returns `Conflict("El proveedor no tiene detalle")` if missing (the orphan-detalle bug, still present at line 653-657).
- Sets `proveedor.Detalle.CaratulaPath = caratulaPath`.
- **Carátula BYPASSES staging entirely** — written directly to the live `catalogos.proveedores_detalle` row regardless of supplier estatus. (Explicit comment at `ProveedorService.cs:476-477`.)

**Serve** — static files middleware (`Program.cs:489-517`)
- Two `UseStaticFiles` registrations, both driven by `ArchivosSettings:BasePath`:
  - `/api/media/archivos` and `/media/archivos` (legacy URL the frontend uses).
- `no-cache` headers enforced.

**Delete** — `ProveedoresController.DeleteCaratula` (`ProveedoresController.cs:214-227`) → `ProveedorService.DeleteCaratulaAsync` (`ProveedorService.cs:674-721`). Deletes file from disk + nulls `CaratulaPath`. Also bypasses staging.

**Display** — `ProveedoresList.tsx`
- In the table, the "Razón Social" column cell shows the carátula thumbnail (image or PDF icon) from `row.original.detalle?.caratulaUrl` resolved against `VITE_API_URL/media/archivos/...` (lines 722-755).
- In the supplier edit modal, a file input + preview lives in the **"Datos de Contacto"** section (lines 1243-1290) — this is the "carátula en la edición de prospectos" the user wants to REMOVE from here.
- A fullscreen viewer (portal to `document.body`) shows the image/PDF (lines 1756-1797).

---

## 3. Accounts / Payment Methods Today

**Schema** — `catalogos.proveedor_forma_pago_cuentas` (migration `005_alter_proveedores_formas_pago.sql:84-106`):
- PK `id_cuenta` (mapped as `IdCuen` in C#).
- FK `id_proveedor` → `catalogos.proveedores` (CASCADE delete).
- FK `id_forma_pago`, `id_banco`.
- **UNIQUE constraint** `UQ_Proveedor_FormaPago_Cuenta (id_proveedor, id_forma_pago, numero_cuenta)`.
- **No carátula / file column.**

**Staging schema** — `staging.proveedor_forma_pago_cuentas` (migration `008:61-72`):
- PK `id_staging_cuenta`.
- `id_staging` FK.
- Account fields. `activo` default 1.
- ⚠️ **SCHEMA DRIFT**: the C# entity maps `IdCuen → id_cuen` but NO migration creates that column. It was added ad-hoc to the DB. The proposed migration MUST include an idempotent `ALTER TABLE staging.proveedor_forma_pago_cuentas ADD id_cuen INT NULL` to avoid depending on out-of-band changes.

**Frontend accounts UI** (`ProveedoresList.tsx:1294-1551`)
- Each account is a card with header (forma de pago, banco, "tiene órdenes" badge) and fields (forma de pago select, banco select, número de cuenta [11 digits formatted in groups of 4], CLABE [18 digits], beneficiario).
- New accounts (`idCuen === 0`) are inline-editable. Saved accounts need an "Editar" confirmation modal before becoming editable.
- Inactive accounts are in a collapsible section.
- A carátula upload slot per account would naturally fit INSIDE each account card header or body.

---

## 4. Authorization Flow Today

**Status machine** (`EstatusProveedor`, `ProveedorDTOs.cs:116-131`):
- `1 = Nuevo`, `2 = Aprobado`, `3 = Rechazado`, `4 = EditadoPendiente`.

**Edit routing** (`ProveedorService.UpdateAsync:236-400`):
- `Nuevo (1)` / `Rechazado (3)` → **direct update** on live tables.
- `Aprobado (2)` / `EditadoPendiente (4)` → **`GuardarEnStagingAsync`** (creates/updates a `StagingProveedor` row + child staging rows; sets proveedor estatus to `4`).

**Staging save** (`GuardarEnStagingAsync:406-524`):
- Upserts `StagingProveedor` (one per proveedor).
- Upserts `StagingProveedorDetalle` — **carátula deliberately NOT copied** to staging (comment line 476-477); carátula is uploaded separately and bypasses authorization.
- Rebuilds `StagingProveedorFormaPagoCuenta` (removes all existing, re-inserts). Copies `IdCuen = cuenta.IdCuen > 0 ? cuenta.IdCuen : null` (the previously-buggy line — **NOW FIXED in C# code**, but depends on the ad-hoc `id_cuen` column existing in the DB).

**Authorize edit** (`AutorizarEdicionAsync:723-913`):
- Applies staging → live, flips estatus back to `Aprobado (2)`.
- Account merge has defensive dedupe by CLABE or banco+numero_cuenta (lines 854-894) to survive missing `IdCuen`.
- Copies `staging.Detalle.CaratulaPath → proveedor.Detalle.CaratulaPath` (line 767) — though staging carátula is usually null because upload bypasses staging.

**Diff** (`GenerarDiff:1032-1115`):
- Compares scalar fields, detalle contact fields, and accounts (added/removed/changed).
- **Carátula is NOT part of the diff** — there is no `CampoDiff` for carátula today. This is exactly what requirement #2 ("indicate that la carátula cambió") needs to add.

**Frontend diff viewer** (`ProveedoresList.tsx:1672-1740`):
- `handleVerDiff` calls `GET /{id}/staging`, renders the `diferencias` table with valorAnterior/valorNuevo, plus Autorizar/Rechazar buttons.

---

## 5. Prospecto Module Today

**There is NO separate "Prospecto" entity, controller, service, or component.** A grep for `[Pp]rospecto` across both backend and frontend returns ZERO matches.

**Conclusion**: The user's "ProspectoList" and "edición de prospectos" refer to **`ProveedoresList.tsx`** and the supplier edit modal within it. In Mexican CxP (accounts-payable) terminology, a supplier in `Nuevo (1)` status is a "prospecto" (prospect) until CxP authorizes it. This is the same module.

- Route: `/catalogos/proveedores` (`AppRoutes.tsx:71`) guarded by `proveedores.ver_listado`.
- Component: `pages/catalogos/generales/Proveedores/ProveedoresList.tsx` (1800 lines, single-file, local `useState` — **NO Zustand store** for this module).

---

## 6. Frontend Components Map

| Concern | Location | Notes |
|---------|----------|-------|
| Supplier list (the "ProspectoList") | `pages/catalogos/generales/Proveedores/ProveedoresList.tsx` | TanStack Table columns: razonsocial (+carátula thumb), rfc, codigoPostal, regimenFiscal, cuentas count, detalle contacto, estatus, comentario, actions |
| Carátula in edit modal (TO REMOVE) | same file, lines 1243-1290 | "Datos de Contacto" section |
| Accounts editing | same file, lines 1294-1551 | per-account cards |
| Carátula upload handler | `handleCaratulaChange` (428-439) + `handleSaveProveedor` (600-612) | posts to `/{savedId}/caratula` |
| Fullscreen viewer | same file, lines 1756-1797 | portal to body |
| Diff modal | same file, lines 1672-1740 | shows staging diferencias |
| API client | `services/api.ts` | `proveedorApi` only has autorizar/rechazar/bulkUpload. Carátula + CRUD use raw `API.post/put` directly. No Zustand store. |
| Helper modules | `BulkUploadModal.tsx`, `ClavesReferenciaModal.tsx` (same folder) | unrelated to carátula |

A "ver carátulas" button would naturally fit in the **`actions` column** (lines 859-942) next to Editar/Eliminar, opening a new modal that lists each account with its carátula thumbnail + preview.

---

## 7. Migration Impact Analysis (1:1 → 1:N carátula)

The cardinality change moves `caratula_path` from `proveedores_detalle` (1:1) to `proveedor_forma_pago_cuentas` (1:N). Touched layers:

### Database (new manual SQL script `025_*.sql`)
1. **`catalogos.proveedor_forma_pago_cuentas`** — `ALTER TABLE ... ADD caratula_path NVARCHAR(500) NULL`.
2. **`staging.proveedor_forma_pago_cuentas`** — `ALTER TABLE ... ADD caratula_path NVARCHAR(500) NULL` (and the idempotent `id_cuen INT NULL` fix for drift).
3. **Data migration of existing carátulas** — `UPDATE c SET c.caratula_path = d.caratula_path FROM catalogos.proveedor_forma_pago_cuentas c JOIN catalogos.proveedores_detalle d ON ... ` — but to WHICH account? Business decision needed (see Open Questions). A supplier may have N accounts and 1 existing carátula.
4. `catalogos.proveedores_detalle.caratula_path` — keep (nullable) for rollback, or drop later. Decision needed.
5. Legacy duplicate column `proveedores_detalle.caratula_url` (added in script 008:97-98, never used by code) — candidate for cleanup.

### Backend
- **Entities**: add `CaratulaPath` to `ProveedorFormaPagoCuenta` and `StagingProveedorFormaPagoCuenta`.
- **Configs**: map `caratula_path` in both cuenta configurations.
- **DTOs**: add `caratulaUrl` to `ProveedorFormaPagoCuentaResponse` + `StagingProveedorFormaPagoCuentaResponse`; add `caratulaUrl` to create/update cuenta request DTOs.
- **Extensions**: map `CaratulaPath ↔ caratulaUrl` in `ProveedorExtensions.ToResponse` for cuentas.
- **Service**:
  - New `UpdateCuentaCaratulaAsync(idProveedor, idCuen, path)` / `DeleteCuentaCaratulaAsync(...)`.
  - Re-authorization logic (requirement #2): on new carátula upload to an already-authorized supplier's account, flip to `EditadoPendiente` / staging; on edit, detect "only carátula changed" and emit a `CampoDiff` with label "Carátula".
  - Decide whether per-account carátula continues to bypass staging or now enters it (business decision).
  - `GenerarDiff`: add carátula comparison per account.
- **Controller**: new routes — likely `POST /{id}/cuentas/{idCuen}/caratula` and `DELETE /{id}/cuentas/{idCuen}/caratula`. File naming should include `idCuen` (e.g. `caratula_cuenta_{idCuen}_{guid}{ext}`).
- Remove/redirect old `POST /{id}/caratula` (keep as deprecated shim or remove outright — decision needed).

### Frontend
- **Move** the carátula file-input + preview OUT of the "Datos de Contacto" section and INTO each account card (header or body).
- **Per-account upload**: each card gets its own upload handler posting to the new cuenta-carátula endpoint.
- **"Ver carátulas" button** in the `actions` column → opens a new modal listing all accounts with their carátulas + preview (reuse the fullscreen viewer).
- The razonsocial thumbnail (lines 722-755) currently reads `detalle?.caratulaUrl` — needs rework (show account count with carátula, or the first/primary account's carátula).
- `proveedorApi` in `services/api.ts` — add `uploadCuentaCaratula(id, idCuen, file)`.

---

## 8. Open Questions for the Proposal Phase

> These MUST be answered by the user/product before spec writing can finish.

1. **Existing carátula migration**: ~14 suppliers currently have a carátula in `proveedores_detalle`. When we go 1:N, to which account(s) do we copy each existing carátula? Options: (a) the first/primary account, (b) all accounts, (c) leave them orphaned in detalle for manual re-assignment. **Recommendation needed.**

2. **Carátula + staging semantics (requirement #2)**: Today carátula BYPASSES staging. The new requirement says uploading a NEW carátula to an authorized supplier must request re-authorization. Does that mean per-account carátula now ENTERS staging (like account edits do), or does the upload itself flip the supplier to `EditadoPendiente`? The two have very different implementations.

3. **"Only carátula changed" detection**: When an edit is submitted where ONLY the carátula changed (everything else identical), the diff should show a single row "Carátula → cambió". Does "changed" mean the path string differs, or do we need content hashing? (Path differs is simpler and probably sufficient since uploads generate GUIDs.)

4. **Authorization granularity**: Is "authorized" still a supplier-level concept (estatus on `Proveedor`), or does requirement #2 imply per-account authorization? The current model has NO per-account estatus. Adding one is a much larger change.

5. **Old `/{id}/caratula` endpoint**: Deprecate (keep returning 200 but no-op / redirect) or hard-remove? Bulk-upload CSV and any other callers may reference it.

6. **`proveedores_detalle.caratula_path` column**: Keep nullable (for rollback) or drop after migration? And the dead `caratula_url` duplicate column — clean up now?

7. **File naming / storage**: Should per-account carátula files use a subfolder (`caratulas/cuentas/`) or stay flat with `caratula_cuenta_{idCuen}_*` naming? Affects the static-file path validation in the service.

8. **What is "primary account"?** The "ver carátulas" button implies a list. But the razonsocial thumbnail today shows ONE carátula — if a supplier has 3 accounts each with a carátula, which one is the list-row thumbnail?

---

## 9. Verified Facts (prior memory vs. current code)

| Prior claim | Verdict | Evidence |
|-------------|---------|----------|
| Carátula stored as `caratula_path` in `proveedores_detalle` (1:1) | ✅ **TRUE** | `ProveedorDetalle.cs:13`, `007_add_proveedor_caratula_path.sql:31-32` |
| Endpoint `POST /{id}/caratula` uploads it | ✅ **TRUE** | `ProveedoresController.cs:152-212` |
| Orphan detalle bug (~25/39 suppliers) causes 409 on upload | ✅ **STILL PRESENT** | `ProveedorService.cs:653-657` still returns `Conflict("El proveedor no tiene detalle")`. NOT auto-healed. |
| Cuenta = 11 digits, CLABE = 18 digits | ✅ **TRUE** | `ProveedoresList.tsx:495-497` (frontend); DB has no CHECK constraint |
| Staging IdCuen bug fixed | ⚠️ **PARTIALLY TRUE** | C# code fixed (`ProveedorService.cs:492` copies IdCuen), BUT no migration creates `id_cuen` in `staging.proveedor_forma_pago_cuentas` — schema drift; depends on ad-hoc ALTER. |
| Static files served from `ArchivosSettings:BasePath` (not hardcoded wwwroot) | ✅ **TRUE** | `Program.cs:489-517`, both `/api/media/archivos` and `/media/archivos` |
| Carátula bypasses staging | ✅ **TRUE** (newly discovered) | `ProveedorService.cs:476-477` explicit comment; `GenerarDiff` has no carátula field |
| There is a separate "Prospecto" module | ❌ **FALSE** | Zero matches for `[Pp]rospecto` in backend or frontend. "Prospecto" = supplier in `Nuevo` status. `ProveedoresList.tsx` is the screen. |

---

## Risks

1. **Orphan-detalle bug** is still live. Moving carátula to accounts actually *removes* this failure mode (accounts always exist for a supplier), but the migration must handle suppliers whose existing carátula is on the detalle but who have accounts.
2. **Staging `id_cuen` schema drift** — the proposed SQL migration must include an idempotent `ADD id_cuen INT NULL` to `staging.proveedor_forma_pago_cuentas`, or the existing fixed C# code will throw on environments where the ad-hoc ALTER wasn't applied.
3. **1:N cardinality change is wide** — touches DB (2 tables), 2 entities, 2 configs, 4+ DTOs, service (new methods + diff logic + re-auth logic), controller (new routes), and a 1800-line frontend component. Estimate should reflect this surface area.
4. **Carátula + staging re-authorization semantics are underspecified** (Open Question #2). This is the single biggest estimate risk — the difference between "carátula enters staging" and "upload flips estatus" is a large architectural fork.
5. **Existing carátula data migration** has no obvious default (Open Question #1). Getting this wrong loses or duplicates carátulas for ~14 suppliers.
6. **No Zustand store / no API client abstraction for carátula** — the frontend uses raw `API.post` inline; refactoring must preserve the existing inline style or introduce a store (scope creep risk).
7. **UNIQUE constraint** `UQ_Proveedor_FormaPago_Cuenta (id_proveedor, id_forma_pago, numero_cuenta)` on the accounts table is unaffected by carátula but worth noting for any account-creation changes.
8. **Frontend single-file complexity** — `ProveedoresList.tsx` is 1800 lines with tightly coupled state. Moving the carátula UI between sections risks regressions in the diff/snapshot logic (`buildProveedorSnapshot`).

---

## Recommendation

Proceed to **propose** with the following framing:
- Confirm the 8 Open Questions with the user before spec, especially #1 (existing carátula migration), #2 (carátula + staging semantics), and #4 (authorization granularity).
- The technical approach is clear: add `caratula_path` to both cuenta tables + entities + configs + DTOs; add per-account upload/delete endpoints; extend `GenerarDiff` for carátula; move the UI from the contact section into account cards; add a "ver carátulas" modal.
- Sequence the SQL migration first (`025_*.sql`) so backend changes can be validated against the real schema, and resolve the staging `id_cuen` drift in the same script.

Ready for proposal: **YES** (pending answers to Open Questions #1, #2, #4).
