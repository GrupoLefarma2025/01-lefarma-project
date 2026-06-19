# Design: Lefarma Multi-App Platform

**Date**: 2026-06-19
**Status**: Draft — Pending User Review
**Author**: Architecture brainstorming session

---

## Goal

Transform the existing Lefarma expense system ("sistema de gastos") into a centralized multi-app platform where each business area (Gastos, CxP, etc.) has its own application with dedicated UX, while sharing authentication (SSO) and reusable business features across all apps.

## Vision

```
<ip>:puerto/baseapp/                  → Base app (shell, home launcher, admin)
<ip>:puerto/baseapp/login             → Base login
<ip>:puerto/baseapp/gastos/           → Gastos app (current system, migrated)
<ip>:puerto/baseapp/gastos/login      → Gastos login (UX)
<ip>:puerto/baseapp/cxp/              → Cuentas por Pagar app (new)
<ip>:puerto/baseapp/cxp/login         → CxP login (UX)
<ip>:puerto/baseapp/{future-app}/     → Pattern repeats for each new app
```

**Single domain, path-based routing, SSO via shared localStorage.**

---

## Architecture

### Pattern: Single SPA with Path-Based Multi-App UX

One React 19 SPA + one .NET 10 backend. Each "app" is a logical section under `/baseapp/{app-name}/` with:
- Its own route subtree and layout
- Its own `/login` page (UX/discoverability — calls shared auth endpoints)
- Its own feature pages

Auth is shared automatically because all paths live on the same origin (localStorage is shared across paths).

### Why Not Multi-App / Micro-Frontends

- **Single team** maintains everything — no need for deployment isolation
- **Apps overlap at the feature level** — shared modules are first-class, not an afterthought
- **Same domain** — SSO is trivial via localStorage; no handoff/federation needed
- **Simpler deployment** — one build, one backend, one pipeline

### High-Level Diagram

```
┌──────────────────────────────────────────────────────────┐
│  SINGLE SPA (React 19 + Vite + React Router)             │
│  Origin: <ip>:puerto                                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Base App │  │  Gastos  │  │   CxP    │  │ Future │  │
│  │ (shell)  │  │ (current)│  │  (new)   │  │  apps  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       └─────────────┴─────────────┴─────────────┘       │
│                      │                                   │
│           ┌──────────┴──────────┐                        │
│           │  SHARED FEATURES    │                        │
│           │  (proveedores,      │                        │
│           │   facturas,         │                        │
│           │   aprobaciones...)  │                        │
│           └─────────────────────┘                        │
└──────────────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│  SINGLE BACKEND (.NET 10 Clean Architecture)             │
│  /api/auth/*       → SSO (shared login)                  │
│  /api/gastos/*     → Gastos endpoints                    │
│  /api/cxp/*        → CxP endpoints                       │
│  /api/shared/*     → Cross-app feature endpoints         │
└──────────────────────────────────────────────────────────┘
```

---

## Authentication & SSO

### Current State (Preserved)

The existing auth system is kept as-is:

- **Storage**: `localStorage` keys: `accessToken`, `refreshToken`, `user`, `empresa`, `sucursal`, `area`
- **Login flow**: 3 steps
  1. Username → returns available AD domains
  2. Password + domain → returns JWT tokens + user info
  3. Empresa + sucursal + area selection → sets `isAuthenticated: true`
- **Token refresh**: Axios interceptor handles 401 → refresh → retry
- **Handoff mechanism** (`/api/auth/handoff` + `/api/auth/exchange`): existing cross-domain SSO for `front2`. **Untouched** — remains available if apps ever move to separate subdomains.

### SSO for Path-Based Multi-App

Because all apps live on the same origin (`<ip>:puerto`), localStorage is **automatically shared** across all paths. No additional SSO infrastructure is needed.

- Any app's route guard calls `authService.isAuthenticated()` — same check for all apps
- Any app's `/login` page calls the same `/api/auth/login-step-one` and `/api/auth/login-step-two` endpoints
- If authenticated user visits any `/login`, redirect to that app's home
- If unauthenticated user visits any app, redirect to that app's `/login`

### Per-App Authorization (Future Enhancement)

The JWT currently includes role and permission claims. To support per-app access control:
- Add `apps` claim to JWT (e.g., `["gastos", "cxp"]`)
- Route guards verify the user has access to the target app
- Base app home only shows apps the user can access

