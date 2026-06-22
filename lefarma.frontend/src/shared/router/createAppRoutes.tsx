/* eslint-disable react-refresh/only-export-components */
import { type ReactNode, type ReactElement } from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/LandingRoute';
import { useAuthStore } from '@/shared/auth/authStore';
import Login from '@/pages/auth/Login';
import BlockedPage from '@/pages/auth/BlockedPage';
import NotFound from '@/pages/NotFound';

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Auth-aware subtree index resolver. Identical logic for every app:
 * authenticated users land on `dashboard`; unauthenticated users are
 * redirected to the subtree login with the intended destination preserved
 * via `?return=` (app-routing spec: "preserving the return URL").
 */
function AppSubtreeIndex({ loginPath }: { loginPath: string }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="dashboard" replace />;
  const from = location.pathname + location.search;
  return <Navigate to={`${loginPath}?return=${encodeURIComponent(from)}`} replace />;
}

/**
 * Configuration for the generic app-route factory. Every app (CxP, RH,
 * future apps) provides its page routes and optional extras; the factory
 * handles ALL scaffolding (index resolver, login wrapper, protected
 * wrapper, MainLayout, bloqueado, NotFound).
 */
export interface AppRoutesConfig {
  /** Stable identifier, e.g. 'cxp' | 'rh'. Derives default paths. */
  appKey: string;
  /** Root keeps an app-specific index; subtree uses the auth-aware resolver. */
  variant: 'root' | 'subtree';
  /** Override the default login path (defaults to `/{appKey}/login`). */
  loginPath?: string;
  /** CxP sets true (3-step login); all other apps default false (2-step). */
  requireContextSelection?: boolean;
  /**
   * Root-variant index element. CxP passes <LandingRoute/> (Hero landing);
   * apps without a landing default to a redirect to the login path.
   */
  rootIndexElement?: ReactElement;
  /**
   * Protected routes OUTSIDE <MainLayout> (inside <ProtectedRoute>).
   * CxP uses this for `select-empresa`.
   */
  preLayoutRoutes?: ReactNode;
  /** Page routes INSIDE <MainLayout> — the bulk of each app's pages. */
  routes: ReactNode;
  /**
   * Layout element wrapping the protected page routes. Each app passes its
   * own configured <MainLayout> with app-specific sidebar items and branding.
   * Must render an <Outlet/> for the child routes.
   */
  layout: ReactElement;
  /**
   * Public routes outside the standard wrappers (e.g. handoff-login,
   * public ayuda). React Router v6+ uses ranking-based matching, so
   * placement between wrappers does not affect route resolution.
   */
  extraRoutes?: ReactNode;
}

/**
 * Generic app-route factory — the single source of truth for the standard
 * subtree scaffold. Replaces the former per-app CxpRoutes/RhRoutes
 * duplication (PageLoader, SubtreeIndex, resolvedLoginPath, variant logic,
 * publicOnlyRoute, protectedRoute — all identical across apps).
 *
 * Each app module calls this factory with its page routes; the factory
 * produces the Fragment of <Route> elements that the shell inlines via
 * the function-call pattern `{createAppRoutes({...})}` (required because
 * React Router's createRoutesFromChildren rejects non-<Route> component
 * children — see the RR7 invariant discovery).
 *
 * All route paths are RELATIVE (no leading slash) so the module serves
 * both root and subtree mounts. Under the root basename `/`, `dashboard`
 * resolves to `/dashboard`; inside <Route path="cxp"> it resolves to
 * `/cxp/dashboard`.
 */
export function createAppRoutes(config: AppRoutesConfig): ReactNode {
  const {
    appKey,
    variant,
    loginPath,
    requireContextSelection = false,
    rootIndexElement,
    preLayoutRoutes,
    routes,
    layout,
    extraRoutes,
  } = config;

  const resolvedLoginPath = loginPath ?? (variant === 'root' ? '/login' : `/${appKey}/login`);

  const indexElement =
    variant === 'root' ? (
      rootIndexElement ?? <Navigate to={resolvedLoginPath} replace />
    ) : (
      <AppSubtreeIndex loginPath={resolvedLoginPath} />
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
        <Route
          path="login"
          element={<Login requireContextSelection={requireContextSelection} redirectTo="dashboard" />}
        />
      </Route>

      {extraRoutes}

      <Route element={protectedRoute}>
        {preLayoutRoutes}
        <Route element={layout}>{routes}</Route>
      </Route>

      <Route path="bloqueado" element={<BlockedPage />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}
