import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { rhMenuItems } from './menuItems';

import { RhDashboard } from './pages/RhDashboard';

/**
 * RH (Recursos Humanos) route table — delegates ALL scaffolding to the
 * generic `createAppRoutes` factory. RH currently ships a single dashboard
 * page; future RH pages (empleados, nóminas, vacaciones, etc.) are added as
 * sibling <Route> entries inside the `routes` prop.
 *
 * Invocation contract (unchanged): must be called as a function —
 * `{RhRoutes({ variant, loginPath })}` — NOT as JSX `<RhRoutes/>`.
 *
 * RH login uses the 2-step global flow (no empresa/sucursal/area step) —
 * step 3 is CxP-only, so RH omits the `step3` slot (2-step flow is the
 * factory default).
 */
export function RhRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  return createAppRoutes({
    appKey: 'rh',
    variant,
    loginPath,
    layout: (
      <MainLayout
        items={rhMenuItems}
        brandTitle="Grupo Lefarma RH"
        brandPath="/rh/dashboard"
      />
    ),
    routes: (
      <>
        {/*
          TODO: agregar futuras páginas de RH como <Route> hermanas. Envolver
          rutas con permisos en <PermissionGuard blockedPath="/rh/bloqueado" ...>.
        */}
        <Route path="dashboard" element={<RhDashboard />} />
      </>
    ),
  });
}
