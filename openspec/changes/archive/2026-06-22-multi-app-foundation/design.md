# Design: Multi-App Foundation

## Technical Approach

Three sequential phases turn the Lefarma SPA into a multi-app platform under `/CxP/` without altering current Gastos behavior. **The high-risk Vite-base tension is already resolved by existing code**: `vite.config.ts` reads `BASE_URL_PATH` (default `/`) for `base`, and `App.tsx` sets `<BrowserRouter basename={import.meta.env.BASE_URL}>`. We therefore ship **two builds from one codebase** — root build (Gastos, unchanged) and `/CxP/` build (new shell) — both same-origin so localStorage SSO is automatic. Phase 0 lands Vitest to lock behavior; Phase 1 relocates auth/api into `shared/`; Phase 2 adds the base shell + registry. Maps to proposal capabilities `frontend-test-infra`, `app-routing`, `base-app`.

## Architecture Decisions

### Decision: Deployment model — two env-driven builds, same origin

| Aspect | Detail |
|---|---|
| **Choice** | Two builds via `BASE_URL_PATH` (root `/` and `/CxP/`); each IIS virtual app points to its own `dist`. |
| **Alternatives** | (a) Single build under `/CxP/` → breaks Gastos at root. (c) Single build + conditional routes → `base` bakes asset URLs at build time, cannot serve both prefixes from one bundle cleanly. |
| **Rationale** | `vite.config.ts` (`env.BASE_URL_PATH \|\| '/'`) and `App.tsx` (`basename={import.meta.env.BASE_URL}`) ALREADY implement env-driven base+basename. Gastos root build stays 100% untouched (zero risk). Same origin → shared localStorage → SSO free. |

### Decision: App tree selection — branch on `import.meta.env.BASE_URL`

| Aspect | Detail |
|---|---|
| **Choice** | `App.tsx` renders `<BaseAppRoutes>` when `BASE_URL === '/CxP/'`, else current `<AppRoutes>`. |
| **Alternatives** | Mount both trees in one `<Routes>` → route-path collisions across prefixes. |
| **Rationale** | Each build renders exactly one tree; no collision; existing `routes/AppRoutes.tsx` untouched. |

### Decision: Login destination — full-page redirect to EXISTING root `/login`

| Aspect | Detail |
|---|---|
| **Choice** | `RequireAuth` (CxP build) does `window.location.href = '/login?return=' + encodeURIComponent(path)` to the EXISTING root login; root `Login.tsx` honors a new optional `return` param on success. |
| **Alternatives** | Mount `<Login/>` under `/CxP/login` → violates decision #3 (no base-app login). Duplicate the login component → violates "not duplicated." |
| **Rationale** | Matches authoritative decision exactly. Same-origin nav preserves session. `return` param is additive/non-breaking. Recommended safelist: only honor paths starting with `/CxP/` (open-redirect guard). |

### Decision: Auth/api relocation — move + compatibility shims, then mechanical rewrite

| Aspect | Detail |
|---|---|
| **Choice** | Phase 1a: move files to `shared/`, leave one-line `export *` shims at old paths (green). Phase 1b: codemod-rewrite all imports to `@/shared/...`, delete shims (green). |
| **Alternatives** | Big-bang rewrite of all 63 imports in one slice → exceeds 800-line review budget. |
| **Rationale** | Import surface is LARGE: `authService`=7, `authStore`=21, `api`=35 (**63 statements, ~55 unique files**). Shims isolate risk; the codemod slice is mechanical/skimmable. Ends at zero old-path references (meets success criterion). |

### Decision: Static app registry + test mocking

| Decision | Choice | Rationale |
|---|---|---|
| Registry | Hardcoded `apps/_registry.ts` exporting `AppRegistryEntry[]`; `Home` maps it to tiles. No backend call. | Spec mandates code-level registry; matches "launcher reads static registry." |
| Test mocks | Manual `vi.mock('@/shared/api')` (no MSW). | Lean — MSW unjustified for 2 smoke tests; revisit when test count grows. |

## Data Flow

```
IIS  /      -> root build (base=/)   -> <AppRoutes>      (Gastos, UNCHANGED)
IIS /CxP/   -> CxP  build (base=/CxP/) -> <BaseAppRoutes>
                                            |
                          RequireAuth --- unauth ---> window.location -> /login?return=/CxP/...
                              | auth ok                    (root build, same origin, shared localStorage)
                          ShellLayout
                              |
                  Home (reads apps/_registry.ts) / Profile
```

## File Changes

