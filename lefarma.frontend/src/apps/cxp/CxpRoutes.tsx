import { Navigate, Route, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { LandingRoute, ProtectedRoute, PublicOnlyRoute } from '@/routes/LandingRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthStore } from '@/shared/auth/authStore';
import type { SubtreeRoutesProps } from '@/shared/router/types';

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

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Subtree index resolver: authenticated users land on the Dashboard (auth-only
 * gate, per cxp-app spec "CxP Dashboard Landing"); unauthenticated users
 * are redirected to the subtree login. The root variant does NOT use this — it
 * keeps <LandingRoute/> so the unauthenticated <Hero> landing is preserved.
 */
function CxpSubtreeIndex({ loginPath }: { loginPath: string }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const location = useLocation();

  if (!isInitialized) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="dashboard" replace />;
  // Preserve the intended destination via `?return=` (cxp-app spec:
  // "Unauthenticated index redirects to CxP login" with the destination
  // preserved; app-routing spec: "preserving the return URL").
  const from = location.pathname + location.search;
  return <Navigate to={`${loginPath}?return=${encodeURIComponent(from)}`} replace />;
}

/**
 * Reusable CxP route table — the single source of truth for every CxP URL
 * (cxp-app spec: "CxPRoutes Module Reuse"). Returns a Fragment of
 * <Route> elements intended to be inlined as the children of <Routes> (root
 * mount) or of a <Route path="cxp"> wrapper (shell subtree mount).
 *
 * IMPORTANT — invocation contract:
 * React Router's `createRoutesFromChildren` flattens React.Fragment children
 * but REJECTS non-<Route> component elements (it asserts "is not a <Route>").
 * Therefore this module MUST be invoked as a plain function call that returns
 * the Fragment — `{CxpRoutes({ variant: 'root' })}` — and NOT as JSX
 * `<CxpRoutes/>`. The returned Fragment is transparent to the router.
 *
 * All route paths are RELATIVE (no leading slash). Under the root basename "/"
 * a path like `dashboard` resolves to `/dashboard`. Mounted inside
 * <Route path="cxp"> the same `dashboard` resolves to `/cxp/dashboard`. This
 * is what makes one module serve both mounts (design Decision 1).
 *
 * The `variant` prop gates the ONE behavior that cannot be unified: the index
 * landing. Root keeps <LandingRoute/> (Hero for unauthenticated, redirect to
 * dashboard for authenticated). Subtree redirects authenticated users straight
 * to the Dashboard and unauthenticated users to the subtree login.
 *
 * NOTE: CxP is the ONLY app that uses the 3-step login (empresa/sucursal/area
 * context selection). The default <Login> import keeps
 * `requireContextSelection={true}`, which is why no explicit prop is passed
 * below. RH and other future apps override with
 * `requireContextSelection={false}`.
 */
export function CxpRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  const resolvedLoginPath = loginPath ?? (variant === 'root' ? '/login' : '/cxp/login');

  // Permission-failure destination per variant. Root keeps the default
  // `/bloqueado` (absolute) by passing `undefined` so PermissionGuard applies
  // its own default. Subtree overrides with `/cxp/bloqueado` — an absolute
  // path relative to the router basename, identical in form to
  // `resolvedLoginPath`. Under the root basename it resolves to
  // `/cxp/bloqueado`, matching the `bloqueado` child route declared below
  // (app-routing spec: "Permission checks preserved under subtree mounting").
  const resolvedBlockedPath = variant === 'root' ? undefined : '/cxp/bloqueado';

  // Root preserves the historical guard behavior (no props → defaults):
  //   - LandingRoute auth → '/dashboard'
  //   - ProtectedRoute unauth → '/' (the Hero landing)
  //   - PublicOnlyRoute auth → '/dashboard'
  // Subtree re-points the guards at the subtree login / dashboard.
  const indexElement =
    variant === 'root' ? <LandingRoute /> : <CxpSubtreeIndex loginPath={resolvedLoginPath} />;

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
        {/*
          CxP login — 3-step flow (credentials, password, empresa/sucursal/area).
          CxP is the ONLY app that collects context; the default <Login> import
          keeps requireContextSelection={true}, so no prop override is needed.
        */}
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
        </Route>
      </Route>

      <Route path="ayuda" element={<PublicHelpList />} />
      <Route path="ayuda/:modulo" element={<PublicHelpList />} />
      <Route path="bloqueado" element={<BlockedPage />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}