**This is not required for MVP** — can be added when the second app (CxP) is introduced.

---

## Multi-Tenant Context

### Assumption: Global Context (Default)

**One selection of `empresa`/`sucursal`/`area` applies to ALL apps.**

This matches the **current code behavior** (single `empresa`/`sucursal`/`area` in localStorage). When the user changes context in any app, it changes globally.

### Override Path

If business needs require per-app context in the future (e.g., Gastos in Empresa A while CxP in Empresa B):
- Refactor `authStore` to store context per-app: `contexts: { gastos: {empresa, sucursal, area}, cxp: {...} }`
- Add UI indicator showing which context is active per app
- This is a **non-breaking extension** — global context is a special case of per-app where all apps share one entry

---

## Frontend Structure

### Directory Layout

```
lefarma.frontend/src/
├── apps/                              # App shells per area
│   ├── baseapp/
│   │   ├── routes.tsx                 # Routes: /, /admin, /profile
│   │   ├── layout/
│   │   │   └── BaseAppLayout.tsx
│   │   └── pages/
│   │       ├── HomePage.tsx           # App launcher
│   │       ├── AdminPage.tsx          # User/role management
│   │       └── ProfilePage.tsx
│   │
│   ├── gastos/
│   │   ├── routes.tsx                 # Routes: /gastos/*
│   │   ├── layout/
│   │   │   └── GastosLayout.tsx
│   │   └── pages/
│   │       ├── GastosLoginPage.tsx    # UX login (shared auth flow)
│   │       ├── GastosDashboardPage.tsx
│   │       └── ...
│   │
│   ├── cxp/
│   │   ├── routes.tsx                 # Routes: /cxp/*
│   │   ├── layout/
│   │   │   └── CxPLayout.tsx
│   │   └── pages/
│   │       ├── CxPLoginPage.tsx
│   │       ├── CxPDashboardPage.tsx
│   │       └── ...
│   │
│   └── _registry.ts                   # Central app registry (for launcher)
│
├── features/                          # Reusable business features (THE OVERLAP)
│   ├── proveedores/                   # Used by Gastos + CxP
│   │   ├── api/
│   │   │   └── proveedoresApi.ts
│   │   ├── components/
│   │   │   ├── ProveedorPicker.tsx
│   │   │   └── ProveedorCard.tsx
│   │   ├── hooks/
│   │   │   └── useProveedores.ts
│   │   └── types.ts
│   │
│   ├── facturas/                      # Used by Gastos + CxP
│   ├── aprobaciones/                  # Approval workflow
│   └── archivos/                      # Upload/download
│
├── shared/                            # Cross-cutting (non-business)
│   ├── auth/
│   │   ├── AuthProvider.tsx           # SSO context
│   │   ├── useAuth.ts                 # Hook: user, login, logout
│   │   ├── RequireAuth.tsx            # Route guard
│   │   └── authStore.ts               # Zustand store (migrated from store/)
│   ├── api/
│   │   ├── apiClient.ts               # Axios with JWT interceptor
│   │   └── apiErrors.ts
│   ├── ui/                            # shadcn/ui components
│   └── lib/                           # Utils, formatters
│
├── routes/
│   └── AppRoutes.tsx                  # Root router loading all apps
│
└── main.tsx
```

### Key Principles

1. **`apps/` contains shells** — routing, layout, app-specific pages. Apps do NOT contain reusable business logic.
2. **`features/` contains reusable business modules** — each feature exports components, hooks, API calls, and types. Features do NOT define routes.
3. **`shared/` contains infrastructure** — auth, API client, UI primitives, utilities. No business logic.
4. **Apps import from `features/` and `shared/`**, never from other apps.

### Feature Overlap Example

"Aprobar factura" must appear in both Gastos and CxP:

```
features/aprobaciones/
├── api/aprobacionesApi.ts             # API calls
├── components/
│   ├── ApproveFacturaButton.tsx       # Reusable button
│   └── ApproveFacturaDialog.tsx       # Reusable modal
├── hooks/useApproveFactura.ts
└── types.ts
```

Usage in Gastos:
```tsx
import { ApproveFacturaButton } from '@/features/aprobaciones/components/ApproveFacturaButton'
```

Usage in CxP:
```tsx
import { ApproveFacturaDialog } from '@/features/aprobaciones/components/ApproveFacturaDialog'
```

