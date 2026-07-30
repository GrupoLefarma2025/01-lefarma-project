# Tasks: Carátulas por Cuenta de Proveedor

> SDD tasks phase for change `caratulas-por-cuenta-proveedor`.
> Authoritative inputs: `design.md` (493 lines, complete migration 025 inline), `specs/proveedores/spec.md`,
> `specs/caratulas-proveedor/spec.md`, `proposal.md`. Gatekeeper review: Engram #322 (PASS, 1 mis-citation).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~720 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Slice A) → PR 2 (Slice B) → PR 3 (Slice C) |
| Delivery strategy | ask-always |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| A — Data foundation | Migration 025 + domain/EF config. Behavior-neutral: carátula still served via legacy path until backend reads the new column. | PR 1 → main | The "safe first PR". Includes migration dry-run verification. Shippable independently; zero behavior change. |
| B — Backend behavior | Service routing/diff/promote, controller endpoints, DTOs/extensions, unit + integration tests, dead-code audit. | PR 2 → PR 1 (or main after PR 1 lands) | Depends on Slice A. Old `/{id}/caratula` becomes a 410 shim during the overlap window. |
| C — Frontend | API client, count badge, CaratulasPreviewModal, account-card slot, legacy UI removal. | PR 3 → PR 2 (or main after PR 2 lands) | Depends on Slice B (`GET /{id}/caratulas`, cuenta-scoped routes). Preflight audit gates all UI edits. |

> **Deploy order (strict, per design §10):** DB (025) → backend → frontend. Same-day deploy advised
> so the 410 shim overlap is short. No data loss at any point (legacy `caratula_path` never dropped).

---

## Slice A — Data Foundation (DB + minimal backend, behavior-neutral)

- [x] **TASK-A1: Create migration 025 SQL file**
  - Slice: A · Depends on: —
  - Files: `lefarma.database/025_caratula_por_cuenta.sql` (new)
  - Estimate: M ~140 lines
  - Acceptance check: File exists with the complete idempotent SQL from `design.md` §2 (6 steps: ADD caratula_path to live + staging; ADD id_cuen to staging; back-fill legacy carátulas to MIN(id_cuenta) active account; ensure proveedores_detalle.caratula_path nullable; verification SELECT). Every ALTER guarded by `COL_LENGTH(...) IS NULL`. Content == design.md lines 82–244.
  - Notes: This task only CREATES the file. Do NOT run against a DB here (that is TASK-A2). `id_cuen` step 3 is the drift fix (migration 008:61–72 never created it).

- [ ] **TASK-A2: Migration 025 dry-run on dev DB (idempotency proof)**  ← PENDING-MANUAL (operator)
  - Slice: A · Depends on: A1
  - Files: (dev SQL Server — no repo file)
  - Estimate: S ~0 repo lines (verification)
  - Acceptance check: Run `025_caratula_por_cuenta.sql` TWICE against a dev DB → both runs complete with no error. Verification SELECT shows `caratula_path` on both cuenta tables, `id_cuen` on staging, `id_cuenta` PK present. On first run, `@caratulas_migradas` matches the ~14 legacy rows; second run reports 0 migrated (idempotent). Confirms spec scenario "Migration 025 is re-runnable".
  - Notes: Operator/manual step. Use the `sql-server-query` skill or SSMS. No INSERT/UPDATE/DELETE beyond what the script contains.

- [x] **TASK-A3: Add CaratulaPath to cuenta domain entities**
  - Slice: A · Depends on: A1
  - Files: `lefarma.backend/src/Lefarma.API/Domain/Entities/Catalogos/ProveedorFormaPagoCuenta.cs`, `.../StagingProveedorFormaPagoCuenta.cs`
  - Estimate: S ~3 lines
  - Acceptance check: `dotnet build` succeeds; both entities declare `public string? CaratulaPath { get; set; }`.
  - Notes: `IdCuen` already exists on the staging entity (entity-level); only the DB column was missing (fixed by TASK-A1 step 3). Do not add IdCuen here.

