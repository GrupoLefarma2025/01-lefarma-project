# Delta for proveedores

> Greenfield capability — `openspec/specs/proveedores/spec.md` does not exist yet.
> All requirements below are ADDED. On archive they become the base spec.
> Authoritative scope source: `proposal.md` §2 + §4 (binding business rules).

## ADDED Requirements

### Requirement: Per-account carátula ownership

A supplier bank account (`ProveedorFormaPagoCuenta`) MUST own exactly one OPTIONAL
carátula file, stored as `caratula_path` on the account row in both live and staging
tables. A carátula MUST belong to exactly one account. A supplier with no accounts
MUST NOT be able to hold a carátula.

#### Scenario: Account holds one carátula

- GIVEN supplier "FARMACIA SA" has one account ending 1234 with a carátula uploaded
- WHEN the account is read back
- THEN its `caratula_path` points to a single file under `caratulas/cuentas/`

#### Scenario: Two accounts keep independent carátulas

- GIVEN "FARMACIA SA" has two accounts (••1234 and ••5678), each with its own carátula
- WHEN the carátula on ••1234 is replaced
- THEN only ••1234's `caratula_path` changes; ••5678 stays untouched

#### Scenario: Supplier with no accounts cannot hold a carátula

- GIVEN "FARMACIA SA" has zero accounts
- WHEN a carátula upload is attempted
- THEN the request is rejected with a validation error and no carátula is stored

### Requirement: Carátula staging for authorized suppliers

Uploading or replacing a carátula on an AUTHORIZED supplier (estatus `Aprobado` or
`EditadoPendiente`) MUST enter the full staging workflow: the staged carátula is held
pending, the live `caratula_path` stays unchanged, and the supplier estatus flips to
`EditadoPendiente`. The change MUST NOT go live until an approver approves. This
REVERSES the prior direct-write bypass.

#### Scenario: Upload to Aprobado supplier enters staging

- GIVEN "FARMACIA SA" is `Aprobado` with account ••1234 and no carátula
- WHEN a carátula is uploaded for that account
- THEN a staging row is created, the live `caratula_path` stays NULL, and estatus becomes `EditadoPendiente`

#### Scenario: Approver approves the carátula staging

- GIVEN a carátula-only staging exists for "FARMACIA SA" account ••1234
- WHEN the approver approves
- THEN the staged carátula promotes to live and estatus returns to `Aprobado`

#### Scenario: Approver rejects the carátula staging

- GIVEN a carátula-only staging exists for "FARMACIA SA" account ••1234
- WHEN the approver rejects
- THEN the live carátula reverts to its prior value and estatus returns to `Aprobado`

### Requirement: Carátula direct write for prospecto suppliers

Uploading or replacing a carátula on a PROSPECTO supplier (estatus `Nuevo`) MUST apply
immediately with no staging row, no diff, and no estatus change.

#### Scenario: Upload to Nuevo supplier writes directly

- GIVEN "FARMACIA NUEVA" is `Nuevo` with account ••9999
- WHEN a carátula is uploaded for that account
- THEN the live `caratula_path` is set immediately and no staging row is created

### Requirement: Carátula field in edit diff

`GenerarDiff` MUST emit one `CampoDiff` per account whose carátula changed. The label
MUST be `Carátula cuenta ••{last4} actualizada` for a replacement and
`Carátula cuenta ••{last4} agregada` for an account that previously had no carátula,
where `{last4}` is the last four digits of the account number.

#### Scenario: Only the carátula changed

- GIVEN an edit for "FARMACIA SA" replaces the carátula on account ••1234 and nothing else
- WHEN `GenerarDiff` runs
- THEN the diff contains exactly one carátula entry: `Carátula cuenta ••1234 actualizada`

#### Scenario: Carátula and razón social both changed

- GIVEN an edit for "FARMACIA SA" changes razón social AND replaces the carátula on account ••1234
- WHEN `GenerarDiff` runs
- THEN the diff contains the razón social change AND `Carátula cuenta ••1234 actualizada`

#### Scenario: New account receives its first carátula

- GIVEN an edit adds account ••5678 WITH a carátula to "FARMACIA SA"
- WHEN `GenerarDiff` runs
- THEN the diff contains `Carátula cuenta ••5678 agregada`

### Requirement: Migration of legacy per-supplier carátulas

Migration script `025_*.sql` MUST copy each existing `proveedores_detalle.caratula_path`
onto the supplier's FIRST ACTIVE account, silently, with no user intervention. The
legacy column MUST be made nullable (NOT dropped) to preserve rollback. Suppliers with
no active account MUST NOT have their legacy carátula destroyed — it stays on
`proveedores_detalle`.

#### Scenario: Single active account receives the legacy carátula

- GIVEN "FARMACIA SA" has a legacy carátula on `proveedores_detalle` and exactly one active account
- WHEN migration 025 runs
- THEN that account's `caratula_path` equals the legacy path and the legacy column stays intact

#### Scenario: Multiple active accounts — first receives the legacy carátula

- GIVEN "DISTRIB SA" has a legacy carátula and three active accounts (A, B, C by insertion order)
- WHEN migration 025 runs
- THEN account A's `caratula_path` equals the legacy path; B and C stay NULL

#### Scenario: No active account — legacy carátula preserved

- GIVEN "SIN CUENTAS SA" has a legacy carátula but no active account
- WHEN migration 025 runs
- THEN no account row is written and the legacy `caratula_path` on `proveedores_detalle` is preserved

### Requirement: id_cuen schema drift fix on staging accounts

The staging table `staging.proveedor_forma_pago_cuentas` MUST have an `id_cuen` column
so a staged account edit can map back to its live row. Migration 025 MUST add it via an
idempotent `ALTER … ADD id_cuen INT NULL` (re-runnable without error).

#### Scenario: Staged account edit maps to its live row

- GIVEN an authorized supplier's account ••1234 is staged for a carátula change
- WHEN the staging row is created
- THEN its `id_cuen` equals the live account's primary key

#### Scenario: Migration 025 is re-runnable

- GIVEN migration 025 has already run and `id_cuen` exists
- WHEN migration 025 runs again
- THEN it completes without error (idempotent)
