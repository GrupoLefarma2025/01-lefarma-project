import { Badge } from '@/components/ui/badge';
import type { ConcentracionEquipo } from '@/apps/educacion-medica/types/educacionMedica.types';

interface MatricesEquipoPanelProps {
  equipos: ConcentracionEquipo[];
}

/** Panel "Matrices por equipo": estado de captura de cada matriz individual de la general. */
export function MatricesEquipoPanel({ equipos }: MatricesEquipoPanelProps) {
  if (equipos.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Aún no hay talleres de ningún equipo en esta matriz.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {equipos.map((equipo) => (
        <div key={equipo.idMatrizIndividual} className="rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {equipo.nombreEjecutivo ?? `EV ${equipo.idEjecutivo ?? '—'}`}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {equipo.nombreEspecialista ?? `EP ${equipo.idEspecialista ?? '—'}`}
              </p>
            </div>
            <Badge variant={equipo.estado === 'Generada' ? 'default' : 'outline'}>
              {equipo.estado}
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{equipo.nombreRegion ?? '—'}</span>
            <span>{equipo.totalTalleres} taller(es)</span>
          </div>
          {equipo.fechaGeneracion && (
            <p className="mt-1 text-xs text-muted-foreground">
              Generada el {new Date(equipo.fechaGeneracion).toLocaleDateString('es-MX')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
