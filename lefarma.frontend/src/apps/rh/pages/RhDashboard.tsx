import { useState } from 'react';
import { LimitesSolicitudCard } from '../components/LimitesSolicitudCard';
import { MiCalendario } from '../components/MiCalendario';
import { MisPendientesCard } from '../components/MisPendientesCard';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/shared/auth/authStore';

/**
 * RH app landing page.
 *
 * Punto de entrada del módulo de Recursos Humanos con vista
 * Employee Self-Service: pendientes accionables + calendario mensual de solicitudes.
 */
export function RhDashboard() {
  usePageTitle('Inicio', 'Tu resumen de Recursos Humanos');

  const { user } = useAuthStore();
  const [limitesRefreshKey, setLimitesRefreshKey] = useState(0);
  const [pendientesRefreshKey, setPendientesRefreshKey] = useState(0);

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Hola{user?.nombre ? `, ${user.nombre}` : ''}
      </h1>

      <MisPendientesCard refreshKey={pendientesRefreshKey} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <MiCalendario
            onSolicitudGuardada={() => {
              setLimitesRefreshKey((k) => k + 1);
              setPendientesRefreshKey((k) => k + 1);
            }}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <LimitesSolicitudCard
            titulo="Mis límites y saldo"
            refreshKey={limitesRefreshKey}
            defaultCollapsed={false}
          />
        </div>
      </div>
    </div>
  );
}

export default RhDashboard;
