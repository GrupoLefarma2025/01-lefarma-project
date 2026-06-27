# Archive Report — gastos-migration

**Change**: gastos-migration (Gastos Migration & Corrected Navigation Model)
**Date**: 2026-06-22
**Archive location**: `openspec/changes/archive/2026-06-22-gastos-migration/`
**Mode**: hybrid (delta specs synced to `openspec/specs/` AND report persisted to Engram)
**Skill**: sdd-archive (executor) — paths-injected

---

## Pre-flight Gates

### Task Completion Gate — PASS
The authoritative source of truth is the filesystem `tasks.md` (persisted by `sdd-apply`). All implementation task checkboxes are `[x]`:

| Phase | Tasks | IDs | State |
|-------|-------|-----|-------|
| PR1 — GastosRoutes Extraction | 6 | PR1.1–1.6 | all `[x]` |
| PR2 — Config-Driven Auth | 6 | PR2.1–2.6 | all `[x]` |
| PR2 Remediation (return-URL preservation) | 3 | PR2.R1–R3 | all `[x]` |
| PR3 — Shell Nav Rework + Mount Gastos | 6 | PR3.1–3.6 | all `[x]` |
| Verify Remediation (C1 + C2) | 3 | V.R1–R3 | all `[x]` |
| **Total** | **24** | | **24/24 complete** |

> Note: Engram observation 141 (tasks, planning snapshot) predates apply and still shows the original 18 checkboxes unchecked; the filesystem `tasks.md` is the authoritative final state and is fully checked. The `verify-report` breakdown sums to the same 24 (PR1:6 + PR2:6 + PR2-Rem:3 + PR3:6 + V-Rem:3).

### CRITICAL Gate — PASS
`verify-report` (Engram id 149): verdict **PASS**, **0 CRITICAL** issues, 30/30 spec scenarios COMPLIANT. Both prior CRITICALs (C1, C2) are CLOSED with runtime evidence. No regression.

---

## Specs Synced to Main Specs (openspec/specs/)

| Domain | Action | Requirements | Details |
|--------|--------|--------------|---------|
| `gastos-app` | **CREATED** (NEW — no prior main spec) | 5 req / 10 scenarios | Copied delta directly. Gastos Subtree Mounting, Gastos Dashboard Landing, Gastos Three-Step Login, Cross-App SSO, GastosRoutes Module Reuse. |
| `app-routing` | **MODIFIED** (merged delta into existing main spec) | 8 req (4 MODIFIED + 3 ADDED + 1 PRESERVED) | MODIFIED: `/CxP/` Deployment Prefix, Authentication Guard, Static App Registry, App Subtree Mounting (full-block replace, "(Previously: ...)" annotations retained). ADDED: Root Index Redirect, Global Login Route, Per-App Login Route Pattern. PRESERVED: Gastos Backward Compatibility (not in delta). |
| `base-app` | **MODIFIED** (merged delta into existing main spec) | 5 req (2 MODIFIED + 3 PRESERVED) | MODIFIED: Authenticated Shell Layout (→ hub at `/CxP/hub`; `/CxP/` index is redirect), Home Launcher (→ `/CxP/hub`). PRESERVED: Profile Page, Excludes Administration UI, No Global Context Assumption. |

**Merge rules followed:** MODIFIED blocks replaced wholesale by requirement name; ADDED requirements appended; all requirements not present in the delta were preserved verbatim; no REMOVED/RENAMED sections in this delta.

---

## Archive Contents Checklist

`openspec/changes/archive/2026-06-22-gastos-migration/`

- [x] `proposal.md`
- [x] `design.md`
- [x] `tasks.md` (24/24 tasks complete — no unchecked implementation tasks)
- [x] `verify-report.md` (verdict PASS)
- [x] `specs/gastos-app/spec.md` (delta)
- [x] `specs/app-routing/spec.md` (delta)
- [x] `specs/base-app/spec.md` (delta)
- [x] `archive-report.md` (this file)

**Source folder `openspec/changes/gastos-migration/`**: removed (moved).

---

## Remediation History (CRITICAL closure)

Two remediation cycles were required to reach a clean PASS verdict. Both are recorded for traceability:

1. **PR2 Remediation (PR2.R1–R3)** — return-URL preservation in `RequireAuth`. The PR2 `<Navigate to={loginPath}/>` dropped `?return=`, violating the app-routing Authentication Guard requirement ("preserving the return URL"). Fix: `RequireAuth` now carries `?return=${encodeURIComponent(from)}` via `useLocation()`. Covering test added (test count 37 → 38).

2. **Verify Remediation (V.R1–R3)** — closed the two sdd-verify CRITICALs:
   - **C1 (UNTESTED)**: `PermissionGuard.blockedPath` parameterization (14 usages) was masked because routing tests mock PermissionGuard. Fix: added `PermissionGuard.test.tsx` (3 tests on the REAL component) — root default, subtree override, permission-satisfied render.
   - **C2 (SPEC VIOLATION)**: return-URL preservation was missing from `ProtectedRoute` and `GastosSubtreeIndex`. Fix: propagated `?return=` to both redirect points (option (a) — less invasive than replacing ProtectedRoute with RequireAuth). Added `subtree-return-preservation.test.tsx` (2 tests, Login NOT mocked).

Re-verification: 56/56 tests pass (51 baseline + 3 C1 + 2 C2), both builds exit 0, lint zero-regression (181/160/21), codemod gate clean.

---

## Engram Traceability (observation IDs)

| Artifact | Engram ID | topic_key |
|----------|-----------|-----------|
| Proposal | 133 | `sdd/gastos-migration/proposal` |
| Design | 135 | `sdd/gastos-migration/design` |
| Tasks (planning snapshot) | 141 | `sdd/gastos-migration/tasks` |
| Apply-progress (merged PR1+PR2+remediation+PR3+verify-remediation) | 143 | `sdd/gastos-migration/apply-progress` |
| Verify-report (PASS) | 149 | `sdd/gastos-migration/verify-report` |
| Archive-report (this artifact) | *(assigned on save)* | `sdd/gastos-migration/archive-report` |

---

## SDD Cycle Complete

The `gastos-migration` change has been fully **proposed → specified → designed → tasked → applied → verified → archived**.

- Canonical specs now reflect the corrected navigation model (`/CxP/` redirect, `/CxP/login` 2-step global, `/CxP/hub` launcher, `/CxP/gastos/` subtree with 3-step login).
- The `gastos-app` capability is now a first-class main spec.
- The audit trail is preserved (read-only) under `openspec/changes/archive/2026-06-22-gastos-migration/`.

**Ready for the next change.**
