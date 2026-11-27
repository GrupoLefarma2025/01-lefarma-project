import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { viaticosMenuItems } from './menuItems';

// Rutas con carga diferida: cada página viaja en su propio chunk.
const SolicitudPage = lazy(() =>
  import('./pages/solicitud/SolicitudPage').then((m) => ({ default: m.SolicitudPage }))
);
const MisViajesPage = lazy(() =>
  import('./pages/mis-viajes/MisViajesPage').then((m) => ({ default: m.MisViajesPage }))
);
const AutorizacionesPage = lazy(() =>
  import('./pages/autorizaciones/AutorizacionesPage').then((m) => ({ default: m.AutorizacionesPage }))
);
const ConcentradoPage = lazy(() =>
  import('./pages/concentrado/ConcentradoPage').then((m) => ({ default: m.ConcentradoPage }))
);
const ConfiguracionPage = lazy(() =>
  import('./pages/configuracion/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage }))
);
const BandejaAprobacionesConDetalle = lazy(() =>
  import('./pages/aprobaciones/BandejaAprobacionesConDetalle')
);
const Perfil = lazy(() => import('@/pages/Perfil'));

export function ViaticosRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  const bloqueado = variant === 'root' ? undefined : '/viaticos/bloqueado';
  return createAppRoutes({
    appKey: 'viaticos',
    variant,
    loginPath,
    layout: (
      <MainLayout
        items={viaticosMenuItems}
        brandTitle="Grupo Lefarma Viáticos"
        brandPath="/viaticos/dashboard"
      />
    ),
    routes: (
      <>
        {}
        <Route path="dashboard" element={<SolicitudPage />} />
        <Route path="solicitud" element={<SolicitudPage />} />
        <Route path="solicitud/:id" element={<SolicitudPage />} />
        <Route path="mis-viajes" element={<MisViajesPage />} />
        <Route path="autorizaciones" element={
          <PermissionGuard blockedPath={bloqueado} require="viaticos.autorizar">
            <AutorizacionesPage />
          </PermissionGuard>
        } />
        <Route path="concentrado" element={
          <PermissionGuard blockedPath={bloqueado} require="viaticos.autorizar">
            <ConcentradoPage />
          </PermissionGuard>
        } />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="aprobaciones" element={<BandejaAprobacionesConDetalle />} />
        <Route path="perfil" element={<Perfil />} />
      </>
    ),
  });
}
