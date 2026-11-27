import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LandingRoute } from '@/routes/LandingRoute';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { cxpMenuItems } from './menuItems';

// Rutas con carga diferida: cada página viaja en su propio chunk y solo se
// descarga cuando el usuario entra a ella.
const CxpContextSelection = lazy(() =>
  import('./CxpContextSelection').then((m) => ({ default: m.CxpContextSelection }))
);
const CxpFirmaLegacyCard = lazy(() =>
  import('@/apps/cxp/components/CxpFirmaLegacyCard').then((m) => ({
    default: m.CxpFirmaLegacyCard,
  }))
);
const HandoffLogin = lazy(() => import('@/pages/auth/HandoffLogin'));
const SelectEmpresaSucursal = lazy(() => import('@/pages/auth/SelectEmpresaSucursal'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const RolesList = lazy(() => import('@/pages/admin/Roles/RolesList'));
const PermisosList = lazy(() => import('@/pages/admin/Permisos/PermisosList'));
const EmpresasList = lazy(() => import('@/pages/catalogos/generales/Empresas/EmpresasList'));
const SucursalesList = lazy(() => import('@/pages/catalogos/generales/Sucursales/SucursalesList'));
const MedidasList = lazy(() => import('@/pages/catalogos/generales/Medidas/MedidasList'));
const TiposGastoList = lazy(() => import('@/pages/catalogos/generales/TiposGasto/TiposGastoList'));
const AreasList = lazy(() => import('@/pages/catalogos/generales/Areas/AreasList'));
const FormasPagoList = lazy(() => import('@/pages/catalogos/generales/FormasPago/FormasPagoList'));
const TiposImpuestoList = lazy(() => import('@/pages/catalogos/generales/TiposImpuesto/TiposImpuestoList'));
const CentrosCostoList = lazy(() => import('@/pages/catalogos/generales/CentrosCosto/CentrosCostoList'));
const CuentasContablesList = lazy(() => import('@/pages/catalogos/generales/CuentasContables/CuentasContablesList'));
const EstatusOrdenList = lazy(() => import('@/pages/catalogos/generales/EstatusOrden/EstatusOrdenList'));
const RegimenesFiscalesList = lazy(() => import('@/pages/catalogos/generales/RegimenesFiscales/RegimenesFiscalesList'));
const ProveedoresList = lazy(() => import('@/pages/catalogos/generales/Proveedores/ProveedoresList'));
const ConfiguracionGeneral = lazy(() => import('@/pages/configuracion/ConfiguracionGeneral'));
const WorkflowsList = lazy(() =>
  import('@/pages/workflows').then((m) => ({ default: m.WorkflowsList }))
);
const WorkflowDiagram = lazy(() =>
  import('@/pages/workflows').then((m) => ({ default: m.WorkflowDiagram }))
);
const AutorizacionesOC = lazy(() => import('@/pages/ordenes/AutorizacionesOC'));
const CrearOrdenCompra = lazy(() => import('@/pages/ordenes/CrearOrdenCompra'));
const EnvioConcentrado = lazy(() => import('@/pages/ordenes/EnvioConcentrado'));
const Perfil = lazy(() => import('@/pages/Perfil'));
const PerfilConfig = lazy(() =>
  import('@/pages/configuracion/PerfilConfig').then((m) => ({ default: m.PerfilConfig }))
);
const NotificationsPage = lazy(() => import('@/pages/Notifications'));
const HelpList = lazy(() => import('@/pages/help/HelpList'));
const PublicHelpList = lazy(() => import('@/pages/help/PublicHelpList'));
const HelpView = lazy(() => import('@/pages/help/HelpView'));
const HelpEditor = lazy(() => import('@/pages/help/HelpEditor'));
const UsuariosList = lazy(() => import('@/pages/admin/Usuarios/UsuariosList'));

// Páginas de demostración: solo existen en desarrollo; en el build de
// producción ni siquiera se genera su chunk.
const Roadmap = import.meta.env.DEV ? lazy(() => import('@/pages/Roadmap')) : null;
const DemoComponents = import.meta.env.DEV
  ? lazy(() => import('@/pages/DemoComponents'))
  : null;

export function CxpRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  const resolvedBlockedPath = variant === 'root' ? undefined : '/cxp/bloqueado';

  return createAppRoutes({
    appKey: 'cxp',
    variant,
    loginPath,
    step3: <CxpContextSelection />,
    step3Label: 'Ubicación',
    step3Description: 'Selecciona la ubicación desde la cual generarás órdenes de compra',
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

        {}
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

        {}
        <Route
          path="workflows"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} requireAny={['workflows.ver_listado']}>
              <WorkflowsList />
            </PermissionGuard>
          }
        />
        <Route path="workflows/:id/diagram" element={<WorkflowDiagram />} />

        {}
        <Route path="configuracion" element={<ConfiguracionGeneral firmaCard={<CxpFirmaLegacyCard />} />} />
        <Route path="ordenes/editar/:id" element={<CrearOrdenCompra />} />
        <Route path="ordenes/crear" element={<CrearOrdenCompra />} />
        <Route path="ordenes/autorizaciones" element={<AutorizacionesOC />} />
        <Route path="ordenes/envio-concentrado" element={<EnvioConcentrado />} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="perfil/configuracion" element={<PerfilConfig />} />
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
        {import.meta.env.DEV && Roadmap && DemoComponents && (
          <>
            <Route path="roadmap" element={<Roadmap />} />
            <Route path="demo-components" element={<DemoComponents />} />
          </>
        )}
      </>
    ),
  });
}
