import { Routes, Route } from 'react-router-dom';
import { LandingRoute, ProtectedRoute, PublicOnlyRoute } from './LandingRoute';
import { MainLayout } from '@/components/layout/MainLayout';

import Login from '@/pages/auth/Login';
import Dashboard from '@/pages/Dashboard';
import RolesList from '@/pages/catalogos/seguridad/Roles/RolesList';
import PermisosList from '@/pages/catalogos/seguridad/Permisos/PermisosList';
import EmpresasList from '@/pages/catalogos/generales/Empresas/EmpresasList';
import SucursalesList from '@/pages/catalogos/generales/Sucursales/SucursalesList';
import GastosList from '@/pages/catalogos/generales/Gastos/GastosList';
import MedidasList from '@/pages/catalogos/generales/Medidas/MedidasList';
import AreasList from '@/pages/catalogos/generales/Areas/AreasList';
import ConfiguracionGeneral from '@/pages/configuracion/ConfiguracionGeneral';
import Perfil from '@/pages/Perfil';
import Roadmap from '@/pages/Roadmap';
import DemoComponents from '@/pages/DemoComponents';
import NotFound from '@/pages/NotFound';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/seguridad/roles" element={<RolesList />} />
          <Route path="/seguridad/permisos" element={<PermisosList />} />
          <Route path="/catalogos/empresas" element={<EmpresasList />} />
          <Route path="/catalogos/sucursales" element={<SucursalesList />} />
          <Route path="/catalogos/gastos" element={<GastosList />} />
          <Route path="/catalogos/medidas" element={<MedidasList />} />
          <Route path="/catalogos/areas" element={<AreasList />} />
          <Route path="/configuracion" element={<ConfiguracionGeneral />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/demo-components" element={<DemoComponents />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
