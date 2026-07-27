# Tasks: Multi-App Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR 0 ~120 / PR 1a ~80 / PR 1b ~700 / PR 2 ~350; total ~1250 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 0 → PR 1a → PR 1b → PR 2 |
| Delivery strategy | auto-forecast |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Base |
|------|------|------|
| PR 0 | Vitest + RTL + jsdom + 2 smoke tests | feature tracker branch |
| PR 1a | Move auth/api → `shared/` + shims | PR 0 branch |
| PR 1b | Codemod ~55 files to `@/shared/...` + delete shims | PR 1a branch |
| PR 2 | Base shell + registry + RequireAuth + App.tsx branch + Login return-param | PR 1b branch |

## Phase 0: Test Infrastructure (PR 0)

> Setup only — no test-first possible; runner does not exist yet.

- [x] 0.1 Add Vitest/RTL/jsdom deps to `lefarma.frontend/package.json`; add `test` + `test:watch` scripts.
- [x] 0.2 Create `lefarma.frontend/vitest.config.ts` (jsdom, globals, setup entry, alias `@` → `./src`).
- [x] 0.3 Create `lefarma.frontend/src/test/setup.ts` (jest-dom matchers, `localStorage`/`matchMedia` stubs).
- [x] 0.4 Create `src/test/login.smoke.test.tsx` (Login renders + accepts creds, mocked auth).
- [x] 0.5 Create `src/test/dashboard.smoke.test.tsx` (Gastos dashboard renders, mocked API).
- [x] 0.6 Verify gate: `npm test` green; `npm run build` + `npm run lint -- --max-warnings 0` green.
  - `npm test` PASS (3/3). `npm run build` PASS (tsc+vite). `npm run lint`: new files lint clean (exit 0); zero new issues vs. baseline (181 problems before == 181 after). Project-wide `npm run lint` was ALREADY red before PR 0 due to ~160 pre-existing errors in untouched files (useNotifications, WorkflowDiagram, CrearOrdenCompra, authStore, …). Fixing that cross-cutting debt is out of PR 0 scope (separate cleanup).

## Phase 1a: Relocate auth/api with shims (PR 1a)

- [x] 1a.1 Create `src/shared/auth/authService.ts` (moved from `services/authService.ts`).
- [x] 1a.2 Create `src/shared/auth/authStore.ts` (moved from `store/authStore.ts`).
- [x] 1a.3 Create `src/shared/api/apiClient.ts` (moved from `services/api.ts`; exports `API`, `proveedorApi`, default).
- [x] 1a.4 Replace old files with one-line `export * from '@/shared/...'` shims (`services/authService.ts`, `services/api.ts`, `store/authStore.ts`).
- [x] 1a.5 Verify gate: build+lint+test green; app behavior unchanged (both smoke tests still pass).
  - `npm test` PASS (3/3). `npm run build` PASS (tsc+vite, 33.46s). `npm run lint -- --max-warnings 0`: 181/160/21 — IDENTICAL to PR 0 baseline → zero regression. The 3 shim files + 3 moved files add 0 new problems; the single `shared/auth/authStore.ts` `'Usuario' unused` error is pre-existing content that relocated with the file (PR 0 already listed authStore as pre-existing debt). `git status` clean: 3 new `shared/` files + 3 shim replacements + 2 smoke-test mock-target edits only.
  - **Planned deviation (anticipated by PR 0 + design mock note)**: the moved files reference each other via the NEW `@/shared/...` paths (self-contained, PR-1b-ready), so the login smoke test's `vi.mock('@/services/api')` became a dead path — `loginStepOne` now reaches the API through `@/shared/api/apiClient` (unmocked) and fired real axios in jsdom (login test FAILED with "Usuario no encontrado"). Fix: moved BOTH smoke-test mock targets `@/services/api` → `@/shared/api/apiClient` (login required it; dashboard moved for PR-1b shim-deletion readiness + consistency). Tests then 3/3 green. PR 1b will not need to touch these mocks again.

## Phase 1b: Codemod imports + delete shims (PR 1b)

- [x] 1b.1 Rewrite `@/services/authService` → `@/shared/auth/authService` across ~55 files.
- [x] 1b.2 Rewrite `@/store/authStore` AND relative `./store/authStore` (in `App.tsx`) → `@/shared/auth/authStore`.
- [x] 1b.3 Rewrite `@/services/api` → `@/shared/api/apiClient`.
- [x] 1b.4 Delete shim files (`services/authService.ts`, `services/api.ts`, `store/authStore.ts`).
- [x] 1b.5 Verify gate: `rg "services/(authService|api)|store/authStore"` across `src/` excluding `shared/` destinations = **0 hits**; build+lint+test green.
  - Strict gate PASS (stronger than required): `rg "services/(authService|api)|store/authStore" src/` = **0 hits everywhere** (including `src/shared/`, whose files import each other via `@/shared/...`). `npm test` PASS (3/3, 4.80s). `npm run build` PASS (tsc+vite, 29.38s; only pre-existing >2500kB chunk advisory). `npm run lint -- --max-warnings 0`: **181/160/21 — IDENTICAL** to PR 0/1a baseline → zero regression. `git status`: 62 codemod files modified + 3 shims deleted (no stray edits).
  - **DEVIATION (design gate-regex blind spot — resolved)**: the design's gate regex `services/(authService|api)|store/authStore` only matches import paths containing the `services/` or `store/` directory prefix. It does NOT catch **sibling-relative** imports INSIDE those dirs (e.g. `./authStore` in `src/store/configStore.ts`, `./api` in `src/services/*.ts`). Deleting the shims broke 7 such sibling imports (2 in `store/`: `configStore`, `notificationStore`; 5 in `services/`: `systemConfigService`, `notificationService`, `helpService`, `comprobanteService`, `archivoService`) — surfaced by the `npm test` gate (configStore → login smoke fail). Fixed by rewriting all 7 to their `@/shared/...` alias paths. Re-verified clean via escaped-dot greps (`\./authStore`, `\./api\b`, `\./authService`, `\.\./...`) = 0 hits. PR 2 / future codemods MUST use a sibling-aware regex, not just the prefix form.
  - **Scope count deviation**: design estimated "~55 unique files" (it tallied only `@/`-aliased imports: authService=7, authStore=21, api=35). Actual codemod touched **62 files** (55 alias/relative-with-prefix consumers + 7 sibling-relative consumers). Still well within the ~700-line budget (each change is exactly 1 import line). The 2 smoke-test comment references to the old paths were also rewritten (stale post-shim-deletion comments would have matched the gate regex).

