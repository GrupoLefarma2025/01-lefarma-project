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

## Phase PR3: Shell Navigation Rework + Mount Gastos

- [ ] PR3.1 RED: create `lefarma.frontend/src/test/baseapp-routes.test.tsx` — `/` redirect (auth→`/hub`, unauth→`/login`); `/hub` Home; `/login` 2-step; `/gastos/*` subtree resolve; SSO hub→gastos no re-login (app-routing + base-app specs).
- [ ] PR3.2 Modify `lefarma.frontend/src/apps/baseapp/BaseAppRoutes.tsx` — `/`→`<Navigate>`; add `/login` (outside `RequireAuth`); `/hub`→`<Home/>`; mount `<GastosRoutes variant="subtree" loginPath="/gastos/login">` under `gastos`.
- [ ] PR3.3 Modify `lefarma.frontend/src/apps/baseapp/ShellLayout.tsx` — nav `/`→`/hub`.
- [ ] PR3.4 Modify `lefarma.frontend/src/apps/_registry.ts` — `gastos.disabled: false`.
- [ ] PR3.5 GREEN: shell full-nav + SSO tests pass.
- [ ] PR3.6 Verify: `npm test` green; both builds + lint green.
