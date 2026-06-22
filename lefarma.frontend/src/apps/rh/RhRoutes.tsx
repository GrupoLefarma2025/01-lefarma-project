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
 * step 3 is CxP-only, so `requireContextSelection` defaults to false.
 */
export function RhRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  return createAppRoutes({
    appKey: 'rh',
    variant,
    loginPath,
    requireContextSelection: false,
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
          TODO: add future RH pages as sibling <Route> entries. Wrap
          permission-gated routes with <PermissionGuard blockedPath="/rh/bloqueado" ...>.
        */}
        <Route path="dashboard" element={<RhDashboard />} />
      </>
    ),
  });
}
