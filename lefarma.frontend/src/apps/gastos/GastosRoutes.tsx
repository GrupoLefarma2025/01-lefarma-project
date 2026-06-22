import { Navigate, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { LandingRoute, ProtectedRoute, PublicOnlyRoute } from '@/routes/LandingRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthStore } from '@/shared/auth/authStore';

import Login from '@/pages/auth/Login';
import HandoffLogin from '@/pages/auth/HandoffLogin';
import SelectEmpresaSucursal from '@/pages/auth/SelectEmpresaSucursal';
import BlockedPage from '@/pages/auth/BlockedPage';
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
import NotFound from '@/pages/NotFound';
import UsuariosList from '@/pages/admin/Usuarios/UsuariosList';

export interface GastosRoutesProps {
  /** Root keeps the <Hero> index landing; subtree redirects the index to login. */
  variant: 'root' | 'subtree';
  /** Subtree login destination. Defaults to '/login' (root) or '/gastos/login' (subtree). */
  loginPath?: string;
}

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Subtree index resolver: authenticated users land on the Dashboard (auth-only
 * gate, per gastos-app spec "Gastos Dashboard Landing"); unauthenticated users
 * are redirected to the subtree login. The root variant does NOT use this — it
 * keeps <LandingRoute/> so the unauthenticated <Hero> landing is preserved.
 */
function GastosSubtreeIndex({ loginPath }: { loginPath: string }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  if (!isInitialized) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="dashboard" replace />;
  return <Navigate to={loginPath} replace />;
}

/**
 * Reusable Gastos route table — the single source of truth for every Gastos URL
 * (gastos-app spec: "GastosRoutes Module Reuse"). Returns a Fragment of
 * <Route> elements intended to be inlined as the children of <Routes> (root
 * mount) or of a <Route path="gastos"> wrapper (shell subtree mount).
 *
 * IMPORTANT — invocation contract:
 * React Router's `createRoutesFromChildren` flattens React.Fragment children
 * but REJECTS non-<Route> component elements (it asserts "is not a <Route>").
 * Therefore this module MUST be invoked as a plain function call that returns
 * the Fragment — `{GastosRoutes({ variant: 'root' })}` — and NOT as JSX
 * `<GastosRoutes/>`. The returned Fragment is transparent to the router.
 *
 * All route paths are RELATIVE (no leading slash). Under basename "/" a path
 * like `dashboard` resolves to `/dashboard` (identical to today's root build).
 * Under basename "/CxP/" mounted inside <Route path="gastos"> the same
 * `dashboard` resolves to `/CxP/gastos/dashboard`. This is what makes one
 * module serve both builds (design Decision 1).
 *
 * The `variant` prop gates the ONE behavior that cannot be unified: the index
 * landing. Root keeps <LandingRoute/> (Hero for unauthenticated, redirect to
 * dashboard for authenticated — byte-identical to today). Subtree redirects
 * authenticated users straight to the Dashboard and unauthenticated users to
 * the subtree login.
 */
export function GastosRoutes({ variant, loginPath }: GastosRoutesProps) {
  const resolvedLoginPath = loginPath ?? (variant === 'root' ? '/login' : '/gastos/login');

  // Root preserves today's byte-identical guard behavior (no props → defaults):
  //   - LandingRoute auth → '/dashboard'
  //   - ProtectedRoute unauth → '/' (the Hero landing)
  //   - PublicOnlyRoute auth → '/dashboard'
  // Subtree re-points the guards at the subtree login / dashboard.
  const indexElement =
    variant === 'root' ? <LandingRoute /> : <GastosSubtreeIndex loginPath={resolvedLoginPath} />;

  const publicOnlyRoute =
    variant === 'root' ? (
      <PublicOnlyRoute />
    ) : (
      <PublicOnlyRoute authenticatedRedirect="dashboard" />
    );

  const protectedRoute =
    variant === 'root' ? <ProtectedRoute /> : <ProtectedRoute unauthRedirect={resolvedLoginPath} />;

  return (
    <>
      <Route index element={indexElement} />

      <Route element={publicOnlyRoute}>
        <Route path="login" element={<Login />} />
      </Route>

      <Route path="handoff-login" element={<HandoffLogin />} />

      <Route element={protectedRoute}>
        <Route path="select-empresa" element={<SelectEmpresaSucursal />} />
        <Route element={<MainLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="seguridad/usuarios" element={<UsuariosList />} />
          <Route path="seguridad/roles" element={<RolesList />} />
          <Route path="seguridad/permisos" element={<PermisosList />} />

          {/* Catalogos */}
          <Route
            path="catalogos/empresas"
            element={
              <PermissionGuard requireAny={['empresas.ver_listado']}>
                <EmpresasList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/areas"
            element={
              <PermissionGuard requireAny={['areas.ver_listado']}>
                <AreasList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/formas-pago"
            element={
              <PermissionGuard requireAny={['formas-pago.ver_listado']}>
                <FormasPagoList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/tipos-impuesto"
            element={
              <PermissionGuard requireAny={['tipos-impuesto.ver_listado']}>
                <TiposImpuestoList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/centros-costo"
            element={
              <PermissionGuard requireAny={['centros-costo.ver_listado']}>
                <CentrosCostoList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/cuentas-contables"
            element={
              <PermissionGuard requireAny={['cuentas-contables.ver_listado']}>
                <CuentasContablesList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/estatus-orden"
            element={
              <PermissionGuard requireAny={['estatus-orden.ver_listado']}>
                <EstatusOrdenList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/proveedores"
            element={
              <PermissionGuard requireAny={['proveedores.ver_listado']}>
                <ProveedoresList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/regimenes-fiscales"
            element={
              <PermissionGuard requireAny={['regimenes-fiscales.ver_listado']}>
                <RegimenesFiscalesList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/sucursales"
            element={
              <PermissionGuard requireAny={['sucursales.ver_listado']}>
                <SucursalesList />
              </PermissionGuard>
            }
          />

          <Route
            path="catalogos/medidas"
            element={
              <PermissionGuard requireAny={['medidas.ver_listado']}>
                <MedidasList />
              </PermissionGuard>
            }
          />
          <Route
            path="catalogos/tipos-gasto"
            element={
              <PermissionGuard requireAny={['tipos-gasto.ver_listado']}>
                <TiposGastoList />
              </PermissionGuard>
            }
          />

          {/* Workflows */}
          <Route
            path="workflows"
            element={
              <PermissionGuard requireAny={['workflows.ver_listado']}>
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
              <PermissionGuard require={['notificaciones.ver_listado']}>
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
        </Route>
      </Route>

      <Route path="ayuda" element={<PublicHelpList />} />
      <Route path="ayuda/:modulo" element={<PublicHelpList />} />
      <Route path="bloqueado" element={<BlockedPage />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}
