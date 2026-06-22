# Design: Gastos Migration & Corrected Navigation Model

## Technical Approach

Refactor `routes/AppRoutes.tsx` (~30 absolute routes) into a reusable `<GastosRoutes>` module of **relative** `<Route>` children, mounted in BOTH builds: root at `/` (byte-identical to today), shell under `<Route path="gastos">`. Correct the foundation's nav: `/CxP/`→redirect, `/CxP/login`→2-step global, `/CxP/hub`→launcher, `/CxP/gastos/login`→3-step Gastos login. `RequireAuth` and `Login` become config-driven. No `features/` extraction (YAGNI); no old-URL redirects (corte limpio).

## Architecture Decisions

### Decision 1: Route-reuse — `<GastosRoutes>` returning relative `<Route>` children

| Option | Tradeoff | Verdict |
|---|---|---|
| **(a) Relative `<Route>` under parent** | One module; RR7 v7.13 composes relative child paths under any parent. Root: `<Routes><GastosRoutes variant="root"/></Routes>`. Shell: `<Route path="gastos" element={<Outlet/>}><GastosRoutes variant="subtree"/></Route>`. | ✅ Chosen |
| (b) Routes factory | Same power, more plumbing. | Rejected |
| (c) Two parallel defs | ~30-route drift; violates "same module". | Rejected |

**Rationale**: `basename="/"` → relative `dashboard` resolves to `/dashboard` (identical to today). `basename="/CxP/` + parent `gastos` → same `dashboard` resolves to `/CxP/gastos/dashboard`. **Root-build regression is the core hazard.** Mitigations: (1) every path becomes relative, including `<Navigate to="...">` inside `LandingRoute`/`ProtectedRoute`/`PublicOnlyRoute` — a leading-slash `/dashboard` would wrongly resolve to `/CxP/dashboard` in shell; (2) `variant: 'root'\|'subtree'` gates the ONE ununifiable behavior (unauth index: root keeps `<Hero>`, subtree redirects→`login`). RED tests lock root URLs before refactor.

### Decision 2: Login step-count — config prop threaded to store

| Option | Tradeoff | Verdict |
|---|---|---|
| **(a) `<Login requireContextSelection redirectTo/>`** | One component; prop threads into `loginStepTwo`. `false`→`isAuthenticated:true` after step 2 (skips step-3 load). | ✅ Chosen |
| (b) Two components | Duplicates the 600-line form. | Rejected |
| (c) Route-driven | Fragile URL↔behavior coupling. | Rejected |

**Rationale**: `loginStepTwo` already branches on `puedeSeleccionarEmpresas`; an explicit option keeps it testable. Mounts: global `<Login requireContextSelection={false} redirectTo="/hub"/>`; Gastos `<Login redirectTo="dashboard"/>`. `redirectTo` replaces hard-coded `navigate('/dashboard')`.

### Decision 3: Foundation adjustment surface

| File | Change | Preserved |
|---|---|---|
| `BaseAppRoutes.tsx` | `/`→`<Navigate>` (auth→`/hub`, unauth→`/login`); add `/login` (global, OUTSIDE `RequireAuth`); `/hub`→`<Home/>`; mount `<GastosRoutes variant="subtree">` under `gastos`. | `Profile`, `ShellLayout` (on `/hub`+`/perfil`). |
| `ShellLayout.tsx` | Nav `/`→`/hub`. | Layout, brand. |
| `_registry.ts` | `gastos.disabled: false`. | Entry shape. |

Blast radius: 2 files + 1 line. Gastos subtree keeps its own `MainLayout`.

### Decision 4: RequireAuth subtree-aware — prop-driven `<Navigate>` (within-build)

| Option | Tradeoff | Verdict |
|---|---|---|
| **(a) `loginPath` prop + `<Navigate>`** | Existing prop; shell is single-bundle so `<Navigate>` works (no full-page reload). Root uses its own `ProtectedRoute`. | ✅ Chosen |
| (b) AuthContext | Unjustified for 2 values. | Rejected |
| (c) Infer from `useLocation` | Implicit; harder to test. | Rejected |

**Rationale**: Both subtrees live in the SAME shell build → `<Navigate>` is cleaner than foundation's `window.location.href`. Mounts: shell `<RequireAuth loginPath="/login"/>`; Gastos `<RequireAuth loginPath="/gastos/login"/>`. Guard checks AUTH ONLY (foundation requirement intact).

## Data Flow