- [x] **TASK-A4: Mark ProveedorDetalle.CaratulaPath obsolete**  ← completed in Slice B (deferred per orchestrator); [Obsolete] + xmldoc added, generates CS0618 audit warnings
  - Slice: A · Depends on: A3
  - Files: `lefarma.backend/src/Lefarma.API/Domain/Entities/Catalogos/ProveedorDetalle.cs`
  - Estimate: S ~3 lines
  - Acceptance check: `dotnet build` succeeds; property has `[Obsolete("Use ProveedorFormaPagoCuenta.CaratulaPath")]` + XML doc stating it is kept only for rollback/migration. CS0618 warnings are expected (feed TASK-B8 audit).
  - Notes: Do NOT delete the property or its column. Preserves rollback per binding rule + design §2 rollback notes.

- [x] **TASK-A5: Map CaratulaPath in EF configurations**
  - Slice: A · Depends on: A3
  - Files: `lefarma.backend/src/Lefarma.API/Infrastructure/Data/Configurations/Catalogos/ProveedorFormaPagoCuentaConfiguration.cs`, `.../StagingProveedorFormaPagoCuentaConfiguration.cs`
  - Estimate: S ~4 lines
  - Acceptance check: `dotnet build` succeeds; both configs map `CaratulaPath → caratula_path` (HasMaxLength(500), no `.IsRequired()`); staging `IdCuen → id_cuen` confirmed already mapped.
  - Notes: No EF migration generated (manual SQL rule — design §3). Nullable mapping only so queries/projections include it.

---

## Slice B — Backend Behavior (service + controller + diff + DTOs + tests)

- [x] **TASK-B1: DTOs + extensions for carátula**
  - Slice: B · Depends on: A3, A5
  - Files: `.../Features/Catalogos/Proveedores/DTOs/ProveedorDTOs.cs`, `.../Extensions/ProveedorExtensions.cs`
  - Estimate: S ~15 lines
  - Acceptance check: `dotnet build` succeeds. `ProveedorFormaPagoCuentaResponse` + `StagingProveedorFormaPagoCuentaResponse` gain `CaratulaUrl`. Cuenta request DTOs gain optional `CaratulaUrl`. New `CaratulaCuentaResponse { int CuentaId; string Ultimos4; string? CaratulaUrl; }`. `ProveedorExtensions` maps `CaratulaPath ↔ CaratulaUrl` for both cuenta response types.
  - Notes: Foundational for controller, diff, and frontend. Do first in Slice B. Mirror the existing `CaratulaUrl = entity.CaratulaPath` pattern (ProveedorExtensions.cs:~40).

- [x] **TASK-B2: GenerarDiff carátula CampoDiff + Ultimos4 helper**
  - Slice: B · Depends on: B1
  - Files: `.../Features/Catalogos/Proveedores/ProveedorService.cs` (GenerarDiff ~1032; intersect loop 1091–1112; new-cuenta branch 1084–1089)
  - Estimate: M ~30 lines
  - Acceptance check: Unit test asserts `diffs.Single().Label == "Carátula cuenta ••1234 actualizada"` (replace) and `"Carátula cuenta ••1234 agregada"` (first-time); `Campo == "CuentasFormaPago[{id}].Caratula"`. New-account branch emits `…agregada`.
  - Notes: CLABE-preferred last4 (matches existing derivation at lines 1080/1087). `••` = two literal U+2022 bullets (UTF-8, accent on Carátula/actualizada/agregada preserved). ValorAnterior/ValorNuevo = stored paths (null ValorAnterior for first-time).

- [x] **TASK-B3: Estatus routing — RutarCaratulaPorEstatusAsync + EscribirCaratulaDirectoAsync**  ← DEVIATION: switch-on-int requires a `_ =>` arm; implemented as `DeterminarRutaCaratula` pure helper (testable) whose `_ =>` returns Conflict (runtime guard). No silent default — `_` is an explicit rejection.
  - Slice: B · Depends on: B1
  - Files: `.../Features/Catalogos/Proveedores/ProveedorService.cs`
  - Estimate: M ~40 lines
  - Acceptance check: Unit test covers all four estatus + unknown. Nuevo/Rechazado → `EscribirCaratulaDirectoAsync` (sets CaratulaPath, FechaModificacion=UtcNow, SaveChanges; no staging row, no diff, no estatus flip). Aprobado/EditadoPendiente → routes to staging (B4). Unknown → `Conflict`. The `switch` has NO default branch (exhaustiveness guard).
  - Notes: Gatekeeper #322 correction — the `Rechazado → direct` precedent is `UpdateAsync:249` (NOT :573; :573 is inside AutorizarAsync returning Conflict). Orphan-detalle 409 (line 653–657) disappears by construction (cuenta always exists). `EstatusProveedor` values are `public const int`, not an enum.

