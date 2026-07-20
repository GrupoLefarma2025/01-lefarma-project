import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { rhMenuItems } from './menuItems';

import { RhDashboard } from './pages/RhDashboard';

import SolicitudesPersonal from './pages/SolicitudesPersonal';
import GestionSolicitudes from './pages/GestionSolicitudes';
import TiposSolicitudList from './pages/TiposSolicitudList';
import IncidenciasChecadoList from './pages/IncidenciasChecadoList';

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
    loginSubtitle: 'Sistema de Gestión de Recursos Humanos',
    layout: (
      <MainLayout items={rhMenuItems} brandTitle="Grupo Lefarma RH" brandPath="/rh/dashboard" />
    ),
    routes: (
      <>
        <Route path="dashboard" element={<RhDashboard />} />

        <Route path="solicitudes" element={<SolicitudesPersonal />} />

        <Route
          path="solicitudes/gestion"
          element={
            <PermissionGuard require="solicitud_personal.puede_ver_todas_solcitudes">
              <GestionSolicitudes />
            </PermissionGuard>
          }
        />

        <Route
          path="catalogos/tipos-solicitud"
          element={
            <PermissionGuard requireAny={['tipos-solicitud.ver_listado']}>
              <TiposSolicitudList />
            </PermissionGuard>
          }
        />

        <Route
          path="incidencias-checado"
          element={
            <PermissionGuard require="incidencias_checado.ver_todas">
              <IncidenciasChecadoList />
            </PermissionGuard>
          }
        />
      </>
    ),
  });
}
