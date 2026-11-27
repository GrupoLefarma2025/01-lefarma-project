import { lazy } from 'react';
import { Navigate, Route, useLocation, useParams } from 'react-router-dom';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { educacionMedicaMenuItems } from './menuItems';

// Rutas con carga diferida: cada página viaja en su propio chunk.
const EducacionMedicaDashboard = lazy(() => import('./pages/dashboard/EducacionMedicaDashboard'));
const ColaboradoresPage = lazy(() => import('./pages/personas/PersonasPage'));
const Perfil = lazy(() => import('@/pages/Perfil'));
const HospitalesPage = lazy(() => import('./pages/catalogos/HospitalesPage'));
const ProductosPage = lazy(() => import('./pages/catalogos/ProductosPage'));
const RegionesPage = lazy(() => import('./pages/catalogos/RegionesPage'));
const ParametrosPage = lazy(() => import('./pages/catalogos/ParametrosPage'));
const ConfigRankingPage = lazy(() => import('./pages/catalogos/ConfigRankingPage'));
const ProgramaAnualPage = lazy(() => import('./pages/planificacion/ProgramaAnualPage'));
const SeleccionMensualPage = lazy(() => import('./pages/planificacion/SeleccionMensualPage'));
const CalendarioPage = lazy(() => import('./pages/calendario/CalendarioPage'));
const BandejaAprobacionesPage = lazy(() => import('./pages/taller/BandejaAprobacionesPage'));
const MisAsignacionesPage = lazy(() => import('./pages/taller/MisAsignacionesPage'));
const IndicadoresPage = lazy(() => import('./pages/seguimiento/IndicadoresPage'));
const PanelMesPage = lazy(() => import('./pages/seguimiento/PanelMesPage'));

const PERMISOS = {
  hub: 'baseapp.hub.puede_ver_educacion_medica',
  hospitalesVer: 'educacion_medica.hospitales.puede_ver',
  productosVer: 'educacion_medica.productos.puede_ver',
  configuracion: 'educacion_medica.configuracion.puede_gestionar',
  programasVer: 'educacion_medica.programas.puede_ver',
  seleccionesVer: 'educacion_medica.selecciones.puede_ver',
  talleresVer: 'educacion_medica.talleres.puede_ver',
  talleresCapturar: 'educacion_medica.talleres.puede_capturar',
} as const;

function RedirectPanelRutasLegacy() {
  const { search } = useLocation();
  return <Navigate replace to={`/educacion-medica/panel-rutas${search}`} />;
}

function RedirectRutasLegacy() {
  const { idSeleccion } = useParams();
  return (
    <Navigate
      replace
      to={
        idSeleccion
          ? `/educacion-medica/panel-rutas?idSeleccion=${idSeleccion}&vista=mes`
          : '/educacion-medica/panel-rutas'
      }
    />
  );
}

function RedirectMisTalleres() {
  return <Navigate replace to="/educacion-medica/panel-rutas?vista=semana&filtro=mis" />;
}

function RedirectMatrizLegacy() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('vista', 'matriz');
  return <Navigate replace to={`/educacion-medica/panel-rutas?${params.toString()}`} />;
}

function RedirectEquiposLegacy() {
  return <Navigate replace to="/educacion-medica/colaboradores" />;
}

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
          path="colaboradores"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.configuracion}>
              <ColaboradoresPage />
            </PermissionGuard>
          }
        />
        <Route
          path="personas"
          element={<Navigate replace to="/educacion-medica/colaboradores" />}
        />

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
          element={<Navigate replace to="/educacion-medica/catalogos/hospitales" />}
        />
        <Route
          path="catalogos/regiones"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.configuracion}>
              <RegionesPage />
            </PermissionGuard>
          }
        />
        <Route path="catalogos/equipos-pareo" element={<RedirectEquiposLegacy />} />
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
        <Route path="seleccion/:idSeleccion/rutas" element={<RedirectRutasLegacy />} />
        <Route
          path="panel-rutas"
          element={
            <PermissionGuard blockedPath={resolvedBlockedPath} require={PERMISOS.talleresVer}>
              <CalendarioPage />
            </PermissionGuard>
          }
        />
        <Route path="calendario" element={<RedirectPanelRutasLegacy />} />
        <Route path="talleres" element={<RedirectMatrizLegacy />} />
        <Route path="talleres/mis-talleres" element={<RedirectMisTalleres />} />
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
