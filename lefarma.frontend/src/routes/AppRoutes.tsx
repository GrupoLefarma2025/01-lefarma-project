import { Routes, Route } from 'react-router-dom';
import {
  LandingRoute,
  ProtectedRoute,
  PublicOnlyRoute,
} from './LandingRoute';
import { MainLayout } from '@/components/layout/MainLayout';

import Login from '@/pages/auth/Login';
import Dashboard from '@/pages/Dashboard';
import RolesList from '@/pages/catalogos/Roles/RolesList';
import PermisosList from '@/pages/catalogos/Permisos/PermisosList';
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
          <Route path="/roles" element={<RolesList />} />
          <Route path="/permisos" element={<PermisosList />} />
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
