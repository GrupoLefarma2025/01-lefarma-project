import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { viaticosMenuItems } from './menuItems';

import { SolicitudPage } from './pages/solicitud/SolicitudPage';
import { MisViajesPage } from './pages/mis-viajes/MisViajesPage';
import { ConcentradoPage } from './pages/concentrado/ConcentradoPage';
import { ConfiguracionPage } from './pages/configuracion/ConfiguracionPage';
import BandejaAprobacionesConDetalle from './pages/aprobaciones/BandejaAprobacionesConDetalle';
import Perfil from '@/pages/Perfil';

export function ViaticosRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  // El candado real vive en el backend; esto solo evita que la pantalla de
  // autorización se abra por URL a quien no puede autorizar.
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
        {/* Alias temporal: dashboard muestra el mismo asistente que solicitud durante la revisión visual. */}
        <Route path="dashboard" element={<SolicitudPage />} />
        <Route path="solicitud" element={<SolicitudPage />} />
        <Route path="solicitud/:id" element={<SolicitudPage />} />
        <Route path="mis-viajes" element={<MisViajesPage />} />
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
