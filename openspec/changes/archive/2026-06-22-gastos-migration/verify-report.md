# Verification Report

**Change**: gastos-migration (Gastos Migration & Corrected Navigation Model)
**Version**: N/A (delta specs)
**Mode**: Standard (frontend; Strict TDD inactive — backend-only)
**Date**: 2026-06-22 (re-verification after C1+C2 remediation)
**Verifier**: sdd-verify executor (independent re-verification — no trust on prior verdicts)

**Prior verdict**: FAIL (Engram id 149) — 2 CRITICALs (C1 UNTESTED, C2 SPEC VIOLATION).
**This verdict**: **PASS** — both CRITICALs CLOSED, no regression introduced.

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 21 (PR1: 6, PR2: 6, PR2 Remediation: 3, PR3: 6, Verify Remediation: 3) |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

All task checkboxes in `tasks.md` are `[x]`, including the three remediation entries V.R1–V.R3 added under the verify phase:
- `[x] V.R1` — PermissionGuard `blockedPath` unit test (C1 fix).
- `[x] V.R2` — `?return=` propagation to `ProtectedRoute` + `GastosSubtreeIndex` + covering test (C2 fix).
- `[x] V.R3` — re-verify gates green (this report).

---

## Build & Tests Execution

**Build (root, `BASE_URL_PATH='/'`)**: ✅ Passed — exit 0, built in 31.21s
```text
> lefarma.frontend@0.0.0 build
> tsc && vite build
✓ built in 31.21s
EXIT_ROOT=0
```
Root `dist/index.html` `/CxP/` count: **0** — root build byte-equivalent in routing surface (ProtectedRoute's `?return=` is additive; `unauthRedirect` defaults to `/` and Hero ignores the query param).

**Build (CxP, default `BASE_URL_PATH`)**: ✅ Passed — exit 0, built in 33.16s
```text
> lefarma.frontend@0.0.0 build
> tsc && vite build
✓ built in 33.16s
EXIT_CXP=0
```
CxP `dist/index.html` `/CxP/` count: **6** — correct prefix preserved.

**Tests**: ✅ 56 passed / 0 failed / 0 skipped (12 files).
```text
 RUN  v3.2.6
 ✓ src/apps/_registry.test.ts (4)
 ✓ src/components/auth/PermissionGuard.test.tsx (3)        ← C1 remediation
 ✓ src/apps/baseapp/Profile.test.tsx (2)
 ✓ src/apps/baseapp/Home.test.tsx (4)
 ✓ src/shared/auth/RequireAuth.test.tsx (4)
 ✓ src/test/subtree-return-preservation.test.tsx (2)       ← C2 remediation
 ✓ src/apps/baseapp/ShellLayout.test.tsx (5)
 ✓ src/test/login.smoke.test.tsx (2)
 ✓ src/test/require-auth.test.tsx (8)
 ✓ src/test/dashboard.smoke.test.tsx (1)
 ✓ src/test/gastos-routes.test.tsx (9)
 ✓ src/test/baseapp-routes.test.tsx (12)

 Test Files  12 passed (12)
      Tests  56 passed (56)
   Duration  17.71s
```
Test count delta: **51 → 56** (+3 C1, +2 C2) — exactly as forecast in the remediation plan.

**Lint (`--max-warnings 0`)**: ✅ Zero regression — 181 problems (160 errors, 21 warnings) = IDENTICAL to baseline.
```text
✖ 181 problems (160 errors, 21 warnings)
EXIT_LINT=1   ← pre-existing baseline (not a regression)
```

**Codemod gate**: ✅ Clean.
```text
rg "services/(authService|api)|store/authStore" src/   →  0 hits   (EXIT_RG=1)
```

---

## Spec Compliance Matrix

**30/30 scenarios COMPLIANT** (was 27/30: +1 C1 UNTESTED→COMPLIANT, +2 C2 PARTIAL→COMPLIANT).

### gastos-app (10 scenarios): 10 COMPLIANT
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Subtree URL Contract | Subtree routes resolve under the prefix | `baseapp-routes.test.tsx` | ✅ COMPLIANT |
| Subtree URL Contract | **Unauthenticated index redirects to Gastos login** (destination preserved) | `subtree-return-preservation.test.tsx` + `GastosSubtreeIndex` source (`?return=` at `GastosRoutes.tsx:75`) | ✅ **COMPLIANT** (was PARTIAL — C2 closed) |
| Gastos Dashboard Landing | Authenticated user lands on Dashboard | `gastos-routes.test.tsx` | ✅ COMPLIANT |
| Gastos Dashboard Landing | Unauthenticated user does not reach Dashboard | `gastos-routes.test.tsx` | ✅ COMPLIANT |
| Gastos Auth Flow | Full three-step flow grants access | `login.smoke.test.tsx` | ✅ COMPLIANT |
| Context-Aware Login | Gastos login presents context selection | `login.smoke.test.tsx` | ✅ COMPLIANT |
| Context-Aware Login | Global login cleanly skips context selection | `login.smoke.test.tsx` | ✅ COMPLIANT |
| Hub Cross-App SSO | SSO from hub to Gastos | `require-auth.test.tsx` | ✅ COMPLIANT |
| Root-Build Parity | Root build unchanged | `gastos-routes.test.tsx` (9 parity tests) | ✅ COMPLIANT |
| Module Reuse | Shell subtree resolves the same module | `baseapp-routes.test.tsx` | ✅ COMPLIANT |

### app-routing (14 scenarios): 14 COMPLIANT
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Root Index Redirect | Unauthenticated index redirects to global login | `baseapp-routes.test.tsx` | ✅ COMPLIANT |
| Root Index Redirect | Authenticated index redirects to hub | `baseapp-routes.test.tsx` | ✅ COMPLIANT |
| Global Login Route | Global login redirects to hub on success | `require-auth.test.tsx` | ✅ COMPLIANT |
| Per-App Login Route | App login is addressable per app | `baseapp-routes.test.tsx` | ✅ COMPLIANT |
| Authentication Guard | **Unauthenticated user is redirected to the subtree login** (return URL preserved) | `subtree-return-preservation.test.tsx` (asserts `?return=%2FCxP%2Fgastos%2Fcatalogos%2Fproveedores`) | ✅ **COMPLIANT** (was PARTIAL — C2 closed) |
| Authentication Guard | Authenticated user passes through | `subtree-return-preservation.test.tsx` + `require-auth.test.tsx` | ✅ COMPLIANT |
| Authentication Guard | Guard checks authentication, not context selection | `require-auth.test.tsx` | ✅ COMPLIANT |
| Authentication Guard | **Permission checks preserved under subtree mounting** | `PermissionGuard.test.tsx` (3 tests on REAL component) | ✅ **COMPLIANT** (was UNTESTED — C1 closed) |
| Static App Registry | Launcher reads from the static registry | `Home.test.tsx` | ✅ COMPLIANT |
| Static App Registry | Adding an app entry is code-only | `_registry.test.ts` | ✅ COMPLIANT |
| Static App Registry | Gastos appears in the launcher | `Home.test.tsx` | ✅ COMPLIANT |
| App Subtree Mounting | Gastos subtree is addressable | `baseapp-routes.test.tsx` | ✅ COMPLIANT |
| Deployment Prefix | Built assets use the prefix | CxP build `dist/index.html` `/CxP/` count = 6 | ✅ COMPLIANT |
| Deployment Prefix | Router treats prefix as root | Root build `dist/index.html` `/CxP/` count = 0 | ✅ COMPLIANT |

### base-app (6 scenarios): 6 COMPLIANT
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Authenticated Shell Layout | Authenticated user sees the shell at the hub | `ShellLayout.test.tsx` | ✅ COMPLIANT |
| Authenticated Shell Layout | Unauthenticated user does not reach the shell | `ShellLayout.test.tsx` | ✅ COMPLIANT |
| Authenticated Shell Layout | Index route is not a home surface | `ShellLayout.test.tsx` | ✅ COMPLIANT |
| Home Launcher | Launcher lists registry apps | `Home.test.tsx` | ✅ COMPLIANT |
| Home Launcher | Empty registry renders gracefully | `Home.test.tsx` | ✅ COMPLIANT |
| Home Launcher | Global login lands on the launcher | `Profile.test.tsx` | ✅ COMPLIANT |

**Compliance summary**: 30/30 scenarios compliant.

---

## Correctness (Static Evidence)

| Remediation | Status | Evidence |
|------------|--------|---------|
| **C1 — PermissionGuard `blockedPath`** | ✅ CLOSED | `src/components/auth/PermissionGuard.test.tsx` (3 tests, real component, apiClient-only mock). Asserts: (a) root default `blockedPath=undefined` → `/bloqueado`; (b) subtree override `'/gastos/bloqueado'` → redirect there; (c) JWT with `permission: ['test.perm']` claim → children render. Source still threads `resolvedBlockedPath` per variant at `GastosRoutes.tsx:115`. |
| **C2 — Return-URL preservation (ProtectedRoute)** | ✅ CLOSED | `src/routes/LandingRoute.tsx:56-57` — `const from = location.pathname + location.search; return <Navigate to={\`${unauthRedirect}?return=${encodeURIComponent(from)}\`} replace/>`. Mirrors RequireAuth pattern. Additive for root build. |
| **C2 — Return-URL preservation (GastosSubtreeIndex)** | ✅ CLOSED | `src/apps/gastos/GastosRoutes.tsx:74-75` — identical `?return=` propagation. Covers deep-link preservation for unauthenticated index visits. |
| **C2 — Covering test** | ✅ CLOSED | `src/test/subtree-return-preservation.test.tsx` (2 tests). Login NOT mocked — `LoginProbe` renders `useLocation().pathname + useLocation().search` so the exact `?return=` value is observable. Asserts `/CxP/gastos/login?return=%2FCxP%2Fgastos%2Fcatalogos%2Fproveedores`. The static `<div>LOGIN_MARK</div>` mock (root cause that hid the gap) is gone. |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Decision 1 — GastosRoutes function-call + variant | ✅ Yes | Unchanged. |
| Decision 2 — Login `requireContextSelection` + `redirectTo` | ✅ Yes | Unchanged. |
| Decision 3 — Foundation adjustment (`/`, `/login`, `/hub`) | ✅ Yes | Unchanged. |
| Decision 4 — RequireAuth subtree-aware + return preservation | ✅ Yes (now fully) | Was PARTIAL: subtree used `ProtectedRoute` without `?return=`. Remediation V.R2 chose **option (a)** — propagate `?return=` to `ProtectedRoute` + `GastosSubtreeIndex` rather than replacing with `RequireAuth`. Rationale: `ProtectedRoute` is a layout-route guard (`<Outlet/>`) structurally distinct from `RequireAuth` (children-wrapper); replacement would be more invasive. The design intent (return-URL preservation for Gastos subtree) is now satisfied via the equivalent mechanism. Design coherence restored. |

---

## PR3 Deviation Re-evaluation

- **Deviation 1** (No shell-level RequireAuth on Gastos wrapper): ACCEPTABLE — engineering choice that avoids redirect loop on public `/gastos/login`. The C2 remediation makes this deviation benign: `ProtectedRoute` now preserves `?return=`, so the functional gap that previously cascaded from this deviation is closed.
- **Deviation 2** (PermissionGuard `blockedPath` absolute `/gastos/bloqueado`): ACCEPTABLE + now TESTED. Path resolution under `/CxP/` basename is correct; C1 remediation proves it at runtime.

---

## Regression Check

| Dimension | Prior (FAIL run) | This run | Status |
|-----------|------------------|----------|--------|
| Test count | 51 | 56 (+5) | ✅ No regression |
| Root build | exit 0 | exit 0 | ✅ Identical behavior |
| CxP build | exit 0 | exit 0 | ✅ Identical behavior |
| Root `/CxP/` count | 0 | 0 | ✅ Byte-equivalent routing surface |
| CxP `/CxP/` count | 6 | 6 | ✅ Prefix preserved |
| Lint | 181/160/21 | 181/160/21 | ✅ Zero regression |
| Codemod gate | 0 hits | 0 hits | ✅ Clean |
| Previously-COMPLIANT scenarios | 27/30 | 27/30 still COMPLIANT (+3 newly) | ✅ No regression |
| Root parity tests | 9/9 | 9/9 | ✅ ProtectedRoute `?return=` additive — root tests still pass |

---

## Issues Found

### CRITICAL
**None.** Both prior CRITICALs are CLOSED with covering runtime evidence:
- **C1**: `PermissionGuard.test.tsx` — 3 tests pass, real component, asserts `blockedPath` parameterization for root default + subtree override + permission-satisfied render.
- **C2**: `subtree-return-preservation.test.tsx` — 2 tests pass, Login NOT mocked, asserts exact `?return=` encoding for the gastos subtree. Source remediation in both `ProtectedRoute` (`LandingRoute.tsx:57`) and `GastosSubtreeIndex` (`GastosRoutes.tsx:75`).

### WARNING
**W1** (carried forward, non-blocking) — Routing tests (`gastos-routes.test.tsx`, `baseapp-routes.test.tsx`) still mock out `PermissionGuard` for isolation. The C1 remediation adds a focused unit test that exercises the real component, closing the observability gap. The isolation pattern itself is acceptable; the new test is the correct complement.

### SUGGESTION
**S1** (carried forward, non-blocking) — `authStore.ts:14` unused `Usuario` import is pre-existing lint debt (counts toward the 181 baseline); not a gastos-migration regression. Could be cleaned in a separate hygiene pass.

---

## Verdict: **PASS**

All dimensions clean:
- ✅ 21/21 tasks complete (including V.R1–V.R3 remediation entries).
- ✅ Both builds exit 0; root byte-equivalent, CxP prefix correct.
- ✅ 56/56 tests pass (51 baseline + 3 C1 + 2 C2).
- ✅ Lint zero-regression (181/160/21 = baseline).
- ✅ Codemod gate clean.
- ✅ **30/30 spec scenarios COMPLIANT** (was 27/30).
- ✅ Design Decisions 1–4 all honored (Decision 4 now fully coherent).
- ✅ Both prior CRITICALs (C1, C2) CLOSED with runtime evidence.
- ✅ No regression in any previously-COMPLIANT dimension.

**Next recommended**: **sdd-archive** (the change is ready for delta-spec sync into the openspec canonical specs).
