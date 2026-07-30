# Proposal: Carátulas por Cuenta de Proveedor

> **Status**: Ready for spec. The product-question round already ran upstream;
> the four binding decisions in §4 are settled and must NOT be re-asked.
> Source exploration: `openspec/changes/caratulas-por-cuenta-proveedor/explore.md`
> + Engram observations #312–#315.

## 1. Intent

The supplier carátula (cover sheet) is a payment-authorization document, but today
it is modeled **1:1 with the supplier** and **bypasses authorization entirely** —
uploaded directly to the live `proveedores_detalle` row with no diff and no approval
(`ProveedorService.cs:476-477`). That is both **wrong** (a carátula belongs to a
specific bank account, not the supplier in general) and a **control gap** (a carátula
changed on an already-approved supplier goes live instantly, unreviewed).

This change fixes the cardinality (**1:1 → 1:N, one carátula per account**) and
**closes the authorization gap** in a single, coherent move, while relocating the
carátula UI to where it now belongs — the account card.

## 2. Scope (capabilities)

| # | User requirement | Capability delivered |
|---|------------------|----------------------|
| 1 | One carátula per supplier account | Carátula becomes a field of `ProveedorFormaPagoCuenta` (live + staging). SQL migration + entity + DTO + extensions. |
| 2 | New carátula on authorized supplier → re-authorize; edit diff says "carátula changed" | Carátula upload **enters the staging workflow**; `GenerarDiff` gains a per-account carátula `CampoDiff`. |
| 3 | Move carátula out of supplier edit modal, into each account card | Remove carátula slot from the "Datos de Contacto" section; render one upload/preview slot per account card. |
| 4 | "Ver carátulas" button in ProveedoresList | New action in the `actions` column → modal listing each account + its carátula with preview (reuses the fullscreen viewer). |

## 3. Approach (high-level)

