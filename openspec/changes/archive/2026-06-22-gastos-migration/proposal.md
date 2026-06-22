# Proposal: Gastos Migration & Corrected Navigation Model

## Intent

Bundled change. (1) Replace the foundation's WRONG navigation model (`/CxP/` = Home) with the corrected one — root redirect, global login, hub launcher, per-app logins. (2) Mount the entire current Gastos SPA under `/CxP/gastos/` with its own 3-step login. Root build stays unchanged (dual coexistence). This supersedes the archived `multi-app-foundation` navigation decisions.

## Scope

### In Scope

- `/CxP/` becomes a redirect: no-auth → `/CxP/login`, auth → `/CxP/hub`.
- Global `/CxP/login` (steps 1-2: username, password+domain). `/CxP/hub` = apps launcher.
- Gastos subtree `/CxP/gastos/` (auth → Dashboard directly) + `/CxP/gastos/login` (steps 1-2-3; step 3 = empresa/sucursal/area is GASTOS-ONLY — corrects the foundation's inverse claim).
- Whole current `AppRoutes` (dashboard, catálogos, workflows, órdenes, seguridad, help, perfil, notificaciones) reused as the Gastos subtree.
- `RequireAuth` redirect destination becomes subtree-aware (`/CxP/login` for shell, `/CxP/gastos/login` for Gastos). Guard still checks AUTH ONLY, never context.
- Flip `gastos` registry entry to enabled. SSO via localStorage same-origin (no re-login across apps).
- New Vitest tests (RED/GREEN). Root build (`<AppRoutes>`) functionally unchanged.

### Out of Scope

- Feature extraction (`features/` → shared). YAGNI; deferred to `cxp-app`.
- Removing/redirecting old root URLs. Additive only; root build untouched.
- Backend changes. Second-app (`cxp`) extraction.

## Capabilities

> Contract with sdd-spec. Verified against `openspec/specs/` (`app-routing`, `base-app`, `frontend-test-infra`).

### New Capabilities

- `gastos-app`: the Gastos app subtree under `/CxP/gastos/` — its route table, Dashboard landing, `/CxP/gastos/login` (3-step), and subtree-level `RequireAuth`.

### Modified Capabilities

- `app-routing`: corrected navigation model — `/CxP/` becomes a redirect (not Home); adds global `/CxP/login`, `/CxP/hub` launcher, and per-app `/login` pattern; `RequireAuth` redirect destination now subtree-aware; "App Subtree Mounting" becomes live (was future); step-3 context is Gastos-only (not platform-wide).
- `base-app`: Home Launcher moves to `/hub` (was default landing at `/`); shell gains a `/login` surface (steps 1-2, no step 3); Profile unchanged; admin exclusion unchanged.

## Approach

Refactor the ~30-route `AppRoutes` table into a reusable Gastos route module mounted in BOTH builds (root: absolute paths, unchanged behavior; shell: composed under `/CxP/gastos/`). Adjust `BaseAppRoutes` for `/` redirect, `/hub`, and `/login`. Make `RequireAuth` accept a per-subtree login destination. Make `Login` support both 2-step (global) and 3-step (Gastos) via mount-time config. HOW routes are reused (relative `<Route>` under a parent vs a routes factory) and HOW Login step-count is configured are deferred to `sdd-design`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lefarma.frontend/src/apps/gastos/` | New | Gastos subtree: routes module, Dashboard landing, login mount |
| `lefarma.frontend/src/apps/baseapp/BaseAppRoutes.tsx` | Modified | `/` redirect, `/hub`, `/login`, mount Gastos subtree |
| `lefarma.frontend/src/shared/auth/RequireAuth.tsx` | Modified | Subtree-aware login destination |
| `lefarma.frontend/src/apps/_registry.ts` | Modified | Flip `gastos` to enabled |
| `lefarma.frontend/src/pages/auth/Login.tsx` | Modified | Configurable step count (2 vs 3) |
| `lefarma.frontend/src/routes/AppRoutes.tsx` | Modified | Reuse new Gastos route module (root behavior preserved) |
| `lefarma.frontend/src/apps/{gastos,baseapp}/*.test.tsx` | New | Redirect, hub, per-subtree auth, Gastos routing |

## Risks

| Risk | L | Mitigation |
|------|---|------------|
| Route-reuse refactor breaks root build | Med | Same module mounted unchanged in root; keep existing tests green |
| Archived foundation model contradicts corrected model | Med | Delta specs explicitly supersede archived navigation decisions |
| Login step-count configurability over-engineered | Med | Defer HOW to design; support 2/3 only (no N-step) |
| SSO assumption fails across subtrees | Low | Same-origin localStorage; add cross-subtree session test |
| Root-build regression from shared module | Med | Root build runs the module with absolute paths; covered by existing tests |

## Rollback Plan

- **Navigation rework**: revert `BaseAppRoutes.tsx`, `RequireAuth.tsx`, `Login.tsx`, `_registry.ts` to foundation state (commit `02af00a`).
- **Gastos subtree**: delete `lefarma.frontend/src/apps/gastos/`, restore `AppRoutes.tsx` to its inline absolute-path form.
- Re-run `npm test` and `npm run build` for both builds.

## Dependencies

- Foundation `multi-app-foundation` (committed `02af00a`, archived).
- Vitest + RTL runner (landed in foundation).

## Success Criteria

- [ ] `/CxP/` redirects no-auth → `/CxP/login`, auth → `/CxP/hub`.
- [ ] `/CxP/login` shows steps 1-2; `/CxP/gastos/login` shows steps 1-2-3.
- [ ] `/CxP/gastos/` renders the Dashboard for authenticated users.
- [ ] Unauth visit to `/CxP/hub` or `/CxP/gastos/` redirects to the correct per-subtree login with `return` preserved.
- [ ] `/CxP/hub` → `/CxP/gastos/` does NOT require re-login (SSO).
- [ ] Root build URLs (`/dashboard`, `/catalogos/*`, etc.) work unchanged.
- [ ] `npm test` green; `npm run build` passes for both builds.
