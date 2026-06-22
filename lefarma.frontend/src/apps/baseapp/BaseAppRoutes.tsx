import { Navigate, Outlet, Routes, Route } from 'react-router-dom';
import { RequireAuth } from '@/shared/auth/RequireAuth';
import { useAuthStore } from '@/shared/auth/authStore';
import { ShellLayout } from './ShellLayout';
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
 * - `/hub` is the shell home — the `Home` launcher inside `RequireAuth` +
 *   `ShellLayout`. This is the default landing for authenticated users
 *   arriving from the global login or the `/` redirect.
 * - `/perfil` is the shell Profile — guarded + shell-wrapped, unchanged from
 *   the foundation aside from the `loginPath` now pointing at the global login.
 * - `cxp/*` mounts the CxP subtree via the reusable `<CxpRoutes>` module
 *   (design Decision 1). The subtree keeps its own auth handling
 *   (ProtectedRoute + CxpSubtreeIndex) and its own MainLayout; it does NOT
 *   reuse ShellLayout (cxp-app spec: "CxP Subtree Mounting").
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

      {/* Shell home launcher. */}
      <Route
        path="/hub"
        element={
          <RequireAuth loginPath="/login">
            <ShellLayout>
              <Home />
            </ShellLayout>
          </RequireAuth>
        }
      />

      {/* Shell profile — guarded, shell-wrapped (unchanged surface). */}
      <Route
        path="/perfil"
        element={
          <RequireAuth loginPath="/login">
            <ShellLayout>
              <Profile />
            </ShellLayout>
          </RequireAuth>
        }
      />

      {/*
        CxP subtree (cxp-app spec: "CxP Subtree Mounting"). The wrapper
        renders an <Outlet/> for the subtree children produced by the reusable
        CxpRoutes module. The subtree owns its auth handling
        (ProtectedRoute for protected routes, CxpSubtreeIndex for the index)
        and its own MainLayout — ShellLayout is intentionally NOT applied here.
        Wrapping this subtree in a shell-level RequireAuth would be incorrect:
        it would also guard `/cxp/login` (public) and produce a redirect
        loop, defeating the per-app login.
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
