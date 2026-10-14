import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RutaVisita } from '@/apps/educacion-medica/types/educacionMedica.types';
import { nivelCarga, rangoSemanal, type DragPayload } from '../rutasUtils';
import { DiaRuta } from './DiaRuta';

interface SemanaRutaProps {
  idRuta: number;
  semana: number;
  dias: { fecha: string; visitas: RutaVisita[] }[];
  maxVisitasDia: number;
  maxVisitasSemana: number;
  editable: boolean;
  modoAjuste?: boolean;
  dragActivo: DragPayload | null;
  ubicacionPorVisita: (visita: RutaVisita) => string | null;
  onRetornar: (visita: RutaVisita) => void;
  onVerMapa: (fecha: string, visitas: RutaVisita[]) => void;
  onEditarHoras?: (visita: RutaVisita) => void;
}

export function SemanaRuta({
  idRuta,
  semana,
  dias,
  maxVisitasDia,
  maxVisitasSemana,
  editable,
  modoAjuste,
  dragActivo,
  ubicacionPorVisita,
  onRetornar,
  onVerMapa,
  onEditarHoras,
}: SemanaRutaProps) {
  const total = dias.reduce((acc, d) => acc + d.visitas.length, 0);
  const nivel = nivelCarga(total, maxVisitasSemana);
  const rango = rangoSemanal(dias.map((d) => d.fecha));

  return (
    <section className="space-y-2">
      <div
        className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-200 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
        title={`Semana ISO ${semana} (${rango}). Muestra las visitas calendarizadas de este equipo en esa semana contra el máximo de ${maxVisitasSemana} visitas/semana.`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide">
          Semana {semana}
          {rango && <span className="ml-2 font-normal normal-case text-muted-foreground">{rango}</span>}
        </p>
        <div
          className={cn(
            'flex items-center gap-1 text-xs tabular-nums font-medium',
            nivel === 'excedido'
              ? 'text-destructive font-semibold'
              : nivel === 'lleno'
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-muted-foreground'
          )}
        >
          {total}/{maxVisitasSemana} visitas de la semana
          {nivel === 'lleno' && (
            <Badge
              variant="outline"
              className="ml-1 border-emerald-300 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
            >
              Completa
            </Badge>
          )}
          {nivel === 'excedido' && (
            <Badge
              variant="outline"
              className="ml-1 border-red-300 text-[10px] font-medium text-destructive dark:border-red-900"
            >
              Excedida
            </Badge>
          )}
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {dias.map((dia) => (
          <DiaRuta
            key={dia.fecha}
            idRuta={idRuta}
            fecha={dia.fecha}
            visitas={dia.visitas}
            maxVisitasDia={maxVisitasDia}
            editable={editable}
            modoAjuste={modoAjuste}
            dragActivo={dragActivo}
            ubicacionPorVisita={ubicacionPorVisita}
            onRetornar={onRetornar}
            onVerMapa={onVerMapa}
            onEditarHoras={onEditarHoras}
          />
        ))}
      </div>
    </section>
  );
}
