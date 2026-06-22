import { Route } from 'react-router-dom';
import { LandingRoute } from '@/routes/LandingRoute';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { cxpMenuItems } from './menuItems';

import HandoffLogin from '@/pages/auth/HandoffLogin';
import SelectEmpresaSucursal from '@/pages/auth/SelectEmpresaSucursal';
import Dashboard from '@/pages/Dashboard';
import RolesList from '@/pages/admin/Roles/RolesList';
import PermisosList from '@/pages/admin/Permisos/PermisosList';
import EmpresasList from '@/pages/catalogos/generales/Empresas/EmpresasList';
import SucursalesList from '@/pages/catalogos/generales/Sucursales/SucursalesList';

import MedidasList from '@/pages/catalogos/generales/Medidas/MedidasList';
import TiposGastoList from '@/pages/catalogos/generales/TiposGasto/TiposGastoList';

import AreasList from '@/pages/catalogos/generales/Areas/AreasList';
import FormasPagoList from '@/pages/catalogos/generales/FormasPago/FormasPagoList';
import TiposImpuestoList from '@/pages/catalogos/generales/TiposImpuesto/TiposImpuestoList';
import CentrosCostoList from '@/pages/catalogos/generales/CentrosCosto/CentrosCostoList';
import CuentasContablesList from '@/pages/catalogos/generales/CuentasContables/CuentasContablesList';
import EstatusOrdenList from '@/pages/catalogos/generales/EstatusOrden/EstatusOrdenList';
import RegimenesFiscalesList from '@/pages/catalogos/generales/RegimenesFiscales/RegimenesFiscalesList';
import ProveedoresList from '@/pages/catalogos/generales/Proveedores/ProveedoresList';
import ConfiguracionGeneral from '@/pages/configuracion/ConfiguracionGeneral';
import { WorkflowsList, WorkflowDiagram } from '@/pages/workflows';
import AutorizacionesOC from '@/pages/ordenes/AutorizacionesOC';
import CrearOrdenCompra from '@/pages/ordenes/CrearOrdenCompra';
import EnvioConcentrado from '@/pages/ordenes/EnvioConcentrado';
import Perfil from '@/pages/Perfil';
import Roadmap from '@/pages/Roadmap';
import DemoComponents from '@/pages/DemoComponents';
import NotificationsPage from '@/pages/Notifications';
import HelpList from '@/pages/help/HelpList';
import PublicHelpList from '@/pages/help/PublicHelpList';
import HelpView from '@/pages/help/HelpView';
import HelpEditor from '@/pages/help/HelpEditor';
import UsuariosList from '@/pages/admin/Usuarios/UsuariosList';

/**
 * CxP route table — delegates ALL scaffolding (index resolver, login
 * wrapper, protected wrapper, MainLayout, bloqueado, NotFound) to the
 * generic `createAppRoutes` factory. This module only declares the
 * CxP-specific page routes and the extras that don't fit the standard
 * pattern (handoff-login, select-empresa, public ayuda).
 *
 * Invocation contract (unchanged): React Router's createRoutesFromChildren
 * flattens Fragment children but rejects non-<Route> component elements, so
 * this module MUST be invoked as a function call — `{CxpRoutes({ variant,
 * loginPath })}` — NOT as JSX `<CxpRoutes/>`.
 *
 * CxP is the ONLY app that uses the 3-step login (empresa/sucursal/area
 * context selection), so `requireContextSelection` is set to true.
 */
export function CxpRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  const resolvedBlockedPath = variant === 'root' ? undefined : '/cxp/bloqueado';

  return createAppRoutes({
    appKey: 'cxp',
    variant,
    loginPath,
    requireContextSelection: true,
    rootIndexElement: <LandingRoute />,
    layout: (
      <MainLayout
        items={cxpMenuItems}
        brandTitle="Grupo Lefarma CxP"
        brandPath="/cxp/dashboard"
        configPath="/cxp/configuracion"
        showContext
      />
    ),
    extraRoutes: (
      <>
        <Route path="handoff-login" element={<HandoffLogin />} />
        <Route path="ayuda" element={<PublicHelpList />} />
        <Route path="ayuda/:modulo" element={<PublicHelpList />} />
      </>
    ),
    preLayoutRoutes: <Route path="select-empresa" element={<SelectEmpresaSucursal />} />,
    routes: (
      <>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="seguridad/usuarios" element={<UsuariosList />} />
        <Route path="seguridad/roles" element={<RolesList />} />
        <Route path="seguridad/permisos" element={<PermisosList />} />

        {/* Catalogos */}
        <Route
          path="catalogos/empresas"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['empresas.ver_listado']}>
              <EmpresasList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/areas"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['areas.ver_listado']}>
              <AreasList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/formas-pago"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['formas-pago.ver_listado']}>
              <FormasPagoList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/tipos-impuesto"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['tipos-impuesto.ver_listado']}>
              <TiposImpuestoList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/centros-costo"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['centros-costo.ver_listado']}>
              <CentrosCostoList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/cuentas-contables"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['cuentas-contables.ver_listado']}>
              <CuentasContablesList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/estatus-orden"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['estatus-orden.ver_listado']}>
              <EstatusOrdenList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/proveedores"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['proveedores.ver_listado']}>
              <ProveedoresList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/regimenes-fiscales"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['regimenes-fiscales.ver_listado']}>
              <RegimenesFiscalesList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/sucursales"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['sucursales.ver_listado']}>
              <SucursalesList />
            </PermissionGuard>
          }
        />

        <Route
          path="catalogos/medidas"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['medidas.ver_listado']}>
              <MedidasList />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/tipos-gasto"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['tipos-gasto.ver_listado']}>
              <TiposGastoList />
            </PermissionGuard>
          }
        />

        {/* Workflows */}
        <Route
          path="workflows"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['workflows.ver_listado']}>
              <WorkflowsList />
            </PermissionGuard>
          }
        />
        <Route path="workflows/:id/diagram" element={<WorkflowDiagram />} />

        <Route path="configuracion" element={<ConfiguracionGeneral />} />
        <Route path="ordenes/editar/:id" element={<CrearOrdenCompra />} />
        <Route path="ordenes/crear" element={<CrearOrdenCompra />} />
        <Route path="ordenes/autorizaciones" element={<AutorizacionesOC />} />
        <Route path="ordenes/envio-concentrado" element={<EnvioConcentrado />} />
        <Route path="perfil" element={<Perfil />} />
        <Route
          path="notificaciones"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={['notificaciones.ver_listado']}>
              <NotificationsPage />
            </PermissionGuard>
          }
        />
        <Route path="help" element={<HelpList />} />
        <Route path="help/new" element={<HelpEditor />} />
        <Route path="help/edit/:id" element={<HelpEditor />} />
        <Route path="help/:id" element={<HelpView />} />
        <Route path="roadmap" element={<Roadmap />} />
        <Route path="demo-components" element={<DemoComponents />} />
      </>
    ),
  });
}
