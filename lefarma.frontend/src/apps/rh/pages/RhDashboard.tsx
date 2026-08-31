import { LimitesSolicitudCard } from '../components/LimitesSolicitudCard';
import { MiCalendario } from '../components/MiCalendario';

/**
 * RH app landing page.
 *
 * Punto de entrada del módulo de Recursos Humanos con vista
 * Employee Self-Service: calendario mensual de solicitudes cerradas.
 */
export function RhDashboard() {
  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bienvenido</h1>
        <p className="text-sm text-muted-foreground">
          Aquí tienes un resumen rápido de tus solicitudes.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <MiCalendario />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <LimitesSolicitudCard titulo="Mis límites y saldo" />
        </div>
      </div>
    </div>
  );
}

export default RhDashboard;