- [x] **TASK-B4: StagearCaratulaAsync — authorized standalone upload**
  - Slice: B · Depends on: B3 (A1 for id_cuen column)
  - Files: `.../Features/Catalogos/Proveedores/ProveedorService.cs`
  - Estimate: M ~40 lines
  - Acceptance check: Integration test — upload to an `Aprobado` supplier's account → staging row created, live `CaratulaPath` stays NULL, `GenerarDiff` length == 1, estatus → `EditadoPendiente`. Staged children clone live state; target cuenta `CaratulaPath = newPath`. **Preserve IdCuen** (C# fix at line ~492 sets `IdCuen = cuenta.IdCuen > 0 ? cuenta.IdCuen : null`).
  - Notes: Cloning live state into staging is what makes the diff length == 1 (Risk #6 mitigation). Depends on the id_cuen column existing (TASK-A1 step 3) or this throws.

- [x] **TASK-B5: Extend GuardarEnStagingAsync for carátula-inside-edit**
  - Slice: B · Depends on: B4
  - Files: `.../Features/Catalogos/Proveedores/ProveedorService.cs` (GuardarEnStagingAsync ~492 block)
  - Estimate: S ~8 lines
  - Acceptance check: Integration test — an edit carrying `CaratulaUrl` on an existing cuenta → staged child copies `CaratulaPath` per cuenta; `GenerarDiff` emits the carátula entry alongside other changed fields.
  - Notes: Reuse the per-cuenta copy logic from B4. No separate code path for carátula-inside-edit (design §4.3).

- [x] **TASK-B6: AutorizarEdicionAsync promote staged carátula**
  - Slice: B · Depends on: B4
  - Files: `.../Features/Catalogos/Proveedores/ProveedorService.cs` (account-promotion loop ~804–814)
  - Estimate: S ~5 lines
  - Acceptance check: Integration test — approve a carátula-only staging → staged `CaratulaPath` promotes to the live cuenta, estatus → `Aprobado`. Legacy `Detalle.CaratulaPath` copy (line ~767) left in place (no-op under new model). Reject path needs NO revert code (live cuenta never touched during staging — design §4.6).
  - Notes: Satisfies spec scenarios "Approver approves/rejects the carátula staging".

- [x] **TASK-B7: Controller endpoints (POST/DELETE/GET cuenta-carátula + 410 shim)**  ← NOTE: implemented POST cuenta-carátula + GET caratulas + 410 shim for old POST/DELETE. Old DELETE-cuenta-carátula NOT added (delete-carátula still served via upload-replace path; DELETE endpoint deferred — current scope = upload + GET per design §5 primary). BulkUpload.cs audited: ZERO old `/{id}/caratula` callers.
  - Slice: B · Depends on: B3, B4
  - Files: `.../Features/Catalogos/Proveedores/ProveedoresController.cs`
  - Estimate: M ~80 lines
  - Acceptance check: `dotnet build` succeeds. `POST {id}/cuentas/{idCuen}/caratula` (multipart; jpg/jpeg/png/gif/webp/pdf; ≤10 MB; file name `caratula_cuenta_{idCuen}_{guid}{ext}` under `caratulas/cuentas/`) → calls `RutarCaratulaPorEstatusAsync`. `DELETE {id}/cuentas/{idCuen}/caratula` → same routing (removal = a carátula change; authorized stages it, prospecto deletes directly). `GET {id}/caratulas` → `CaratulaCuentaResponse[]` (accounts with non-null caratula_path only). Old `POST/DELETE {id}/caratula` → 410 Gone shim with migration message.
  - Notes: Audit `ProveedorService.BulkUpload.cs` for old `/{id}/caratula` callers (Risk #7). DELETE-on-authorized stages the removal so it surfaces in the diff.

- [x] **TASK-B8: Dead-code audit of ProveedorDetalle.CaratulaPath readers**  ← AUDIT: 12 CS0618 warnings (ProveedorService.cs ×10 + ProveedorExtensions.cs ×2). Readers = legacy create/update detalle writes, old UpdateCaratulaAsync/DeleteCaratulaAsync (kept as 410-shim rollback surface), AutorizarEdicion legacy no-op (line ~767), staging response mapping, extension mapping. NONE need behavioral migration in Slice B (new GET /caratulas reads the new source; legacy response mappings stay for pre-Slice-C frontend).
  - Slice: B · Depends on: A4, B1, B3, B5, B6
  - Files: verification across `lefarma.backend/src/Lefarma.API/`
  - Estimate: S ~0–5 lines (possible comment cleanup)
  - Acceptance check: `dotnet build` → review every CS0618 warning; confirm no production code path still depends on `ProveedorDetalle.CaratulaPath` for behavior (the extension mapping the legacy field is allowed for rollback). `rg ProveedorDetalle.*CaratulaPath|Detalle\.CaratulaPath` over `Features/` returns only the intentionally-retained rollback/extension references. Surface any unexpected reader to the user before deleting.
  - Notes: Column kept nullable but obsolete. This is the "confirm no code still depends on it" task the orchestrator called out. Do not delete the column.

- [x] **TASK-B9: Unit + integration tests for estatus routing & migration idempotency**  ← 20 unit tests (GenerarDiff labels, Ultimos4, routing 4+unknown) + 5 integration tests (InMemory: Nuevo direct, Aprobado staging diff==1, approve promote, reject untouched, cuenta-missing NotFound). 27 tests pass, 0 fail. Migration idempotency deferred to TASK-A2 (operator).
  - Slice: B · Depends on: B2, B3, B4, B6
  - Files: `lefarma.backend/tests/Lefarma.UnitTests/` (GenerarDiff + Ultimos4 + routing), `.../Lefarma.IntegrationTests/` (upload→stage→approve/reject cycle, prospecto direct write)
  - Estimate: L ~120 lines
  - Acceptance check: `dotnet test` green. Unit: GenerarDiff exact labels (replace/agregada/eliminada), Ultimos4 CLABE-vs-cuenta fallback, all four estatus + unknown→Conflict. Integration (WebApplicationFactory + EF InMemory): Aprobado upload → staging + EditadoPendiente + live untouched; approve → promote; reject → live untouched + Aprobado; Nuevo upload → direct write, no staging row. Migration idempotency asserted via TASK-A2 replay (or a pure C# port of the MIN(id_cuenta) predicate).
  - Notes: Asserts spec scenarios verbatim. Keep tests with the behavior they verify (work-unit-commits rule).

---

## Slice C — Frontend (UI relocation + badge + modal)

- [x] **TASK-C1: Preflight audit of ProveedoresList.tsx carátula references**  ← COMPLETE: 41 grep hits mapped. KEEP=4 (legacy DTO fields L80/89 + fullscreen viewer L1775/1780), MODIFY=2 (ProveedorFormaPagoCuenta +caratulaUrl; guard drop !caratulaChanged), DELETE=~35 across 7 blocks (state 273-275, handleNuevoProveedor reset, handleCaratulaChange, handleEditProveedor carátula load, save bypass+inline API.post, row thumbnail, Datos de Contacto block), RELOCATE=account-card slot, BADGE=count from cuentasFormaPago.filter(c=>c.caratulaUrl), MODAL=getCaratulas feed. Gated C3-C7.
  - Slice: C · Depends on: —
  - Files: `lefarma.frontend/src/pages/catalogos/generales/Proveedores/ProveedoresList.tsx`
  - Estimate: S ~0 repo lines (relocation map only)
  - Acceptance check: Produce a relocation map of all ~34 case-insensitive `caratula` grep hits: which RELOCATE to the account card (e.g. `caratulaFile`/`caratulaPreview` state at 273–275, `handleCaratulaChange` at 428–435) vs which DELETE (Datos de Contacto block 1243–1290, `handleSaveProveedor` bypass 574–605, single thumbnail 722–755). Map captured in the apply session notes / commit body.
  - Notes: HIGH risk (design §8 #1, #5). MUST run before any UI edit task (C3–C7). Some state is reusable by the account-card slot — do not delete blindly. Re-run `rg -i -c caratula` to confirm the count before editing.

- [x] **TASK-C2: API client functions**  ← COMPLETE: added proveedorApi.uploadCuentaCaratula (multipart POST /cuentas/{idCuen}/caratula) + getCaratulas (GET /caratulas). NO deleteCuentaCaratula (backend has no DELETE cuenta-carátula endpoint — orchestrator confirmed). Removed inline API.post(…/caratula) at save (C7 removed the whole block).
  - Slice: C · Depends on: —
  - Files: `lefarma.frontend/src/services/api.ts`
  - Estimate: S ~20 lines
  - Acceptance check: `npm run build` + `npm run lint` succeed. `proveedorApi` gains `uploadCuentaCaratula(id, idCuen, file)` (FormData, multipart), `deleteCuentaCaratula(id, idCuen)`, `getCaratulas(id)`. The inline `API.post(\`${ENDPOINT}/${savedId}/caratula\`)` at line ~604 is removed (carátula is now per-account).
  - Notes: Formalize into `proveedorApi` (alongside existing autorizar/rechazar/bulkUpload), per design §7 decision.

- [x] **TASK-C3: New CaratulasPreviewModal component**  ← COMPLETE: 162-line component. Props {proveedorId, open, onOpenChange, onPreview?}. onPreview added (justified deviation) to reuse parent fullscreen viewer per spec "reuses the existing fullscreen viewer". Fetches getCaratulas on open; empty state "No hay carátulas para este proveedor."; loading+error states; shadcn Dialog+ScrollArea+Badge; one entry per carátula (••ultimos4 + Ver button).
  - Slice: C · Depends on: C2
  - Files: `.../generales/Proveedores/CaratulasPreviewModal.tsx` (new)
  - Estimate: M ~100 lines
  - Acceptance check: `npm run build` + `npm run lint` succeed. Props `{ proveedorId: number; open: boolean; onOpenChange }`. On open calls `getCaratulas(proveedorId)` → lists one entry per carátula (ultimos4 + preview button). Empty state: "No hay carátulas para este proveedor." Preview reuses the existing fullscreen viewer (`setFullscreenImage`). Uses shadcn `Dialog` + `ScrollArea` + `Badge`.
  - Notes: Satisfies spec scenarios "Modal lists one entry per carátula", "Empty state", "Preview reuses the fullscreen viewer".

- [x] **TASK-C4: Count badge replaces row thumbnail**  ← COMPLETE: Razón Social cell now renders <Badge variant="secondary">{n} carátula{n>1?'s':''}</Badge> from cuentasFormaPago.filter(c=>!!c.caratulaUrl).length; n==0 → no badge. Click → setCaratulasModalProveedorId. Building icon + razonSocial + rfc preserved. Single thumbnail removed. Badge data source = cuenta DTO caratulaUrl (Slice B) — NO backend tweak needed.
  - Slice: C · Depends on: C1, C3
  - Files: `.../ProveedoresList.tsx` (Razón Social cell 722–755)
  - Estimate: S ~20 lines (net)
  - Acceptance check: `npm run build` + lint succeed. Row renders `<Badge variant="secondary">` with count from `row.original.cuentasFormaPago?.filter(c => c.caratulaUrl).length` — `n>1` pluralizes ("3 carátulas"), `n==0` renders no badge. Click → opens `CaratulasPreviewModal`. No single-thumbnail element remains. Building icon + razonSocial + rfc stack preserved.
  - Notes: Implements spec "Removal of the legacy single-thumbnail" + "Carátula count badge per supplier row".

- [x] **TASK-C5: "Ver carátulas" action button**  ← COMPLETE: added always-visible "Ver carátulas" icon action (FileText) in actions column → same setCaratulasModalProveedorId target as badge.
  - Slice: C · Depends on: C3, C4
  - Files: `.../ProveedoresList.tsx` (actions column 859–942)
  - Estimate: S ~12 lines
  - Acceptance check: build + lint succeed; a "Ver carátulas" icon action opens `CaratulasPreviewModal` for `row.original` (same modal target as the badge click).
  - Notes: Pair with the badge as the two entry points to the modal (design §6).

- [x] **TASK-C6: Account-card carátula slot (relocate controls)**  ← COMPLETE: carátula slot inside each ACTIVE account card. Empty → "Subir carátula" (label+hidden file input); filled → preview thumb (img/FileText for PDF) + "Ver tamaño completo" + "Reemplazar". Upload via handleUploadCuentaCaratula → proveedorApi.uploadCuentaCaratula(proveedorId, cuentaId, file); updates cuenta.caratulaUrl in local state from response.url (stripped /media/archivos/). New accounts (idCuen===0) → hint "Guarda el proveedor…". buildProveedorSnapshot untouched.
  - Slice: C · Depends on: C1, C2, C4
  - Files: `.../ProveedoresList.tsx` (account cards 1294–1551)
  - Estimate: M ~40 lines
  - Acceptance check: build + lint succeed. Inside each account card: if `cuenta.caratulaUrl` → preview thumb + "Reemplazar" + "Eliminar" (calling `uploadCuentaCaratula`/`deleteCuentaCaratula`); else → upload control. "Datos de Contacto" contains NO carátula field. State relocated per the TASK-C1 map (not re-declared).
  - Notes: Keep `buildProveedorSnapshot` intact (Risk #1). Satisfies spec "Carátula UI inside each account card". DEVIATION: no "Eliminar" button — backend exposes no DELETE cuenta-carátula endpoint (TASK-B7 deferred it); replace path covers the spec's required "replace control".

- [x] **TASK-C7: Remove legacy carátula UI (Datos de Contacto + save bypass)**  ← COMPLETE: removed state (caratulaFile/Changed/Preview), resets in handleNuevoProveedor, handleCaratulaChange, handleEditProveedor carátula load, save guard !caratulaChanged + inline API.post carátula block + orphaned savedId, Datos de Contacto carátula block. rg -i caratula now returns only account-card + badge + modal + legacy DTO fields (rollback) + fullscreen viewer references. Diff modal untouched.
  - Slice: C · Depends on: C1, C6
  - Files: `.../ProveedoresList.tsx` (1243–1290 Datos de Contacto block; 574–605 `handleSaveProveedor` bypass; state 273–275; `handleCaratulaChange` 428–435 — only what C1 flagged DELETE)
  - Estimate: S ~−60 net (removal)
  - Acceptance check: build + lint succeed. `rg -i caratula` in ProveedoresList returns only account-card + badge + modal references — no single-thumbnail path, no `handleSaveProveedor` carátula bypass. The diff modal (~1672–1740) is untouched (renders `diferencias[].Label` for free, including the new `Carátula cuenta ••…` labels).
  - Notes: Remove only what the C1 audit marked DELETE. Do not touch the diff modal. Orphan state/hooks removed only if the relocation made them unused (clean up your own orphans).

---

## Coverage Map (design section → task)

| Design § | Coverage |
|----------|----------|
| §2 SQL migration 025 | TASK-A1 (create) + TASK-A2 (dry-run) |
| §3 Backend Domain/EF | TASK-A3 (entities) + TASK-A4 (obsolete) + TASK-A5 (configs) |
| §4.1–4.3 Service routing/staging | TASK-B3 (routing+direct) + TASK-B4 (stage) + TASK-B5 (in-edit) |
| §4.4 GenerarDiff CampoDiff | TASK-B2 (+ Ultimos4) |
| §4.5–4.6 Autorizar/reject | TASK-B6 (reject is no-op by construction) |
| §5 Controller/DTOs | TASK-B1 (DTOs/extensions) + TASK-B7 (endpoints) |
| §6 Frontend components | TASK-C3 (modal) + TASK-C4 (badge) + TASK-C5 (action) + TASK-C6 (slot) + TASK-C7 (removal) |
| §7 API client | TASK-C2 |
| §8 Risks | TASK-C1 (audit, Risk #1/#5) + TASK-B8 (dead-code, legacy column) |
| §9 Test strategy | TASK-B9 (+ embedded acceptance checks in B2/B3/B4/B6) |
| Special: preflight audit | TASK-C1 |
| Special: migration dry-run | TASK-A2 |
| Special: dead-code audit | TASK-B8 |

## Notes for sdd-apply
- Apply order respects slice dependency: A → B → C. Within a slice, honor `Depends on`.
- Each task maps to one work-unit commit (clear start, clear finish, verification in-unit).
- Slice A is the safe first PR; Slices B and C each individually stay under the 400-line budget.
- Do NOT run `dotnet ef migrations` — schema changes are the manual script TASK-A1 only.
