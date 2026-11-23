import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';
import { PageLoader } from '@/components/ui/page-loader';
import Hero from '@/pages/Hero';

export interface LandingRouteProps {
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
  unauthRedirect?: string;
}

export const ProtectedRoute = ({ unauthRedirect = '/' }: ProtectedRouteProps = {}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;

  if (!isAuthenticated) {
    const from = location.pathname + location.search;
    return <Navigate to={`${unauthRedirect}?return=${encodeURIComponent(from)}`} replace />;
  }

  return <Outlet />;
};

export interface PublicOnlyRouteProps {
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