## Phase 2: Base shell + routing (PR 2)

- [x] BLOCKING: confirm ops hosts TWO physical IIS deployments (root + `/CxP/`) before starting PR 2 tasks.
  - RESOLVED (user-confirmed): IIS hosts two physical deployments — root → Gastos `dist`, `/CxP/` → shell `dist`, each with its own artifact. Decision 1 two-build model is valid as-is; option (c) not needed.

> Test-first (Vitest runner now exists). Reference spec scenarios as the test contract.

- [x] 2.1 RED: `src/shared/auth/RequireAuth.test.tsx` — app-routing "Unauthenticated user is redirected to login" + "Authenticated user passes through" + "Guard checks auth, not context".
- [x] 2.2 GREEN: create `src/shared/auth/RequireAuth.tsx` (redirect to `/login?return=…`, safelist `/CxP/`).
- [x] 2.3 RED: `src/apps/_registry.test.ts` + `src/apps/baseapp/Home.test.tsx` — base-app "Launcher lists registry apps" + "Empty registry renders gracefully" + "Adding an app entry is code-only".
- [x] 2.4 GREEN: create `src/apps/_registry.ts` (`AppRegistryEntry[]`) + `src/apps/baseapp/Home.tsx`.
- [x] 2.5 RED: `ShellLayout.test.tsx` + `Profile.test.tsx` — base-app "Authenticated user sees the shell" + "Profile page" + "No Global Context Assumption".
- [x] 2.6 GREEN: create `src/apps/baseapp/ShellLayout.tsx` + `src/apps/baseapp/Profile.tsx`.
- [x] 2.7 Create `src/apps/baseapp/BaseAppRoutes.tsx` (`/` Home, `/perfil` Profile, wrapped in `RequireAuth`+`ShellLayout`).
- [x] 2.8 Modify `src/App.tsx`: branch on `import.meta.env.BASE_URL === '/CxP/'` → `<BaseAppRoutes>` else `<AppRoutes>`.
- [x] 2.9 Modify `src/pages/auth/Login.tsx`: honor optional `?return=` param post-success (safelisted to `/CxP/`).
- [x] 2.10 Create `lefarma.frontend/.env.cxp` (`BASE_URL_PATH=/CxP/`).
- [x] 2.11 Verify gate: `/CxP/` build (`BASE_URL_PATH=/CxP/`) shows shell + unauth redirect to root `/login`; root build unchanged; `npm test` green.
  - `npm test` PASS (21/21, 7 files, 15.15s): RequireAuth 4 + _registry 4 + Home 4 + ShellLayout 4 + Profile 2 + login.smoke 2 + dashboard.smoke 1.
  - Root build PASS: `$env:BASE_URL_PATH='/'; npm run build` (tsc+vite, 43.98s). `dist/index.html` references assets at `/assets/...` + `/favicon.ico` (NO `/CxP/` prefix) → base=`/` → `import.meta.env.BASE_URL === '/'` ≠ `'/CxP/'` → renders `<AppRoutes>` (Gastos UNCHANGED).
  - CxP build PASS: `npm run build` (loads committed `.env.production` → `BASE_URL_PATH=/CxP/`; tsc+vite, 32.73s). `dist/index.html` references ALL assets under `/CxP/` (`/CxP/assets/index-*.js`, `/CxP/favicon.ico`) → base=`/CxP/` → renders `<BaseAppRoutes>` (shell).
  - `npm run lint -- --max-warnings 0`: 181/160/21 — IDENTICAL to PR 0/1a/1b baseline → zero regression (new PR 2 files add 0 problems).
  - **Premise correction (Gate 2)**: the orchestrator prompt assumed "`npm run build` defaults to `BASE_URL_PATH=/`". That is FALSE for this repo — committed `.env.production` sets `BASE_URL_PATH=/CxP/` (Gastos is currently deployed under `/CxP/` in prod), so the natural `npm run build` yields the CxP build. The ROOT build is produced by forcing the env: `$env:BASE_URL_PATH='/'; npm run build`. Verified Vite `loadEnv` lets `process.env.BASE_URL_PATH` override `.env.production`. This is PRE-EXISTING repo behavior, NOT introduced by PR 2.
