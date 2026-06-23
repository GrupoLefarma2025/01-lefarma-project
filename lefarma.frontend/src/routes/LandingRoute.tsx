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
   * Dónde aterrizan los usuarios autenticados desde el índice raíz. Por
   * defecto '/dashboard' para preservar el comportamiento histórico del
   * root-build. El subárbol del shell no renderiza <LandingRoute/> (usa su
   * propio resolvedor de índice).
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
   * A dónde se envía a los usuarios no autenticados. Por defecto '/' (el
   * landing Hero) para preservar el comportamiento histórico — el landing
   * mismo presenta la entrada de login. El subárbol del shell sobrescribe
   * esto con su login por-app.
   */
  unauthRedirect?: string;
}

export const ProtectedRoute = ({ unauthRedirect = '/' }: ProtectedRouteProps = {}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;

  if (!isAuthenticated) {
    // Preserva el destino deseado vía `?return=` para que la página de login
    // pueda redirigir de vuelta tras una autenticación exitosa (spec
    // app-routing: Authentication Guard "preserving the return URL"). Refleja
    // el patrón de RequireAuth. Aditivo para el variant root (unauthRedirect
    // por defecto '/'; el landing Hero ignora el query param).
    const from = location.pathname + location.search;
    return <Navigate to={`${unauthRedirect}?return=${encodeURIComponent(from)}`} replace />;
  }

  return <Outlet />;
};

export interface PublicOnlyRouteProps {
  /**
   * A dónde se envía a los usuarios autenticados cuando tocan una ruta
   * solo-pública (ej. la página de login). Por defecto '/dashboard'
   * (comportamiento root). El subárbol del shell sobrescribe esto con un
   * destino relativo al subárbol.
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
