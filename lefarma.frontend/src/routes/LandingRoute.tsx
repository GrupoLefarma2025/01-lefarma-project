import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import Hero from '@/pages/Hero';

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

export interface LandingRouteProps {
  /**
   * Where authenticated users land from the root index. Defaults to
   * '/dashboard' to preserve the historical root-build behavior. The shell
   * subtree does not render <LandingRoute/> (it uses its own index resolver).
   */
  authenticatedRedirect?: string;
}

export const LandingRoute = ({ authenticatedRedirect = '/dashboard' }: LandingRouteProps = {}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (!isInitialized) return <PageLoader />;

  if (isAuthenticated) {
    return <Navigate to={authenticatedRedirect} replace />;
  }

  return <Hero />;
};

export interface ProtectedRouteProps {
  /**
   * Where unauthenticated users are sent. Defaults to '/' (the Hero landing) to
   * preserve the historical behavior — the landing itself presents the login
   * entry. The shell subtree overrides this with its per-app login.
   */
  unauthRedirect?: string;
}

export const ProtectedRoute = ({ unauthRedirect = '/' }: ProtectedRouteProps = {}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;

  if (!isAuthenticated) {
    // Preserve the intended destination via `?return=` so the login page can
    // redirect back after a successful authentication (app-routing spec:
    // Authentication Guard "preserving the return URL"). Mirrors the RequireAuth
    // pattern. Additive for the root variant (unauthRedirect defaults to '/';
    // the Hero landing ignores the query param).
    const from = location.pathname + location.search;
    return <Navigate to={`${unauthRedirect}?return=${encodeURIComponent(from)}`} replace />;
  }

  return <Outlet />;
};

export interface PublicOnlyRouteProps {
  /**
   * Where authenticated users are sent when they hit a public-only route (e.g.
   * the login page). Defaults to '/dashboard' (root behavior). The shell
   * subtree overrides this with a subtree-relative destination.
   */
  authenticatedRedirect?: string;
}

export const PublicOnlyRoute = ({
  authenticatedRedirect = '/dashboard',
}: PublicOnlyRouteProps = {}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (!isInitialized) return <PageLoader />;

  if (isAuthenticated) {
    return <Navigate to={authenticatedRedirect} replace />;
  }

  return <Outlet />;
};
