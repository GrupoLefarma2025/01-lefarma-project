import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Página de aterrizaje de la app Educación Médica (placeholder).
 *
 * El módulo de Educación Médica está scaffolded pero aún no implementado. Esta
 * superficie confirma que el subárbol monta y el ruteo resuelve end-to-end. Se
 * renderiza dentro del <MainLayout/> compartido (aplicado a nivel de ruta en
 * EducacionMedicaRoutes), por lo que hereda el mismo chrome de navegación que
 * CxP y RH.
 *
 * TODO: futuras páginas de Educación Médica (cursos, capacitaciones,
 * certificaciones, instructores, reportes) deben agregarse como hermanas bajo
 * `apps/educacion-medica/pages/` y cablearse en EducacionMedicaRoutes como
 * nuevas entradas <Route> bajo <MainLayout/>.
 */
export function EducacionMedicaDashboard() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Educación Médica</CardTitle>
          <CardDescription>Módulo Educación Médica — en construcción</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Este módulo está en fase de scaffolding. Las funcionalidades de
            educación médica (cursos, capacitaciones, certificaciones y más) se
            integrarán aquí.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
