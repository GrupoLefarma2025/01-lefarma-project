import { Route } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { createAppRoutes } from '@/shared/router/createAppRoutes';
import type { SubtreeRoutesProps } from '@/shared/router/types';
import { educacionMedicaMenuItems } from './menuItems';

import { EducacionMedicaDashboard } from './pages/EducacionMedicaDashboard';

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
      </>
    ),
  });
}
