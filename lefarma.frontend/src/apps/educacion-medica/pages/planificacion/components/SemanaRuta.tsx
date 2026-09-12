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
  dragActivo: DragPayload | null;
  ubicacionPorVisita: (visita: RutaVisita) => string | null;
  onRetornar: (visita: RutaVisita) => void;
  onVerMapa: (fecha: string, visitas: RutaVisita[]) => void;
}

export function SemanaRuta({
  idRuta,
  semana,
  dias,
  maxVisitasDia,
  maxVisitasSemana,
  editable,
  dragActivo,
  ubicacionPorVisita,
  onRetornar,
  onVerMapa,
}: SemanaRutaProps) {
  const total = dias.reduce((acc, d) => acc + d.visitas.length, 0);
  const nivel = nivelCarga(total, maxVisitasSemana);
  const rango = rangoSemanal(dias.map((d) => d.fecha));

  return (
    <section className="space-y-2">
      <div
        className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5"
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
                ? 'text-emerald-700'
                : 'text-muted-foreground'
          )}
        >
          {total}/{maxVisitasSemana} visitas de la semana
          {nivel === 'lleno' && (
            <Badge variant="outline" className="ml-1 border-emerald-300 text-[9px] text-emerald-700">
              Completa
            </Badge>
          )}
          {nivel === 'excedido' && (
            <Badge variant="outline" className="ml-1 border-red-300 text-[9px] text-destructive">
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
            dragActivo={dragActivo}
            ubicacionPorVisita={ubicacionPorVisita}
            onRetornar={onRetornar}
            onVerMapa={onVerMapa}
          />
        ))}
      </div>
    </section>
  );
}