Each app decides the UX (button vs dialog, placement), but business logic lives once in `features/`.

---

## Backend Structure

Clean Architecture preserved. Features organized by area + shared:

```
Features/
├── Auth/                              # Existing — SSO endpoints
│   ├── AuthController.cs              # /api/auth/*
│   ├── AuthService.cs
│   └── ...
├── Gastos/                            # Gastos-specific endpoints
├── CxP/                               # CxP-specific endpoints
├── Shared/                            # Cross-app feature endpoints
│   ├── Proveedores/                   # /api/shared/proveedores
│   ├── Facturas/                      # /api/shared/facturas
│   ├── Aprobaciones/                  # /api/shared/aprobaciones
│   └── Archivos/                      # /api/shared/archivos
└── ...
```

### API Route Convention

- `/api/auth/*` → Auth (shared)
- `/api/gastos/*` → Gastos only
- `/api/cxp/*` → CxP only
- `/api/shared/*` → Features used by multiple apps

---

## Routing Details

### Route Tree

```
/baseapp/                    → BaseAppLayout
  /                          → HomePage (app launcher)
  /login                     → BaseLoginPage
  /admin                     → AdminPage
  /profile                   → ProfilePage
  /gastos/                   → GastosLayout (nested)
    /login                   → GastosLoginPage
    /dashboard               → GastosDashboard
    /...                     → Gastos features
  /cxp/                      → CxPLayout (nested)
    /login                   → CxPLoginPage
    /dashboard               → CxPDashboard
    /...                     → CxP features
```

### Route Guards

```tsx
// shared/auth/RequireAuth.tsx
function RequireAuth({ children, app }: { children: ReactNode; app?: string }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    // Redirect to this app's login, preserving intended URL
    return <Navigate to={`/${app || 'baseapp'}/login`} replace />
  }
  return children
}
```

### Login Redirect Logic

```
Visit /baseapp/gastos/dashboard while unauthenticated
  → Redirect to /baseapp/gastos/login (preserve return URL)

Visit /baseapp/gastos/login while authenticated
  → Redirect to /baseapp/gastos/dashboard
```

---

## Testing Strategy

### Current State

| Layer | Stack | Status |
|-------|-------|--------|
| Backend unit | xUnit + Moq + FluentAssertions | ✅ Active |
| Backend integration | WebApplicationFactory + EF InMemory | ✅ Active |
| Backend E2E | IntegrationTests project | ✅ Active |
| Backend coverage | coverlet | ✅ Active |
| Frontend unit | — | ❌ **Missing** |
| Frontend E2E | Playwright | ✅ Active |
| Frontend lint | ESLint 9 | ✅ Active |
| Frontend types | tsc | ✅ Active |

### Required Addition: Vitest

**Before migrating**, add Vitest to the frontend. Shared features in `features/` MUST have unit tests to guarantee that changes don't break consuming apps.

Priority test targets:
1. `features/*/api/` — API call logic
2. `features/*/hooks/` — Business logic hooks
3. `shared/auth/` — Auth state management
4. Route guards — Auth redirect logic

---

## Migration Plan

### Phase 0: Foundation

**Goal**: Add testing infrastructure before structural changes.

- [ ] Add Vitest + React Testing Library to frontend
- [ ] Add `npm test` script
- [ ] Write smoke tests for current critical paths (login, gastos dashboard)

### Phase 1: Base Structure

**Goal**: Create the new folder structure without moving existing code yet.

- [ ] Create `apps/`, `features/`, `shared/` directories
- [ ] Move `services/authService.ts` → `shared/auth/authService.ts`
- [ ] Move `store/authStore.ts` → `shared/auth/authStore.ts`
- [ ] Move `services/api.ts` → `shared/api/apiClient.ts`
- [ ] Update all imports
- [ ] Verify build + tests pass

### Phase 2: Base App Shell

**Goal**: Create the base app with home launcher and SSO guards.

- [ ] Create `apps/baseapp/` with layout, home, admin, profile
- [ ] Implement `RequireAuth` route guard in `shared/auth/`
- [ ] Implement login redirect logic (auth → app home, unauth → app login)
- [ ] Configure React Router with `/baseapp/` as root path
- [ ] Update Vite `base` config if needed

### Phase 3: Migrate Gastos

