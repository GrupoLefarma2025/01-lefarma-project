import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { viaticosMenuItems } from './menuItems';

import { SolicitudPage } from './pages/solicitud/SolicitudPage';
import { MisViajesPage } from './pages/mis-viajes/MisViajesPage';
import { ConcentradoPage } from './pages/concentrado/ConcentradoPage';
import BandejaAprobacionesConDetalle from './pages/aprobaciones/BandejaAprobacionesConDetalle';
import Perfil from '@/pages/Perfil';

export function ViaticosRoutes({ variant, loginPath }: SubtreeRoutesProps) {
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
        <Route path="mis-viajes" element={<MisViajesPage />} />
        <Route path="concentrado" element={<ConcentradoPage />} />
        <Route path="aprobaciones" element={<BandejaAprobacionesConDetalle />} />
        <Route path="perfil" element={<Perfil />} />
      </>
    ),
  });
}