- **DB** (`025_*.sql`, manual — NEVER `dotnet ef migrations`):
  `ALTER … ADD caratula_path NVARCHAR(500) NULL` on both
  `catalogos.proveedor_forma_pago_cuentas` and `staging.proveedor_forma_pago_cuentas`;
  idempotent `ALTER staging.proveedor_forma_pago_cuentas ADD id_cuen INT NULL`
  (resolves the schema drift from #313); back-fill ~14 existing carátulas onto each
  supplier's first ACTIVE account; make `proveedores_detalle.caratula_path` nullable
  (kept for rollback).
- **Backend**: add `CaratulaPath` to both cuenta entities + EF configs; expose via
  cuenta DTOs + `ProveedorExtensions`; carátula upload now writes to **staging** and
  flips estatus to `EditadoPendiente` for already-authorized suppliers;
  `GenerarDiff` emits a per-account `CampoDiff`; new routes
  `POST /{id}/cuentas/{idCuen}/caratula` and `DELETE` counterpart; old
  `POST /{id}/caratula` kept as a deprecated shim.
- **Frontend**: relocate the file input/preview from "Datos de Contacto" into each
  account card; add a "Ver carátulas" action + preview modal; add
  `proveedorApi.uploadCuentaCaratula(id, idCuen, file)`. Keep local `useState` style
  (no Zustand refactor).

## 4. Business rules (BINDING — settled upstream)

1. **Existing carátula migration** → copy onto each supplier's **first ACTIVE**
   account, silently, no user intervention. (Accepted risk: misassignment if the old
   carátula didn't correspond to that account.)
2. **Carátula authorization flow** → **FULL STAGING**. A new carátula on an
   authorized supplier enters the complete staging workflow (visible diff → approve
   or reject). This **reverses** the intentional bypass at `ProveedorService.cs:476-477`.
3. **Authorization granularity** → **per supplier**, unchanged. One account's
   carátula change flips the whole supplier to `EditadoPendiente`. **No per-account
   estatus** is introduced.
4. **Diff message** → `"Carátula cuenta ••1234 actualizada"` (last 4 digits);
   for a NEW account that had none: `"Carátula cuenta ••1234 agregada"`.
5. **Orphan-detalle 409 becomes impossible** — carátula no longer depends on
   `ProveedorDetalle`; the `Conflict("El proveedor no tiene detalle")` branch dies
   with the cardinality change.
6. **Prospecto exemption** — a supplier in estatus `Nuevo (1)` ("prospecto") can
   upload carátulas freely (direct write); staging applies only to suppliers already
   authorized (`Aprobado` / `EditadoPendiente`).

## 5. Out of scope (non-goals)

- Per-account authorization model / per-account estatus.
- Bulk carátula upload.
- Carátula versioning or history (only current carátula per account).
- Any change to the "Prospecto" concept (it stays = supplier in `Nuevo` status).
- Carátula file-format validation beyond today's rules (jpg/png/gif/webp/pdf, 10 MB).
- Zustand refactor of `ProveedoresList.tsx` (keep `useState`).
- Drop of the legacy dead column `proveedores_detalle.caratula_url` (deferred).

## 6. Risks & open items

| Risk / open item | Severity | Mitigation / resolution |
|------------------|----------|--------------------------|
| `id_cuen` schema drift (#313) — the "fixed" staging bug may still be broken in prod | **High** | Migration `025` MUST include the idempotent `ADD id_cuen INT NULL`. |
| Other code depending on `ProveedorDetalle.CaratulaPath` as source of truth | Med | Audit all references during spec; razonsocial thumbnail (lines 722-755) must be reworked. |
| `ProveedoresList.tsx` (1800 lines, coupled state) — UI relocation risk | Med | Surgically move the slot; keep `buildProveedorSnapshot` intact; manual QA on edit + diff flows. |
| File-name collisions across accounts | Low | Convention: `caratulas/cuentas/caratula_cuenta_{idCuen}_{guid}{ext}`. |
| **Open**: old `POST /{id}/caratula` endpoint | Low | Recommend deprecated shim (bulk-upload CSV may call it); hard-remove later. |
| **Open**: when to drop `proveedores_detalle.caratula_path` | Low | Keep nullable now (rollback); drop in a later cleanup script post-verification. |
| **Open**: list-row thumbnail when a supplier has N carátulas | Low | Show an account-count badge instead of a single thumbnail (decide in design). |

## 7. First-slice suggestion (for tasks phase)

If the line forecast exceeds the 400-line review budget, split vertically:

- **Slice A (shippable alone)**: DB migration `025` + backend carátula-per-account
  **with the bypass preserved** (no auth change yet). Unblocks the frontend, fixes
  the `id_cuen` drift, removes the orphan-detalle 409.
- **Slice B**: full staging integration + `GenerarDiff` CampoDiff + UI relocation +
  "Ver carátulas" modal.

Decision deferred to the tasks phase per `delivery_strategy: ask-always`.

## 8. Estimated impact (workload guard)

| Layer | Files | Notes |
|-------|-------|-------|
| SQL | 1 | `025_caratula_por_cuenta.sql` |
| Backend | 6–8 | 2 entities, 2 EF configs, cuenta DTOs, `ProveedorExtensions`, `ProveedorService`, `ProveedoresController`, `GenerarDiff` |
| Frontend | 2–3 | `ProveedoresList.tsx` edits, new preview modal, `services/api.ts` |
| **Forecast** | — | **MEDIUM-HIGH ≈ 600–900 lines** — likely exceeds the 400-line budget → expect a split question during tasks. |

---

## Capabilities (contract with sdd-spec)

> `openspec/specs/` is greenfield — there are no existing specs. All capabilities
> below are NEW and each becomes a full `openspec/specs/<name>/spec.md`.

- `proveedores` — supplier catalog: estatus machine, accounts
  (`ProveedorFormaPagoCuenta`), the staging/authorization flow, and `GenerarDiff`.
  The carátula-per-account data model and re-authorization semantics live here.
- `caratulas-proveedor` — the carátula file lifecycle as a first-class concern:
  per-account storage, upload/preview, staging entry, diff message, migration of
  legacy 1:1 carátulas. (Separated because it owns its own storage naming, file
  handling, and now its own staging/diff behavior.)

No modified capabilities (none exist yet).

## Rollback plan

1. Revert backend + frontend commits.
2. The `proveedores_detalle.caratula_path` column is **kept nullable** on purpose —
   no data loss; restore the old `POST /{id}/caratula` direct-write path.
3. The new `caratula_path` columns on the cuenta tables can be left in place
   (nullable, unused) or dropped by a `026_*.sql` revert script.
4. The `id_cuen` drift fix is intentionally **not** reverted — it was a latent bug.

## Success criteria

- [ ] A supplier with multiple accounts can hold a distinct carátula per account.
- [ ] Uploading a NEW carátula to an `Aprobado` supplier flips it to
      `EditadoPendiente` and the diff shows `Carátula cuenta ••XXXX …`.
- [ ] A `Nuevo` supplier uploads carátulas without staging (direct write).
- [ ] The carátula slot no longer appears in "Datos de Contacto"; it appears inside
      each account card.
- [ ] "Ver carátulas" lists every account's carátula with preview.
- [ ] ~14 legacy carátulas are migrated onto each supplier's first active account;
      no `proveedores_detalle.caratula_path` data is destroyed.
- [ ] The orphan-detalle 409 can no longer fire on carátula upload.