```
ROOT (basename "/")                         SHELL (basename "/CxP/")
/ → <GastosRoutes variant="root">           /CxP/       → <Navigate> auth→/hub | unauth→/login
   ├ index: <Hero>(unauth) | dashboard      /CxP/login  → <Login requireContextSelection={false} redirectTo="/hub"/>
   ├ login: <Login 3-step>                  /CxP/hub    → <RequireAuth loginPath="/login"><ShellLayout><Home/></...>
   └ dashboard, catalogos/* (relative)      /CxP/perfil → <RequireAuth loginPath="/login"><ShellLayout><Profile/></...>
                                            /CxP/gastos → <GastosRoutes variant="subtree" loginPath="/gastos/login">
                                               ├ index: auth→dashboard | unauth→/gastos/login
                                               ├ login: <Login redirectTo="dashboard"/>
                                               └ dashboard, catalogos/* (relative, under gastos/)
SSO: same origin → shared localStorage (accessToken, user).
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/apps/gastos/GastosRoutes.tsx` | Create | Reusable route module; relative paths; `variant`+`loginPath`. |
| `src/routes/AppRoutes.tsx` | Modify | 1-line root mount. |
| `src/apps/baseapp/BaseAppRoutes.tsx` | Modify | `/` redirect; `/login`; `/hub`→Home; mount Gastos. |
| `src/apps/baseapp/ShellLayout.tsx` | Modify | Nav `/`→`/hub`. |
| `src/routes/LandingRoute.tsx` | Modify | Guards take `loginPath`; relative redirects; `variant` index. |
| `src/shared/auth/RequireAuth.tsx` | Modify | `window.location.href`→`<Navigate>`. |
| `src/pages/auth/Login.tsx` | Modify | Add `requireContextSelection`+`redirectTo`. |
| `src/shared/auth/authStore.ts` | Modify | `loginStepTwo` option param. |
| `src/apps/_registry.ts` | Modify | `gastos.disabled: false`. |
| `src/test/{gastos-routes,baseapp-routes,require-auth}.test.tsx` | Create | RED tests (3 files). |

## Interfaces / Contracts

```ts
// src/apps/gastos/GastosRoutes.tsx
export interface GastosRoutesProps {
  variant: 'root' | 'subtree';   // root: <Hero> index; subtree: redirect-to-login index
  loginPath?: string;            // default '/login' (root) | '/gastos/login' (subtree)
}
export function GastosRoutes(props: GastosRoutesProps): React.JSX.Element; // fragment of <Route>
```

```ts
// src/pages/auth/Login.tsx
export interface LoginProps {
  requireContextSelection?: boolean;  // default true (3-step); false → 2-step global
  redirectTo?: string;                // default 'dashboard'; '/hub' for global
}
// src/shared/auth/authStore.ts
loginStepTwo: (password: string, domain: string, options?: { requireContextSelection?: boolean }) => Promise<void>;
```

```tsx
// src/shared/auth/RequireAuth.tsx
export function RequireAuth({ children, loginPath = '/login' }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to={loginPath} replace />;
  return <>{children}</>;
}
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | GastosRoutes root-vs-subtree URL parity; RequireAuth subtree redirect; Login 2-vs-3 step; `loginStepTwo` option; `BaseAppRoutes` `/` redirect. | Vitest 3.2 + RTL 16 + jsdom; `vi.mock('@/shared/api')`; `MemoryRouter`+`basename`. |
| Integration | `/CxP/gastos/dashboard` post-3-step; `/CxP/hub` post-2-step; SSO cross-subtree. | RTL + `MemoryRouter initialEntries`. |
| Build/Lint | Both builds green. | `BASE_URL_PATH=/` and `/CxP/` builds; `lint --max-warnings 0`. |

## Migration / Rollout

Chained PR slices (≤400 lines). Feature-branch chain: PR1→tracker; PR2→PR1; PR3→PR2.

| Slice | Scope | Verify | Rollback |
|---|---|---|---|
| **PR1** | `GastosRoutes` extraction + relative refactor; `AppRoutes`→root mount; `LandingRoute` parameterized. Root byte-identical. | Root RED tests; both builds+lint green. | Revert `AppRoutes`/`LandingRoute`. |
| **PR2** | `Login` props + `authStore` option; `RequireAuth`→`<Navigate>`. | 2/3-step + subtree redirect tests. | Revert those 3 files. |
| **PR3** | `BaseAppRoutes` rework; `ShellLayout`; `_registry` flip; mount Gastos. | Shell full nav; SSO; both builds green. | Revert those 3 files. |

**400-line budget risk**: Medium (PR1 ~105-line `AppRoutes`+`LandingRoute` + ~110-line `GastosRoutes`). If exceeded, split extraction from relative rewrite.

## Open Questions

- [ ] Root `<Hero>` landing: design preserves it ("root unchanged"). If team wants root `/`→`/login` too, 1-line `variant` flip — confirm before PR1.
- [ ] `Login.tsx` `return`-param safelist: redundant within shell build. Keep or remove?
