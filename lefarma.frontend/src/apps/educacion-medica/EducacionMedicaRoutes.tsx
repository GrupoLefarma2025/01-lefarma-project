import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { educacionMedicaMenuItems } from './menuItems';

import { EducacionMedicaDashboard } from './pages/EducacionMedicaDashboard';
import Perfil from '@/pages/Perfil';
import HospitalesPage from './pages/catalogos/HospitalesPage';
import ProductosPage from './pages/catalogos/ProductosPage';
import TipoGerenciaPage from './pages/catalogos/TipoGerenciaPage';
import RegionesPage from './pages/catalogos/RegionesPage';
import EquiposPareoPage from './pages/catalogos/EquiposPareoPage';
import ParametrosPage from './pages/catalogos/ParametrosPage';
import ConfigRankingPage from './pages/catalogos/ConfigRankingPage';
import ProgramaAnualPage from './pages/planificacion/ProgramaAnualPage';
import SeleccionMensualPage from './pages/planificacion/SeleccionMensualPage';
import RutasPage from './pages/planificacion/RutasPage';
import CalendarioPage from './pages/planificacion/CalendarioPage';
import TallerPage from './pages/taller/TallerPage';
import BandejaAprobacionesPage from './pages/taller/BandejaAprobacionesPage';
import MisAsignacionesPage from './pages/taller/MisAsignacionesPage';
import IndicadoresPage from './pages/seguimiento/IndicadoresPage';
import PanelMesPage from './pages/seguimiento/PanelMesPage';

/**
 * Educación Médica route table — delega TODO el scaffolding a la fábrica
 * genérica `createAppRoutes`. Educación Médica actualmente expone un único
 * dashboard; futuras páginas (cursos, capacitaciones, certificaciones, etc.)
 * se agregan como <Route> hermanas dentro de la prop `routes`.
 *
 * Contrato de invocación (sin cambios): debe invocarse como función —
 * `{EducacionMedicaRoutes({ variant, loginPath })}` — NO como JSX
 * `<EducacionMedicaRoutes/>`.
 *
 * El login de Educación Médica usa el flujo global de 2 pasos (sin paso de
 * empresa/sucursal/area) — el paso 3 es exclusivo de CxP, por lo que
 * Educación Médica omite el slot `step3` (el flujo de 2 pasos es el default
 * de la fábrica).
 */
export function EducacionMedicaRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  return createAppRoutes({
    appKey: 'educacion-medica',
    variant,
    loginPath,
    layout: (
      <MainLayout
        items={educacionMedicaMenuItems}
        brandTitle="Grupo Lefarma Educación Médica"
        brandPath="/educacion-medica/dashboard"
      />
    ),
    routes: (
      <>
        {/*
          TODO: agregar futuras páginas de Educación Médica como <Route>
          hermanas. Envolver rutas con permisos en
          <PermissionGuard blockedPath="/educacion-medica/bloqueado" ...>.
        */}
        <Route path="dashboard" element={<EducacionMedicaDashboard />} />
        <Route path="perfil" element={<Perfil />} />

        {/* wireframe: sin guard de permisos hasta implementar */}
        <Route path="catalogos/hospitales" element={<HospitalesPage />} />
        <Route path="catalogos/productos" element={<ProductosPage />} />
        <Route path="catalogos/tipo-gerencia" element={<TipoGerenciaPage />} />
        <Route path="catalogos/regiones" element={<RegionesPage />} />
        <Route path="catalogos/equipos-pareo" element={<EquiposPareoPage />} />
        <Route path="catalogos/parametros" element={<ParametrosPage />} />
        <Route path="catalogos/config-ranking" element={<ConfigRankingPage />} />
        <Route path="programa-anual" element={<ProgramaAnualPage />} />
        <Route path="seleccion" element={<SeleccionMensualPage />} />
        <Route path="seleccion/:idSeleccion/rutas" element={<RutasPage />} />
        <Route path="calendario" element={<CalendarioPage />} />
        <Route path="talleres" element={<TallerPage />} />
        <Route path="aprobaciones" element={<BandejaAprobacionesPage />} />
        <Route path="mis-asignaciones" element={<MisAsignacionesPage />} />
        <Route path="indicadores" element={<IndicadoresPage />} />
        <Route path="panel-mes" element={<PanelMesPage />} />
      </>
    ),
  });
}
