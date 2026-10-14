import { AlertTriangle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
        <Badge variant="outline" className="h-5 px-1.5 text-[11px] text-muted-foreground">
          {equipos.length}
        </Badge>
      </div>

      <div className="relative border-b p-2">
        <Search className="absolute left-[18px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Buscar equipo por nombre o integrantes"
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
              aria-current={activo ? 'true' : undefined}
              className={cn(
                'mb-1 w-full rounded-md border-l-2 px-3 py-2 text-left transition-colors',
                activo
                  ? 'border-l-primary bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-900'
                  : 'border-l-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
              )}
            >
              <span className={cn('block text-sm font-medium', activo && 'text-primary')}>
                {equipo.nombre}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {equipo.integrantes}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                <span className="tabular-nums">{equipo.totalVisitas} visitas</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    semanaExcedida && 'font-semibold text-destructive'
                  )}
                >
                  Semana pico{' '}
                  {equipo.peorSemana
                    ? `${equipo.peorSemana.carga}/${maxVisitasSemana}`
                    : `0/${maxVisitasSemana}`}
                  {semanaExcedida && (
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    foraneosExcedidos && 'font-semibold text-destructive'
                  )}
                >
                  Foráneos {equipo.foraneos}/{maxViajesForaneos}
                  {foraneosExcedidos && (
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
              </span>
              {equipo.excede && !semanaExcedida && !foraneosExcedidos && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Con ajustes pendientes
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
