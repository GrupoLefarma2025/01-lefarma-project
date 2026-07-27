# Proposal: Multi-App Foundation

## Intent

Turn the Lefarma SPA from an expense app into a multi-app platform under a shared `/CxP/` prefix — without altering current Gastos behavior. Adds test infra, the `apps/`/`features/`/`shared/` layout, and a base shell to unblock `gastos-migration` and `cxp-app`.

## Scope

### In Scope
- **Phase 0**: Add Vitest + React Testing Library + jsdom; `npm test`; smoke tests (login, Gastos dashboard).
- **Phase 1**: Create `apps/`/`features/`/`shared/`; relocate `services/authService.ts` + `store/authStore.ts` → `shared/auth/`; `services/api.ts` → `shared/api/apiClient.ts`; fix imports; build + lint + test green.
- **Phase 2**: Build `apps/baseapp/` (layout, home launcher, profile — NO admin); `RequireAuth` guard; Router 7 basename `/CxP/`; Vite `base: '/CxP/'`; hardcoded `apps/_registry.ts`.
- Existing Gastos stays functional at its current root route.

### Out of Scope
- Gastos → `/CxP/gastos/` (`gastos-migration`); CxP app `/CxP/cxp/` + login-flow step-3 split (`cxp-app`); decoupling global context from `authStore` (`cxp-app`); **existing user/role admin UI stays where it is (NOT moved to baseapp)**; `front2` handoff; backend changes.

## Capabilities

### New Capabilities
- `frontend-test-infra`: Vitest + RTL + jsdom, `npm test` scripts, login + Gastos smoke tests.
- `app-routing`: Path-based multi-app routing under `/CxP/`; Router 7 basename; hardcoded app registry; `RequireAuth`.
- `base-app`: Minimum shell — home launcher (hardcoded `_registry.ts`), profile. Existing user/role admin UI stays in place; not relocated here.

### Modified Capabilities
- None — auth files relocate without behavioral change; login-flow split is `cxp-app`.

## Approach

Three sequential phases (chained PR slices): tests first to lock behavior → refactor moving auth + api into `shared/` via `@/shared/...` aliases → base shell + routing under `/CxP/`. Same origin keeps localStorage SSO automatic.

## Affected Areas

| Area | Impact |
|------|--------|
| `lefarma.frontend/{package.json,vite.config.ts}` + `src/test/` | Modified/New — Vitest deps/config, `base: '/CxP/'`, smoke tests |
| `src/shared/{auth,api}/` | New — relocated `authService`, `authStore`, `apiClient`, new `RequireAuth` |
| `src/apps/{baseapp,_registry.ts}` | New — layout, Home (launcher)/Profile, routes, hardcoded `_registry.ts` |
| `src/routes/AppRoutes.tsx` | Modified — mount base app, Router basename |
| `src/{services,store}/` | Modified — old auth/api removed; imports updated |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Broken imports post-relocation | Medium | Smoke tests lock behavior; per-phase gates |
| No frontend runner until Phase 0 (Strict-TDD tension) | Medium | Phase 0 lands Vitest BEFORE moves |
| Vite `base: '/CxP/'` breaks Gastos at root | High | Gastos URL unchanged this change |
| `authStore` global context constrains future apps | Low | Foundation must NOT assume global context mandatory |

## Rollback Plan

Per-phase revert:
1. **Phase 0**: Remove Vitest/RTL/jsdom/coverage; delete `vitest.config.ts`, `src/test/`, `test` scripts.
2. **Phase 1**: Restore old auth/api files from git; revert imports; remove `apps/`/`features/`/`shared/`.
3. **Phase 2**: Remove `apps/baseapp/`, `RequireAuth`; restore prior `AppRoutes.tsx`; revert Vite `base`.

## Dependencies

- React Router 7 (present) — confirm basename API.
- IIS `/CxP/` virtual application — CONFIRMED (ops): prefix `/CxP/` reaches the SPA; requires `Vite base: '/CxP/'` + Router `basename='/CxP/'`.

## Success Criteria

- [ ] `npm test` passes ≥2 smoke tests (login, Gastos dashboard).
- [ ] `npm run build` + `npm run lint` green after each phase.
- [ ] No references to old `services/authService`, `services/api`, `store/authStore`.
- [ ] `/CxP/` shows base shell with login redirect when unauthenticated.
- [ ] Existing Gastos renders + authenticates at current route.
