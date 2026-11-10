import { useState } from 'react';
import { LimitesSolicitudCard } from '../components/LimitesSolicitudCard';
import { MiCalendario } from '../components/MiCalendario';
import { MisPendientesCard } from '../components/MisPendientesCard';
import { usePageTitle } from '@/hooks/usePageTitle';

/**
 * RH app landing page.
 *
 * Punto de entrada del módulo de Recursos Humanos con vista
 * Employee Self-Service: pendientes accionables + calendario mensual de solicitudes.
 *
 * En escritorio el layout ocupa el alto disponible para que el calendario
 * muestre el mes completo sin recortes ni desplazamiento vertical.
 */
export function RhDashboard() {
  usePageTitle('Inicio', 'Tu resumen de Recursos Humanos');

  const [limitesRefreshKey, setLimitesRefreshKey] = useState(0);
  const [pendientesRefreshKey, setPendientesRefreshKey] = useState(0);

  return (
    <div className="mx-auto flex w-full flex-col gap-6 lg:h-full lg:min-h-0">
      <MisPendientesCard refreshKey={pendientesRefreshKey} />

      <div className="grid min-h-0 grid-cols-1 items-start gap-6 lg:flex-1 lg:grid-cols-5 lg:items-stretch">
        <div className="min-w-0 lg:col-span-3 lg:h-full lg:min-h-0">
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
