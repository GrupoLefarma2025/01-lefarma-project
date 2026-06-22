import { Navigate, Outlet } from 'react-router-dom';
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
   * preserve the historical root-build behavior — the landing itself presents
   * the login entry. The shell subtree overrides this with its per-app login.
   */
  unauthRedirect?: string;
}

export const ProtectedRoute = ({ unauthRedirect = '/' }: ProtectedRouteProps = {}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (!isInitialized) return <PageLoader />;

  if (!isAuthenticated) {
    return <Navigate to={unauthRedirect} replace />;
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