| File | Action | Description |
|---|---|---|
| `lefarma.frontend/vitest.config.ts` | Create | jsdom env, globals, setup entry, alias `@`. |
| `lefarma.frontend/src/test/setup.ts` | Create | RTL `jest-dom` matchers, `localStorage`/`matchMedia` stubs. |
| `lefarma.frontend/src/test/login.smoke.test.tsx` | Create | Login renders + accepts creds (mocked auth). |
| `lefarma.frontend/src/test/dashboard.smoke.test.tsx` | Create | Gastos dashboard renders (mocked API). |
| `lefarma.frontend/package.json` | Modify | Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`; `test` + `test:watch` scripts. |
| `lefarma.frontend/src/shared/auth/authService.ts` | Create | Moved from `services/authService.ts`. |
| `lefarma.frontend/src/shared/auth/authStore.ts` | Create | Moved from `store/authStore.ts`. |
| `lefarma.frontend/src/shared/api/apiClient.ts` | Create | Moved from `services/api.ts` (exports `API`, `proveedorApi`, default). |
| `lefarma.frontend/src/shared/auth/RequireAuth.tsx` | Create | Guard: redirect to `/login?return=…` when unauthenticated. |
| `lefarma.frontend/src/services/{authService,api}.ts`, `src/store/authStore.ts` | Modify→Delete | 1a: re-export shim; 1b: delete. |
| `lefarma.frontend/src/apps/_registry.ts` | Create | `AppRegistryEntry[]` (hardcoded; placeholder entries OK). |
| `lefarma.frontend/src/apps/baseapp/BaseAppRoutes.tsx` | Create | `<Routes>`: `/` Home launcher, `/perfil` Profile, wrapped in `RequireAuth`+`ShellLayout`. |
| `lefarma.frontend/src/apps/baseapp/{ShellLayout,Home,Profile}.tsx` | Create | Shell + launcher + profile. |
| `lefarma.frontend/src/App.tsx` | Modify | Branch on `BASE_URL === '/CxP/'` → `<BaseAppRoutes>` else `<AppRoutes>`. |
| `lefarma.frontend/src/pages/auth/Login.tsx` | Modify | Honor optional `?return=` param post-success (additive, safelisted to `/CxP/`). |
| `lefarma.frontend/.env.cxp` | Create | `BASE_URL_PATH=/CxP/` for the CxP build. |
| `~55 files importing auth/api` | Modify | Phase 1b codemod: `@/services/authService`→`@/shared/auth/authService`, `@/store/authStore`→`@/shared/auth/authStore`, `@/services/api`→`@/shared/api/apiClient`. |

## Interfaces / Contracts

```ts
// src/apps/_registry.ts
export interface AppRegistryEntry {
  id: string;            // 'gastos' | 'cxp' | ...
  label: string;         // launcher tile label
  path: string;          // navigation target, absolute (e.g. '/CxP/gastos/')
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}
export const appRegistry: AppRegistryEntry[];
```

```tsx
// src/shared/auth/RequireAuth.tsx
interface RequireAuthProps {
  children: React.ReactNode;        // protected subtree
  loginPath?: string;               // default '/login' (existing root login)
}
// if !isAuthenticated -> window.location.href = `${loginPath}?return=${encodeURIComponent(path+search)}`
// else render children. Does NOT block on empresa/sucursal/area context (deferred to per-app logic).
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `RequireAuth` redirect + return-URL; registry render; empty-registry state | Vitest + RTL, `vi.mock('@/shared/api')`, assert `window.location` + DOM. |
| Smoke | Login form renders + accepts creds; Gastos dashboard renders | RTL + jsdom, mocked auth/API (Phase 0). |
| Build/Lint | Green per phase | `npm run build` + `npm run lint -- --max-warnings 0`. |
| Manual | `/CxP/` shell loads, unauth redirects to root `/login`, return-URL works | Two local builds (`BASE_URL_PATH=/` and `/CxP/`). |
| E2E | Out of scope (Playwright present but not required by spec). | — |

## Migration / Rollout

Chained PR slices (review budget 800 lines). Feature-branch chain: PR 1a → tracker; PR 1b targets 1a; PR 2 targets 1b.

| Slice | Scope | Verify | Rollback |
|---|---|---|---|
| **PR 0** (Phase 0) | Vitest + RTL + jsdom + 2 smoke tests; `npm test` script. | `npm test` green; build+lint green. | Remove deps + `vitest.config.ts` + `src/test/`. |
| **PR 1a** (Phase 1) | Move auth/api → `shared/`; add `export *` shims at old paths. | Build+lint+test green; app behavior unchanged. | Delete `shared/`, restore old files. |
| **PR 1b** (Phase 1) | Codemod rewrite ~55 files to `@/shared/...` (BOTH `@/`-aliased AND relative imports, e.g. `./store/authStore` in `App.tsx`); delete shims. | `rg "services/(authService\|api)\|store/authStore"` across `src/` (excluding `shared/` destinations) = **0 hits**; `npm run build` + lint green. | Revert codemod commit. |
| **PR 2** (Phase 2) | `apps/baseapp/*`, `_registry.ts`, `RequireAuth`, `App.tsx` branch, `Login.tsx` return-param. | `/CxP/` build shows shell + redirect; root build unchanged. | Remove `apps/`, revert `App.tsx`/`Login.tsx`. |

## Open Questions

- [ ] **BLOCKING PREREQUISITE for Phase 2** (resolve before implementing PR 2): Confirm ops will host TWO physical IIS deployments (root + `/CxP/`) from two build artifacts (same site/app pool or shared?). Design assumes yes; if one-artifact is mandatory, revisit Decision 1 toward option (c) with IIS rewrite rules — in which case Decision 1's clean two-build model collapses and the design must be revisited before Phase 2.
- [ ] `Login.tsx` `return`-param safelist: confirm restricting to paths starting with `/CxP/` is acceptable (prevents open-redirect).
