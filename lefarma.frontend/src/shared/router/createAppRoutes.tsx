/* eslint-disable react-refresh/only-export-components */
import { Suspense, type ReactNode, type ReactElement } from 'react';
import { Navigate, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/LandingRoute';
import { useAuthStore } from '@/shared/auth/authStore';
import { authService } from '@/shared/auth/authService';
import { MultiStepLogin } from '@/components/baseapp/MultiStepLogin';
import { PageLoader } from '@/components/ui/page-loader';
import BlockedPage from '@/pages/auth/BlockedPage';
import NotFound from '@/pages/NotFound';

const APP_LOGIN_NAMES: Record<string, string> = {
  cxp: 'Cuentas por Pagar',
  rh: 'Recursos Humanos',
  'educacion-medica': 'Educación Médica',
  viaticos: 'Viáticos',
};

function AppSubtreeIndex({
  loginPath,
  requiresUbicacion,
}: {
  loginPath: string;
  requiresUbicacion?: boolean;
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;
  if (isAuthenticated) {
    if (
      requiresUbicacion &&
      !(authService.getEmpresa() && authService.getSucursal())
    ) {
      return <Navigate to="select-empresa" replace />;
    }
    return <Navigate to="dashboard" replace />;
  }
  const from = location.pathname + location.search;
  return <Navigate to={`${loginPath}?return=${encodeURIComponent(from)}`} replace />;
}

export interface AppRoutesConfig {
  appKey: string;
  variant: 'root' | 'subtree';
  loginPath?: string;
  step3?: ReactNode;
  step3Label?: string;
  step3Description?: string;
  loginSubtitle?: string;
  rootIndexElement?: ReactElement;
  preLayoutRoutes?: ReactNode;
  routes: ReactNode;
  layout: ReactElement;
  extraRoutes?: ReactNode;
}

export function createAppRoutes(config: AppRoutesConfig): ReactNode {
  const {
    appKey,
    variant,
    loginPath,
    step3,
    step3Label,
    step3Description,
    loginSubtitle,
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
      <AppSubtreeIndex loginPath={resolvedLoginPath} requiresUbicacion={appKey === 'cxp'} />
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
          element={
            <MultiStepLogin
              redirectTo="dashboard"
              step3={step3}
              step3Label={step3Label}
              step3Description={step3Description}
              subtitle={loginSubtitle}
              appName={APP_LOGIN_NAMES[appKey]}
            />
          }
        />
      </Route>

      {extraRoutes}

      <Route element={protectedRoute}>
        {preLayoutRoutes}
        <Route
          element={<Suspense fallback={<PageLoader />}>{layout}</Suspense>}
        >
          {routes}
        </Route>
      </Route>

      <Route path="bloqueado" element={<BlockedPage />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}
