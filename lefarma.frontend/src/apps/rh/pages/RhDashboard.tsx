import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * RH app landing page (placeholder).
 *
 * The Recursos Humanos module is scaffolded but not yet implemented. This
 * surface confirms the subtree mounts and routing resolves end-to-end. It is
 * rendered inside the shared <MainLayout/> (applied at the route level in
 * RhRoutes), so it inherits the same nav chrome as CxP.
 *
 * TODO: future RH pages (empleados, nóminas, vacaciones, asistencia, reportes)
 * should be added as siblings under `apps/rh/pages/` and wired into RhRoutes
 * as new <Route> entries under <MainLayout/>.
 */
export function RhDashboard() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Recursos Humanos</CardTitle>
          <CardDescription>Módulo RH — en construcción</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Este módulo está en fase de scaffolding. Las funcionalidades de
            recursos humanos (empleados, nóminas, vacaciones y más) se
            integrarán aquí.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
