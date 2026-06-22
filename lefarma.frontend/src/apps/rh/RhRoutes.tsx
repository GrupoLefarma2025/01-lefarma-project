import { Navigate, Route, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/LandingRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStore } from '@/shared/auth/authStore';
import type { SubtreeRoutesProps } from '@/shared/router/types';

import Login from '@/pages/auth/Login';
import BlockedPage from '@/pages/auth/BlockedPage';
import NotFound from '@/pages/NotFound';

import { RhDashboard } from './pages/RhDashboard';

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Subtree index resolver: authenticated users land on the RH Dashboard
 * (auth-only gate); unauthenticated users are redirected to the subtree login
 * with the intended destination preserved via `?return=` (mirrors the
 * CxpSubtreeIndex pattern; app-routing spec: "preserving the return URL").
 */
function RhSubtreeIndex({ loginPath }: { loginPath: string }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="dashboard" replace />;
  const from = location.pathname + location.search;
  return <Navigate to={`${loginPath}?return=${encodeURIComponent(from)}`} replace />;
}

/**
 * Reusable RH (Recursos Humanos) route table — mirrors the CxpRoutes module
 * pattern (single source of truth for every RH URL). Returns a Fragment of
 * <Route> elements intended to be inlined as the children of a
 * <Route path="rh"> wrapper (shell subtree mount).
 *
 * IMPORTANT — invocation contract (identical to CxpRoutes):
 * React Router's `createRoutesFromChildren` flattens Fragment children but
 * REJECTS non-<Route> component elements. Therefore this module MUST be
 * invoked as a plain function call that returns the Fragment —
 * `{RhRoutes({ variant: 'subtree', loginPath: '/rh/login' })}` — and NOT as
 * JSX `<RhRoutes/>`. The returned Fragment is transparent to the router.
 *
 * All route paths are RELATIVE (no leading slash). Under the root basename "/"
 * mounted inside <Route path="rh"> the path `dashboard` resolves to
 * `/rh/dashboard`.
 *
 * RH login uses the 2-step global flow (no empresa/sucursal/area step) —
 * step 3 is CxP-only, so <Login> is rendered with
 * `requireContextSelection={false}`.
 */
export function RhRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  const resolvedLoginPath = loginPath ?? (variant === 'root' ? '/login' : '/rh/login');

  // The root variant is not mounted today; a redirect to login is the sensible
  // parity behavior (RH has no Hero landing). The subtree variant uses the
  // auth-aware index resolver.
  const indexElement =
    variant === 'root' ? (
      <Navigate to={resolvedLoginPath} replace />
    ) : (
      <RhSubtreeIndex loginPath={resolvedLoginPath} />
    );

  const publicOnlyRoute =
    variant === 'root' ? (
      <PublicOnlyRoute />
    ) : (
      <PublicOnlyRoute authenticatedRedirect="dashboard" />
    );

  const protectedRoute =
    variant === 'root' ? (
      <ProtectedRoute />
    ) : (
      <ProtectedRoute unauthRedirect={resolvedLoginPath} />
    );

  return (
    <>
      <Route index element={indexElement} />

      <Route element={publicOnlyRoute}>
        {/*
           RH login — 2-step global flow (credentials only). Step 3 (context
           selection) is CxP-only, so requireContextSelection is false.
        */}
        <Route
          path="login"
          element={<Login requireContextSelection={false} redirectTo="dashboard" />}
        />
      </Route>

      <Route element={protectedRoute}>
        <Route element={<MainLayout />}>
          {/*
            TODO: add future RH pages (empleados, nóminas, vacaciones, etc.) as
            sibling <Route> entries here. Wrap permission-gated routes with
            <PermissionGuard blockedPath="/rh/bloqueado" requireAny={[...]}>.
          */}
          <Route path="dashboard" element={<RhDashboard />} />
        </Route>
      </Route>

      {/* blockedPath target for future PermissionGuard usage in RH routes. */}
      <Route path="bloqueado" element={<BlockedPage />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}
