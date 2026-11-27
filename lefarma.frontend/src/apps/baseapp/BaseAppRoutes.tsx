import { Navigate, Outlet, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { PageLoader } from '@/components/ui/page-loader';
import { RequireAuth } from '@/shared/auth/RequireAuth';
import { useAuthStore } from '@/shared/auth/authStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { InlineLoader } from '@/components/ui/inline-loader';
import { configuracionMenuItems, shellMenuItems } from './menuItems';
import { CxpRoutes } from '@/apps/cxp/CxpRoutes';
import { RhRoutes } from '@/apps/rh/RhRoutes';
import { EducacionMedicaRoutes } from '@/apps/educacion-medica/EducacionMedicaRoutes';
import { ViaticosRoutes } from '@/apps/viaticos/ViaticosRoutes';
import { SigmaRoutes } from '@/apps/sigma/SigmaRoutes';
import BaseAppLogin from './BaseAppLogin';

const Home = lazy(() => import('./Home').then((modulo) => ({ default: modulo.Home })));
const Profile = lazy(() => import('./Profile').then((modulo) => ({ default: modulo.Profile })));
const ConfiguracionVariablesPage = lazy(() =>
  import('./configuracion/pages/ConfiguracionVariablesPage').then((modulo) => ({
    default: modulo.ConfiguracionVariablesPage,
  }))
);
const PerfilConfig = lazy(() =>
  import('@/pages/configuracion/PerfilConfig').then((modulo) => ({
    default: modulo.PerfilConfig,
  }))
);
const TelemetriaPage = lazy(() =>
  import('@/apps/telemetria/TelemetriaPage').then((modulo) => ({
    default: modulo.TelemetriaPage,
  })),
);

export function BaseAppRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
      {}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/hub' : '/login'} replace />}
      />

      {}
      <Route
        path="/login"
        element={<BaseAppLogin />}
      />

      {}
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
        <Route path="/perfil/configuracion" element={<PerfilConfig />} />
      </Route>

      {}
      <Route
        element={
          <RequireAuth loginPath="/login">
            <MainLayout
              items={configuracionMenuItems}
              brandTitle="Grupo Lefarma"
              brandPath="/hub"
            />
          </RequireAuth>
        }
      >
        <Route
          path="/configuracion"
          element={
            <PermissionGuard require="configuracion.view" blockedPath="/hub">
              <ConfiguracionVariablesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="/configuracion/telemetria"
          element={
            <PermissionGuard require="telemetria.ver" blockedPath="/hub">
              <Suspense fallback={<InlineLoader message="Cargando telemetría…" />}>
                <TelemetriaPage />
              </Suspense>
            </PermissionGuard>
          }
        />
      </Route>

      {}
      <Route path="cxp" element={<Outlet />}>
        {CxpRoutes({ variant: 'subtree', loginPath: '/cxp/login' })}
      </Route>

      {}
      <Route path="rh" element={<Outlet />}>
        {RhRoutes({ variant: 'subtree', loginPath: '/rh/login' })}
      </Route>

      {}
      <Route path="educacion-medica" element={<Outlet />}>
        {EducacionMedicaRoutes({ variant: 'subtree', loginPath: '/educacion-medica/login' })}
      </Route>

      {}
      <Route path="viaticos" element={<Outlet />}>
        {ViaticosRoutes({ variant: 'subtree', loginPath: '/viaticos/login' })}
      </Route>

      {}
      <Route path="sigma" element={<Outlet />}>
        {SigmaRoutes({ variant: 'subtree', loginPath: '/login' })}
      </Route>
      </Routes>
    </Suspense>
  );
}
