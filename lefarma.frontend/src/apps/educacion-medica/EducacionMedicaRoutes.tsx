import { Route } from 'react-router-dom';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
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
import MatrizTalleresPage from './pages/taller/MatrizTalleresPage';
import MisTalleresPage from './pages/taller/MisTalleresPage';
import BandejaAprobacionesPage from './pages/taller/BandejaAprobacionesPage';
import MisAsignacionesPage from './pages/taller/MisAsignacionesPage';
import IndicadoresPage from './pages/seguimiento/IndicadoresPage';
import PanelMesPage from './pages/seguimiento/PanelMesPage';

/**
 * Códigos de permiso del módulo (espejo de `Permissions.EducacionMedica` en el backend
 * y de `Asokam.app.Permisos`; ver ADR-00009).
 */
const PERMISOS = {
  hub: 'baseapp.hub.puede_ver_educacion_medica',
  hospitalesVer: 'educacion_medica.hospitales.puede_ver',
  productosVer: 'educacion_medica.productos.puede_ver',
  configuracion: 'educacion_medica.configuracion.puede_gestionar',
  programasVer: 'educacion_medica.programas.puede_ver',
  seleccionesVer: 'educacion_medica.selecciones.puede_ver',
  rutasVer: 'educacion_medica.rutas.puede_ver',
  talleresVer: 'educacion_medica.talleres.puede_ver',
  talleresCapturar: 'educacion_medica.talleres.puede_capturar',
} as const;

/**
 * Educación Médica route table — delega TODO el scaffolding a la fábrica
 * genérica `createAppRoutes`.
 *
 * Contrato de invocación (sin cambios): debe invocarse como función —
 * `{EducacionMedicaRoutes({ variant, loginPath })}` — NO como JSX
 * `<EducacionMedicaRoutes/>`.
 *
 * Cada página va envuelta en `PermissionGuard` con `blockedPath` de subárbol
 * (`/educacion-medica/bloqueado`, creado por la fábrica). El candado real vive
 * en el backend (`[HasPermission]` por controlador); el guard es UX.
 */
export function EducacionMedicaRoutes({ variant, loginPath }: SubtreeRoutesProps) {
  const resolvedBlockedPath = variant === 'root' ? undefined : '/educacion-medica/bloqueado';

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
        <Route
          path="dashboard"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.hub}>
              <EducacionMedicaDashboard />
            </PermissionGuard>
          }
        />
        <Route path="perfil" element={<Perfil />} />

        <Route
          path="catalogos/hospitales"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.hospitalesVer}>
              <HospitalesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/productos"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.productosVer}>
              <ProductosPage />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/tipo-gerencia"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.configuracion}>
              <TipoGerenciaPage />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/regiones"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.configuracion}>
              <RegionesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/equipos-pareo"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.configuracion}>
              <EquiposPareoPage />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/parametros"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.configuracion}>
              <ParametrosPage />
            </PermissionGuard>
          }
        />
        <Route
          path="catalogos/config-ranking"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.configuracion}>
              <ConfigRankingPage />
            </PermissionGuard>
          }
        />
        <Route
          path="programa-anual"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.programasVer}>
              <ProgramaAnualPage />
            </PermissionGuard>
          }
        />
        <Route
          path="seleccion"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.seleccionesVer}>
              <SeleccionMensualPage />
            </PermissionGuard>
          }
        />
        <Route
          path="seleccion/:idSeleccion/rutas"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.rutasVer}>
              <RutasPage />
            </PermissionGuard>
          }
        />
        <Route
          path="calendario"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.talleresVer}>
              <CalendarioPage />
            </PermissionGuard>
          }
        />
        <Route
          path="talleres"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.talleresVer}>
              <MatrizTalleresPage />
            </PermissionGuard>
          }
        />
        <Route
          path="talleres/mis-talleres"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.talleresCapturar}>
              <MisTalleresPage />
            </PermissionGuard>
          }
        />
        <Route
          path="aprobaciones"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.hub}>
              <BandejaAprobacionesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="mis-asignaciones"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.talleresCapturar}>
              <MisAsignacionesPage />
            </PermissionGuard>
          }
        />
        <Route
          path="indicadores"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.talleresVer}>
              <IndicadoresPage />
            </PermissionGuard>
          }
        />
        <Route
          path="panel-mes"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.talleresVer}>
              <PanelMesPage />
            </PermissionGuard>
          }
        />
      </>
    ),
  });
}
