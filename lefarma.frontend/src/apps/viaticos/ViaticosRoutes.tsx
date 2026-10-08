import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { viaticosMenuItems } from './menuItems';

import { ViaticosPage } from './pages/costos/ViaticosPage';
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
        <Route path="dashboard" element={<ViaticosPage />} />
        <Route path="aprobaciones" element={<BandejaAprobacionesConDetalle />} />
        <Route path="perfil" element={<Perfil />} />
      </>
    ),
  });
}