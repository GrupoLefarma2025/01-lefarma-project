## Verification Report

**Change**: multi-app-foundation
**Version**: N/A (specs undated)
**Mode**: Standard (frontend change; project strict_tdd cache covers backend only — not loaded)
**Verifier**: sdd-verify executor (fresh full-change review, independent of per-slice gate reviews)
**Date**: 2026-06-22

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 28 |
| Tasks complete | 28 |
| Tasks incomplete | 0 |

Breakdown (all `[x]`):
- Phase 0 (PR 0): 0.1–0.6 → 6/6
- Phase 1a (PR 1a): 1a.1–1a.5 → 5/5
- Phase 1b (PR 1b): 1b.1–1b.5 → 5/5
- Phase 2 (PR 2): BLOCKING prereq + 2.1–2.11 → 12/12

No unchecked implementation tasks. Completeness gate: **PASS**.

---

### Build & Tests Execution

**Tests**: ✅ 21 passed / 0 failed / 0 skipped
```text
Command: npm test  (lefarma.frontend/)
Exit code: 0

 Test Files  7 passed (7)
      Tests  21 passed (21)
   Duration  8.38s

Per-file:
  src/apps/_registry.test.ts                   4 tests  ✓
  src/shared/auth/RequireAuth.test.tsx         4 tests  ✓
  src/apps/baseapp/Profile.test.tsx            2 tests  ✓
  src/apps/baseapp/Home.test.tsx               4 tests  ✓
  src/apps/baseapp/ShellLayout.test.tsx        4 tests  ✓
  src/test/login.smoke.test.tsx                2 tests  ✓
  src/test/dashboard.smoke.test.tsx            1 test   ✓
```

**Root build (Gastos UNCHANGED proof)**: ✅ Passed (exit 0)
```text
Command: $env:BASE_URL_PATH='/'; npm run build
Exit code: 0   (tsc + vite build, 53.73s; pre-existing >2500kB chunk advisory only)

dist/index.html asset references (NO /CxP/ prefix):
  <link rel="icon" href="/favicon.ico" />
  <script src="/assets/index-BSt1GO5_.js"></script>
  <link rel="modulepreload" href="/assets/radix-ui-CrI8fVUh.js">
  <link rel="modulepreload" href="/assets/react-vendor-B4_PgiRx.js">
  <link rel="modulepreload" href="/assets/shiki-JREVRdWI.js">
  <link rel="stylesheet" href="/assets/index-Csp8oq1F.css">

/CxP/ hits in root dist/index.html: 0   → base='/' → renders <AppRoutes> (Gastos UNCHANGED) ✅
```

**CxP build (shell proof)**: ✅ Passed (exit 0)
```text
Command: Remove-Item Env:BASE_URL_PATH; npm run build   (loads committed .env.production)
Exit code: 0   (tsc + vite build, 23.29s)

dist/index.html asset references (ALL under /CxP/):
  <link rel="icon" href="/CxP/favicon.ico" />
  <script src="/CxP/assets/index-DENxC7ig.js"></script>
  <link rel="modulepreload" href="/CxP/assets/radix-ui-C-azKTDB.js">
  <link rel="modulepreload" href="/CxP/assets/react-vendor-D7fJkbdQ.js">
  <link rel="modulepreload" href="/CxP/assets/shiki-D7d4me_F.js">
  <link rel="stylesheet" href="/CxP/assets/index-B_thm9Kd.css">

/CxP/ hits in CxP dist/index.html: 6   → base='/CxP/' → renders <BaseAppRoutes> (shell) ✅
```

**Lint**: ⚠️ Pre-existing debt, ZERO regression
```text
Command: npm run lint -- --max-warnings 0
Result: ✖ 181 problems (160 errors, 21 warnings)   [exit non-zero]

Baseline comparison: 181/160/21 is IDENTICAL to the PR 0 pre-change baseline.
Zero new problems introduced by this change. The project-wide lint was ALREADY
red before this change due to ~160 pre-existing errors in untouched files
(useNotifications, WorkflowDiagram, WorkflowsList, generarConcentradoPDF, …).
The single hit in a change-touched file — src/shared/auth/authStore.ts
"'Usuario' is defined but never used" — is pre-existing content that relocated
with the file in PR 1a (already listed as pre-existing debt in PR 0 gate notes).
Fixing this cross-cutting debt is explicitly out of scope (separate cleanup).
```

**Codemod gate (old auth/api path eradication)**: ✅ 0 hits everywhere
```text
rg "services/(authService|api)|store/authStore" src/                    → 0 hits ✅
rg "\./authStore" src/                                                  → 0 hits ✅
rg "\./api['\"`/]" src/ -g '!src/shared/**'                             → 0 hits ✅
rg "\./authService" src/                                                → 0 hits ✅

Old shim files deleted (confirmed via glob):
  src/services/authService.ts  → NOT FOUND ✅
  src/services/api.ts          → NOT FOUND ✅
  src/store/authStore.ts       → NOT FOUND ✅
