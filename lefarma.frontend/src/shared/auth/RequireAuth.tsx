import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';
import { PageLoader } from '@/components/ui/page-loader';

export interface RequireAuthProps {
  children: ReactNode;
  loginPath?: string;
}

export function RequireAuth({ children, loginPath = '/login' }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;

  if (!isAuthenticated) {
    const from = location.pathname + location.search;
    return <Navigate to={`${loginPath}?return=${encodeURIComponent(from)}`} replace />;
  }

  return <>{children}</>;
}
