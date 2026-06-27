# Tasks: Gastos Migration & Corrected Navigation Model

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 750–1150 (PR1 ~300–500, PR2 ~200–300, PR3 ~250–350) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 (feature-branch-chain) |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base |
|------|------|-----------|------|
| 1 | GastosRoutes extraction + relative refactor + LandingRoute parameterization; root byte-identical | PR1 | tracker |
| 2 | Login props + authStore option + RequireAuth → `<Navigate>` | PR2 | PR1 branch |
| 3 | BaseAppRoutes rework + ShellLayout nav + `_registry` flip + mount Gastos | PR3 | PR2 branch |

## Phase PR1: GastosRoutes Extraction (root byte-identical)

- [x] PR1.1 RED: create `lefarma.frontend/src/test/gastos-routes.test.tsx` — lock root URLs (`/dashboard`, `/catalogos/*`, `/login`) and root `<Hero>` landing BEFORE refactor (gastos-app spec: "Root build unchanged").
- [x] PR1.2 Create `lefarma.frontend/src/apps/gastos/GastosRoutes.tsx` — `<GastosRoutes variant loginPath?>` returning relative `<Route>` children; index gates root `<Hero>` vs subtree redirect-to-login.
- [x] PR1.3 Modify `lefarma.frontend/src/routes/LandingRoute.tsx` — parameterize `LandingRoute`/guards with `loginPath`; make every `<Navigate to>` relative; add `variant`-gated index.
- [x] PR1.4 Modify `lefarma.frontend/src/routes/AppRoutes.tsx` — replace inline ~30-route table with `<GastosRoutes variant="root"/>` (absolute-path behavior preserved via `basename="/"`).
- [x] PR1.5 GREEN: root RED tests pass; root build byte-identical.
- [x] PR1.6 Verify: `npm test` green; `BASE_URL_PATH=/` + `/CxP/` builds green; `npm run lint --max-warnings 0` green.

## Phase PR2: Config-Driven Auth (Login + RequireAuth)

- [x] PR2.1 RED: extend `lefarma.frontend/src/test/require-auth.test.tsx` — subtree redirect to `/login` and `/gastos/login`; Login 2-step (global → `/hub`, no context) vs 3-step (Gastos, context presented); auth-only passthrough (app-routing "Authentication Guard").
- [x] PR2.2 Modify `lefarma.frontend/src/shared/auth/RequireAuth.tsx` — replace `window.location.href` with `<Navigate to={loginPath} replace>` (default `/login`).
- [x] PR2.3 Modify `lefarma.frontend/src/shared/auth/authStore.ts` — `loginStepTwo(password, domain, options?: { requireContextSelection? })` honors the option.
- [x] PR2.4 Modify `lefarma.frontend/src/pages/auth/Login.tsx` — add `requireContextSelection` (default true) + `redirectTo` (default `dashboard`); replace hard-coded `navigate('/dashboard')`.
- [x] PR2.5 GREEN: PR2 RED tests pass.
- [x] PR2.6 Verify: `npm test` green; both builds + lint green.

### PR2 Remediation (return-URL preservation — spec violation fix)

- [x] PR2.R1 RESTORE `?return=` preservation in `RequireAuth.tsx`. Fresh-context gate found the PR2 `<Navigate to={loginPath} replace/>` dropped the return URL, violating app-routing spec (Authentication Guard: "preserving the return URL"). The prior apply's claim that "return preservation is not in the spec" was factually false — both the foundation spec and the gastos-migration delta require it. Fix: `<Navigate to={\`${loginPath}?return=${encodeURIComponent(from)}\`} replace/>` via `useLocation()`. Query-param form chosen because `Login.tsx` already consumes `?return=` with a `/CxP/`-scoped open-redirect guard — zero Login changes needed.
- [x] PR2.R2 ADD covering test `src/test/require-auth.test.tsx` — asserts the redirect carries `?return=<protected-path>` via a `useLocation()` probe at the login destination (test count 37 → 38).
- [x] PR2.R3 Re-verify: `npm test` 38 green; root build exit 0; CxP build exit 0; lint 181/160/21 (zero regression).

## Phase PR3: Shell Navigation Rework + Mount Gastos

- [x] PR3.1 RED: create `lefarma.frontend/src/test/baseapp-routes.test.tsx` — `/` redirect (auth→`/hub`, unauth→`/login`); `/hub` Home; `/login` 2-step; `/gastos/*` subtree resolve; SSO hub→gastos no re-login (app-routing + base-app specs).
- [x] PR3.2 Modify `lefarma.frontend/src/apps/baseapp/BaseAppRoutes.tsx` — `/`→`<Navigate>`; add `/login` (outside `RequireAuth`); `/hub`→`<Home/>`; mount `<GastosRoutes variant="subtree" loginPath="/gastos/login">` under `gastos`.
- [x] PR3.3 Modify `lefarma.frontend/src/apps/baseapp/ShellLayout.tsx` — nav `/`→`/hub`.
- [x] PR3.4 Modify `lefarma.frontend/src/apps/_registry.ts` — `gastos.disabled: false`.
- [x] PR3.5 GREEN: shell full-nav + SSO tests pass.
- [x] PR3.6 Verify: `npm test` green; both builds + lint green.

## Verify Remediation (C1 + C2 — from sdd-verify report id 149)

- [x] V.R1 C1 FIX: Added `lefarma.frontend/src/components/auth/PermissionGuard.test.tsx` — unit test exercising the REAL PermissionGuard (NOT mocked) with `blockedPath` prop. Covers: (a) root default `blockedPath=undefined` → redirect to `/bloqueado`; (b) subtree override `blockedPath='/gastos/bloqueado'` → redirect there; (c) permission satisfied → children render. The routing tests mock out PermissionGuard entirely, which left the PR3.5 parameterization unobservable; this focused test closes that gap (app-routing spec: "Permission checks preserved under subtree mounting").
- [x] V.R2 C2 FIX: Propagated `?return=` return-URL preservation to `ProtectedRoute` (`src/routes/LandingRoute.tsx`) AND `GastosSubtreeIndex` (`src/apps/gastos/GastosRoutes.tsx`), mirroring the existing `RequireAuth` pattern (`useLocation()` + `<Navigate to={\`${path}?return=${encodeURIComponent(from)}\`} replace/>`). Chosen option: **(a) propagate `?return=` to ProtectedRoute** — less invasive than replacing with RequireAuth because ProtectedRoute is a layout-route guard (`<Outlet/>`) structurally different from RequireAuth (children-wrapper). Root build's ProtectedRoute gains return preservation too (additive — root `unauthRedirect` defaults to `/`, Hero ignores the query param). Added covering test `src/test/subtree-return-preservation.test.tsx` asserting unauth visit to `/CxP/gastos/catalogos/proveedores` redirects to `/CxP/gastos/login?return=%2FCxP%2Fgastos%2Fcatalogos%2Fproveedores` via a `useLocation()` probe (Login NOT mocked — the verify report flagged static Login mocking as why the gap was invisible).
- [x] V.R3 Re-verify gates: `npm test` 56 green (51 baseline + 3 C1 + 2 C2); root build exit 0; CxP build exit 0; lint 181/160/21 (zero regression); git status clean (only remediation files + prior PR3 working tree).