**Goal**: Move existing expense system under `apps/gastos/` and extract shared features.

- [ ] Move existing pages/routes to `apps/gastos/`
- [ ] Identify shared entities (proveedores, facturas, etc.)
- [ ] Extract shared entities to `features/`
- [ ] Update Gastos to consume from `features/`
- [ ] Add per-feature unit tests
- [ ] Verify E2E tests pass

### Phase 4: First New App (CxP)

**Goal**: Build the first new app reusing shared features — validates the architecture.

- [ ] Create `apps/cxp/` with layout, login, dashboard
- [ ] Implement CxP-specific endpoints in backend (`Features/CxP/`)
- [ ] Reuse `features/proveedores/` for proveedor management
- [ ] Validate SSO: login in Gastos → access CxP without re-login
- [ ] Validate feature reuse: shared types, components work in both apps

### Phase 5+: Iterate

**Goal**: Each new app follows the established pattern.

- Create `apps/{name}/`
- Identify which `features/` to reuse
- Build app-specific pages consuming shared features
- Add new shared features as overlap patterns emerge

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing Gastos during migration | High — production system | Phase 0 (tests) first; migrate incrementally; keep old routes working via redirects during transition |
| localStorage XSS vulnerability | Medium — token theft | Internal app with trusted users; httpOnly cookie migration documented as future hardening |
| Feature extraction ambiguity | Medium — refactoring churn | Extract features only when a second consumer appears (YAGNI); don't pre-extract |
| Multi-tenant context assumption wrong | Medium — redesign needed | Assumption documented; per-app context is a non-breaking extension of global context |
| Bundle size growth with multiple apps | Low — internal app | Code splitting via React.lazy per app route; Vite handles automatically |

---

## Resolved Questions (Investigated from Codebase)

### Q4: SPA Serving Configuration (RESOLVED)

The backend already serves the SPA at root via `Program.cs` (lines 473-542):

```csharp
app.UseDefaultFiles();           // Serves index.html by default
app.UseStaticFiles();            // Serves wwwroot/
app.MapFallbackToFile("/index.html");  // SPA fallback for ALL paths
```

**`MapFallbackToFile("/index.html")` catches ALL unmatched paths**, including `/baseapp/*`. No backend change needed for path-based routing — the SPA loads for any path and React Router handles routing client-side.

**Migration steps** (implementation detail, for the plan):
1. Vite config: `base: '/baseapp/'` (asset URLs)
2. React Router: routes defined under `/baseapp/*` with `basename`
3. Add redirect: `/` → `/baseapp/`
4. Backend: **no changes needed**

### Q5: `front2` Status (RESOLVED)

`front2` is referenced only in a code comment (`HandoffLogin.tsx` line 36) and is **not present in this repository**. It is a separate frontend deployment on a different domain.

**Decision**: This design does NOT affect `front2`. The handoff mechanism (`/api/auth/handoff` + `/api/auth/exchange`) continues to bridge auth between this SPA and `front2` as before. If `front2` is eventually consolidated into this platform, it would migrate following the same `apps/{name}/` pattern.

---

## Open Questions for User Review

1. **Multi-tenant context**: The design assumes global context (one empresa/sucursal/area for all apps). Is this correct, or do you need per-app context?

2. **App priority after CxP**: What is the next app after CxP? This helps validate the feature extraction patterns.

3. **Base app scope**: The design assumes base app = shell + home launcher + admin + profile. Is there other functionality that belongs in the base app?

---

## Out of Scope

- Migrating auth from localStorage to httpOnly cookies (future hardening)
- Per-app multi-tenant context (non-breaking extension for later)
- Micro-frontend architecture (not needed for single-team, single-domain)
- Subdomain-based deployment (handoff mechanism remains available if needed)
- Mobile applications (web-only for now)

---

## References

- Current auth: `lefarma.frontend/src/services/authService.ts`, `lefarma.frontend/src/store/authStore.ts`
- Current API client: `lefarma.frontend/src/services/api.ts`
- Handoff mechanism: `lefarma.frontend/src/pages/auth/HandoffLogin.tsx`, `lefarma.backend/src/Lefarma.API/Features/Auth/AuthController.cs`
- Backend auth service: `lefarma.backend/src/Lefarma.API/Features/Auth/AuthService.cs`
- Current routes: `lefarma.frontend/src/routes/AppRoutes.tsx`
