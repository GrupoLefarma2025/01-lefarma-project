import { Routes, Route } from 'react-router-dom';
import { LandingRoute, ProtectedRoute, PublicOnlyRoute } from './LandingRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

import Login from '@/pages/auth/Login';
import SelectEmpresaSucursal from '@/pages/auth/SelectEmpresaSucursal';
import BlockedPage from '@/pages/auth/BlockedPage';
import Dashboard from '@/pages/Dashboard';
import RolesList from '@/pages/admin/Roles/RolesList';
import PermisosList from '@/pages/admin/Permisos/PermisosList';
import EmpresasList from '@/pages/catalogos/generales/Empresas/EmpresasList';
import SucursalesList from '@/pages/catalogos/generales/Sucursales/SucursalesList';
import GastosList from '@/pages/catalogos/generales/Gastos/GastosList';
import MedidasList from '@/pages/catalogos/generales/Medidas/MedidasList';

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

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/select-empresa" element={<SelectEmpresaSucursal />} />
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/seguridad/usuarios" element={<PermissionGuard requireAny={['usuarios.ver_detalle', 'usuarios.manage']}><UsuariosList /></PermissionGuard>} />
          <Route
            path="/seguridad/roles"
            element={
              <PermissionGuard require="usuarios.ver_detalle">
                <RolesList />
              </PermissionGuard>
            }
          />
          <Route path="/seguridad/permisos" element={<PermisosList />} />
          <Route path="/catalogos/empresas" element={<EmpresasList />} />
          <Route path="/catalogos/sucursales" element={<SucursalesList />} />
          <Route path="/catalogos/gastos" element={<GastosList />} />
          <Route path="/catalogos/medidas" element={<MedidasList />} />

          <Route path="/catalogos/areas" element={<AreasList />} />
          <Route path="/catalogos/formas-pago" element={<FormasPagoList />} />
          <Route path="/catalogos/tipos-impuesto" element={<TiposImpuestoList />} />
          <Route path="/catalogos/centros-costo" element={<CentrosCostoList />} />
          <Route path="/catalogos/cuentas-contables" element={<CuentasContablesList />} />
          <Route path="/catalogos/estatus-orden" element={<EstatusOrdenList />} />
          <Route path="/catalogos/proveedores" element={<ProveedoresList />} />
          <Route path="/catalogos/regimenes-fiscales" element={<RegimenesFiscalesList />} />
          <Route path="/configuracion" element={<ConfiguracionGeneral />} />
          <Route path="/workflows" element={<WorkflowsList />} />
          <Route path="/workflows/:id/diagram" element={<WorkflowDiagram />} />
          <Route path="/ordenes/editar/:id" element={<CrearOrdenCompra />} />
          <Route path="/ordenes/crear" element={<CrearOrdenCompra />} />
          <Route path="/ordenes/autorizaciones" element={<AutorizacionesOC />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/notificaciones" element={<NotificationsPage />} />
          <Route path="/help" element={<HelpList />} />
          <Route path="/help/new" element={<HelpEditor />} />
          <Route path="/help/edit/:id" element={<HelpEditor />} />
          <Route path="/help/:id" element={<HelpView />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/demo-components" element={<DemoComponents />} />
        </Route>
      </Route>
      <Route path="/ayuda" element={<PublicHelpList />} />
      <Route path="/ayuda/:modulo" element={<PublicHelpList />} />
      <Route path="/bloqueado" element={<BlockedPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
