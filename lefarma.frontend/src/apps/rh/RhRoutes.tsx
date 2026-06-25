import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { rhMenuItems } from './menuItems';

import { RhDashboard } from './pages/RhDashboard';

/**
 * RH (Recursos Humanos) route table — delega TODO el scaffolding a la fábrica
 * genérica `createAppRoutes`. RH actualmente expone un único dashboard;
 * futuras páginas (empleados, nóminas, vacaciones, etc.) se agregan como
 * <Route> hermanas dentro de la prop `routes`.
 *
 * Contrato de invocación (sin cambios): debe invocarse como función —
 * `{RhRoutes({ variant, loginPath })}` — NO como JSX `<RhRoutes/>`.
 *
 * El login de RH usa el flujo global de 2 pasos (sin paso de
 * empresa/sucursal/area) — el paso 3 es exclusivo de CxP, por lo que RH
 * omite el slot `step3` (el flujo de 2 pasos es el default de la fábrica).
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
