import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ResumenEquipo {
  idEquipo: number;
  nombre: string;
  integrantes: string;
  totalVisitas: number;
  peorSemana: { semana: number; carga: number } | null;
  foraneos: number;
  sinPlanificar: number;
  excede: boolean;
}

interface EquiposPanelProps {
  equipos: ResumenEquipo[];
  seleccionado: number | null;
  onSelect: (idEquipo: number) => void;
  busqueda: string;
  onBusquedaChange: (value: string) => void;
  maxVisitasSemana: number;
  maxViajesForaneos: number;
}

export function EquiposPanel({
  equipos,
  seleccionado,
  onSelect,
  busqueda,
  onBusquedaChange,
  maxVisitasSemana,
  maxViajesForaneos,
}: EquiposPanelProps) {
  const filtrados = equipos.filter(
    (e) =>
      !busqueda.trim() ||
      e.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) ||
      e.integrantes.toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Equipos
        </p>
        <span className="text-xs text-muted-foreground">{equipos.length}</span>
      </div>

      <div className="relative border-b p-2">
        <Search className="absolute left-[18px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar equipo..."
          className="h-8 pl-8 text-sm"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
        />
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-1">
        {filtrados.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">Sin resultados.</p>
        )}
        {filtrados.map((equipo) => {
          const activo = equipo.idEquipo === seleccionado;
          const semanaExcedida =
            equipo.peorSemana !== null && equipo.peorSemana.carga > maxVisitasSemana;
          const foraneosExcedidos = equipo.foraneos > maxViajesForaneos;
          return (
            <button
              key={equipo.idEquipo}
              type="button"
              onClick={() => onSelect(equipo.idEquipo)}
              className={cn(
                'mb-1 w-full rounded-md border-l-2 px-3 py-2 text-left transition-colors',
                activo
                  ? 'border-l-primary bg-primary/5'
                  : 'border-l-transparent hover:bg-muted/60'
              )}
            >
              <span className={cn('block text-sm font-medium', activo && 'text-primary')}>
                {equipo.nombre}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {equipo.integrantes}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{equipo.totalVisitas} visitas</span>
                <span className={cn(semanaExcedida && 'font-semibold text-destructive')}>
                  Semana{' '}
                  {equipo.peorSemana
                    ? `${equipo.peorSemana.carga}/${maxVisitasSemana}`
                    : `0/${maxVisitasSemana}`}
                  {semanaExcedida && ' ⚠'}
                </span>
                <span className={cn(foraneosExcedidos && 'font-semibold text-destructive')}>
                  Foráneos {equipo.foraneos}/{maxViajesForaneos}
                  {foraneosExcedidos && ' ⚠'}
                </span>
              </span>
              {equipo.excede && !semanaExcedida && !foraneosExcedidos && (
                <span className="mt-0.5 block text-xs text-amber-600">Con ajustes pendientes</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
