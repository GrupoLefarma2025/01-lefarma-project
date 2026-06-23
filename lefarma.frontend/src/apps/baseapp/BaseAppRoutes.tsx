import { Navigate, Outlet, Routes, Route } from 'react-router-dom';
import { RequireAuth } from '@/shared/auth/RequireAuth';
import { useAuthStore } from '@/shared/auth/authStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { shellMenuItems } from './menuItems';
import { Home } from './Home';
import { Profile } from './Profile';
import { CxpRoutes } from '@/apps/cxp/CxpRoutes';
import { RhRoutes } from '@/apps/rh/RhRoutes';
import Login from '@/pages/auth/Login';

/**
 * Route tree for the root base-app shell — the corrected navigation model
 * (app-routing spec: "Root Index Redirect" + "Global Login Route" +
 * "App Subtree Mounting"; base-app spec: "Authenticated Shell Layout" +
 * "Home Launcher").
 *
 * The shell is served from the root basename (`/`), which React Router composes
 * automatically. So `/` matches `/`, `/hub` matches `/hub`, and
 * `cxp/dashboard` (nested under the `cxp` wrapper) matches `/cxp/dashboard`.
 *
 * Navigation model (nav-reorg):
 * - `/` is a REDIRECT — auth→`/hub`, unauth→`/login`. It renders NO home
 *   surface (base-app spec: "Index route is not a home surface").
 * - `/login` is the GLOBAL login — outside `RequireAuth` so unauthenticated
 *   sessions can reach it. It uses the 2-step flow (no context selection) and
 *   redirects to `/hub` on success (app-routing spec: "Global Login Route").
 * - `/hub` + `/perfil` are shell pages rendered inside `MainLayout` with
 *   `shellMenuItems` and no context (`showContext` defaults false). This gives
 *   the shell the same sidebar + header look as the apps.
 * - `cxp/*` mounts the CxP subtree via the reusable `<CxpRoutes>` module
 *   (design Decision 1). The subtree keeps its own auth handling
 *   (ProtectedRoute + CxpSubtreeIndex) and its own MainLayout config.
 *
 * The CxP subtree is invoked via the FUNCTION-CALL pattern
 * `{CxpRoutes({ variant: 'subtree', loginPath: '/cxp/login' })}` because
 * React Router rejects non-`<Route>` component children of `<Routes>` (see
 * CxpRoutes.tsx JSDoc for the full rationale).
 */
export function BaseAppRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Routes>
      {/* Index redirect — never renders a home surface (app-routing spec). */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/hub' : '/login'} replace />}
      />

      {/* Global login — public (outside RequireAuth), 2-step, lands on /hub. */}
      <Route
        path="/login"
        element={<Login requireContextSelection={false} redirectTo="/hub" />}
      />

      {/* Shell layout route — guarded, uses MainLayout with shell sidebar. */}
      <Route
        element={
          <RequireAuth loginPath="/login">
            <MainLayout
              items={shellMenuItems}
              brandTitle="Grupo Lefarma"
              brandPath="/hub"
            />
          </RequireAuth>
        }
      >
        <Route path="/hub" element={<Home />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>

      {/*
        CxP subtree (cxp-app spec: "CxP Subtree Mounting"). The wrapper
        renders an <Outlet/> for the subtree children produced by the reusable
        CxpRoutes module. The subtree owns its auth handling
        (ProtectedRoute for protected routes, CxpSubtreeIndex for the index)
        and its own MainLayout config. Wrapping this subtree in a shell-level
        RequireAuth would be incorrect: it would also guard `/cxp/login`
        (public) and produce a redirect loop, defeating the per-app login.
      */}
      <Route path="cxp" element={<Outlet />}>
        {CxpRoutes({ variant: 'subtree', loginPath: '/cxp/login' })}
      </Route>

      {/*
        RH (Recursos Humanos) subtree — mirrors the CxP subtree mount. The
        wrapper renders an <Outlet/> for the subtree children produced by the
        reusable RhRoutes module. The subtree owns its auth handling
        (ProtectedRoute for protected routes, RhSubtreeIndex for the index) and
        shares the same MainLayout as CxP. RH login uses the 2-step global
        flow (no context-selection step). See CxpRoutes/RhRoutes JSDoc for
        the function-call invocation rationale.
      */}
      <Route path="rh" element={<Outlet />}>
        {RhRoutes({ variant: 'subtree', loginPath: '/rh/login' })}
      </Route>
    </Routes>
  );
}