```

**Coverage**: ➖ Not available (Vitest run without coverage threshold configured; not required by spec).

---

### Spec Compliance Matrix

#### Capability: `frontend-test-infra`

| Requirement | Scenario | Test / Evidence | Result | Status |
|-------------|----------|-----------------|--------|--------|
| Test Runner Entry Point | Engineer runs the suite from CLI | `npm test` → `vitest run`, 21/21 pass, exit 0; non-zero exit on failure (vitest semantics) | PASS | ✅ COMPLIANT |
| Test Runner Entry Point | Watch mode available | `package.json` scripts: `test:watch: vitest` (verified) | config | ✅ COMPLIANT |
| Component Test Environment | React component renders under test | All component tests render via RTL `render` + `screen` queries against jsdom; no browser launched | PASS | ✅ COMPLIANT |
| API Independence | Test runs with backend offline | `login.smoke`/`dashboard.smoke` mock `@/shared/api/apiClient` via `vi.mock`; 21/21 deterministic | PASS | ✅ COMPLIANT |
| Initial Smoke Coverage | Login smoke test | `src/test/login.smoke.test.tsx` (2 tests: renders form + accepts creds via mocked auth) | PASS | ✅ COMPLIANT |
| Initial Smoke Coverage | Gastos dashboard smoke test | `src/test/dashboard.smoke.test.tsx` (1 test: renders primary surface, mocked API) | PASS | ✅ COMPLIANT |
| Build and Lint Preservation | Existing scripts still pass | build exit 0 (both); lint 181/160/21 == pre-existing baseline (zero regression) but NOT exit-zero | PARTIAL | ⚠️ PARTIAL |

#### Capability: `app-routing`

| Requirement | Scenario | Test / Evidence | Result | Status |
|-------------|----------|-----------------|--------|--------|
| `/CxP/` Deployment Prefix | Built assets use the prefix | CxP build `dist/index.html`: all 6 asset refs under `/CxP/` | PASS | ✅ COMPLIANT |
| `/CxP/` Deployment Prefix | Router treats prefix as root | `App.tsx` `basename={import.meta.env.BASE_URL}`; CxP base=`/CxP/`; `BaseAppRoutes` relative routes | build+inspection | ✅ COMPLIANT |
| Authentication Guard | Unauthenticated user is redirected to login | `RequireAuth.test.tsx` > "Unauthenticated user is redirected…" | PASS | ✅ COMPLIANT |
| Authentication Guard | Authenticated user passes through | `RequireAuth.test.tsx` > "Authenticated user passes through…" | PASS | ✅ COMPLIANT |
| Authentication Guard | Guard checks authentication, not context selection | `RequireAuth.test.tsx` > "Guard checks authentication, not context…" | PASS | ✅ COMPLIANT |
| Static App Registry | Launcher reads from the static registry | `_registry.test.ts` (module shape) + `Home.test.tsx` (reads array, no backend call) | PASS | ✅ COMPLIANT |
| Static App Registry | Adding an app entry is code-only | `_registry.test.ts` > "adding an app entry is code-only" + `Home.test.tsx` > rerender with added entry | PASS | ✅ COMPLIANT |
| App Subtree Mounting | Future app subtree is addressable | `BaseAppRoutes.tsx` `<Routes>`/`<Route>` structure (architectural readiness; future subtree inherently untestable until it exists) | inspection | ✅ COMPLIANT |
| Gastos Backward Compatibility | Gastos route unchanged | Root build (BASE_URL_PATH=/) assets at `/`, 0 `/CxP/` hits; `App.tsx` branch → `<AppRoutes>`; `dashboard.smoke` renders Dashboard | PASS | ✅ COMPLIANT |

#### Capability: `base-app`

| Requirement | Scenario | Test / Evidence | Result | Status |
|-------------|----------|-----------------|--------|--------|
| Authenticated Shell Layout | Authenticated user sees the shell | `ShellLayout.test.tsx` > "Authenticated user sees the shell" (nav + main + content) | PASS | ✅ COMPLIANT |
| Authenticated Shell Layout | Unauthenticated user does not reach the shell | `RequireAuth.test.tsx` > redirect + returns null (subtree not rendered) | PASS | ✅ COMPLIANT |
| Home Launcher | Launcher lists registry apps | `Home.test.tsx` > "Launcher lists registry apps" (one tile per entry + nav href) | PASS | ✅ COMPLIANT |
| Home Launcher | Empty registry renders gracefully | `Home.test.tsx` > "Empty registry renders gracefully" (empty state) | PASS | ✅ COMPLIANT |
| Profile Page | Authenticated user opens profile | `Profile.test.tsx` > "Authenticated user opens profile" (heading renders) | PASS | ✅ COMPLIANT |
| Excludes Administration UI | Admin remains outside the shell | `ShellLayout.test.tsx` > "Excludes Administration UI" (no usuarios/roles/permisos) + `BaseAppRoutes` only `/` and `/perfil` | PASS | ✅ COMPLIANT |
| No Global Context Assumption | Shell renders without context selection | `ShellLayout.test.tsx` + `Profile.test.tsx` + `RequireAuth.test.tsx` (auth-only, no context provider) | PASS | ✅ COMPLIANT |

**Compliance summary**: **22/23 scenarios COMPLIANT**, 1 PARTIAL (pre-existing lint debt, zero regression).

---

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| `RequireAuth` uses `window.location.href` (not React `navigate`) | ✅ Implemented | `RequireAuth.tsx:35` — full-page redirect (cross-build nav; `navigate` cannot cross root↔/CxP/ bundles) |
| `RequireAuth` reads REAL `isAuthenticated` from `authStore` | ✅ Implemented | `RequireAuth.tsx:29` — `useAuthStore((state) => state.isAuthenticated)` (real selector, not hardcoded) |
| `_registry.ts` exports `appRegistry: AppRegistryEntry[]` per design interface | ✅ Implemented | `_registry.ts:33` — matches design interface exactly (id/label/path/icon?/description?/disabled?) |
| Placeholder entry is `disabled: true` | ✅ Implemented | `_registry.ts:39` — gastos entry `disabled: true` (not yet addressable under `/CxP/`) |
| `App.tsx` branch is minimal/additive; `<AppRoutes>` preserved for root | ✅ Implemented | `App.tsx:50,55` — single `isBaseAppShell` ternary; root build path untouched |
| `Login.tsx` `?return=` is additive + safelisted to `/CxP/` | ✅ Implemented | `Login.tsx:60-62` — `returnSearchParam.startsWith('/CxP/')` guard; default Gastos flow unchanged |
| `BaseAppRoutes` uses relative routes, no hardcoded `/CxP/` prefix | ✅ Implemented | `BaseAppRoutes.tsx:25-26` — `/` and `/perfil` (Router composes basename) |
| Old shim files deleted | ✅ Implemented | glob confirms `services/authService.ts`, `services/api.ts`, `store/authStore.ts` NOT FOUND |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Deployment model — two env-driven builds, same origin | ✅ Yes | `BASE_URL_PATH` drives both builds; root (`/`) + CxP (`/CxP/`) produced; same origin → shared localStorage SSO. `.env.production` sets `/CxP/`; root forced via env override. |
| App tree selection — branch on `import.meta.env.BASE_URL === '/CxP/'` | ✅ Yes | `App.tsx:50` exact predicate; minimal additive branch. |
| Login destination — full-page redirect to existing root `/login` with `?return=` safelist `/CxP/` | ✅ Yes | `RequireAuth` → `window.location.href='/login?return=…'`; `Login.tsx` honors `return` only when `startsWith('/CxP/')` (open-redirect guard). |
| Auth/api relocation — move + shims → codemod → delete shims | ✅ Yes | Files in `shared/`; shims deleted (glob-confirmed); codemod gate 0 hits (incl. sibling-aware patterns). 62 files rewritten (design est. ~55; +7 sibling-relative consumers — documented deviation, within budget). |
| Static app registry + test mocking (no MSW) | ✅ Yes | `_registry.ts` hardcoded array; tests use `vi.mock('@/shared/api')` + `vi.mock('@/apps/_registry')`. |

**Zero design deviations.** The codemod scope-count variance (62 vs ~55 files) was anticipated and documented in tasks.md; it does not break any spec or decision.

---

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. **frontend-test-infra spec scenario "Existing scripts still pass" is PARTIAL.** The spec text requires "`npm run lint` exit zero AND zero warnings." Reality: lint reports 181/160/21 and exits non-zero. This is **pre-existing cross-cutting debt** that predates this change (documented in PR 0 gate notes) and exhibits **ZERO regression** (181 before == 181 after). The spec's non-regression *intent* ("SHALL NOT regress existing scripts") is fully met; only the literal "exit zero" is unmet because the baseline was never green. Does not block archive.

**SUGGESTION**:
1. **Lint debt cleanup**: address the 181 pre-existing lint problems in a dedicated cleanup change so the spec's literal "exit zero" can be satisfied. Out of scope for `multi-app-foundation`.
2. **Codemod regex blind spot (process improvement)**: the design's gate regex `services/(authService|api)|store/authStore` misses sibling-relative imports (`./authStore`, `./api`). This was discovered and fixed during PR 1b (7 sibling consumers rewritten). Future codemods should default to a sibling-aware regex. Documented here for institutional memory.

---

### Verdict

**PASS WITH WARNINGS**

All 28 tasks complete; 22/23 spec scenarios COMPLIANT (1 PARTIAL due to pre-existing lint debt with zero regression); all 5 design decisions honored; runtime evidence fully green (tests 21/21, both builds exit 0, codemod gate 0 hits, Gastos root build provably unchanged). The single WARNING is pre-existing, out-of-scope lint debt that does not regress and does not block archive.
