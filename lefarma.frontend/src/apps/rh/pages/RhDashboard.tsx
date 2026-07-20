import { LimitesSolicitudCard } from '../components/LimitesSolicitudCard';
import { MiCalendario } from '../components/MiCalendario';

/**
 * RH app landing page.
 *
 * Punto de entrada del módulo de Recursos Humanos con vista
 * Employee Self-Service: calendario mensual de solicitudes cerradas
 * y resumen de límites del periodo actual.
 */
export function RhDashboard() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bienvenido</h1>
        <p className="text-sm text-muted-foreground">
          Aquí tienes un resumen rápido de tus solicitudes y límites.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MiCalendario />
        </div>
        <div>
          <LimitesSolicitudCard />
        </div>
      </div>
    </div>
  );
}

export default RhDashboard;
