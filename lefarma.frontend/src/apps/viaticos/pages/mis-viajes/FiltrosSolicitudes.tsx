import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ETIQUETA_PERIODO, TIPOS_VIAJE, type FiltroPeriodo, type TipoViaje } from './viajes.helpers';

export interface FiltrosSolicitudesProps {
  periodo: FiltroPeriodo;
  onPeriodo: (periodo: FiltroPeriodo) => void;
  tipo: TipoViaje | 'todos';
  onTipo: (tipo: TipoViaje | 'todos') => void;
  desde: string;
  onDesde: (desde: string) => void;
  hasta: string;
  onHasta: (hasta: string) => void;
  rango: { inicio: string; fin: string } | null;
  filtrosAplicados: number;
  idPrefijo?: string;
  descripcionRango?: string;
}

export function FiltrosSolicitudes({
  periodo,
  onPeriodo,
  tipo,
  onTipo,
  desde,
  onDesde,
  hasta,
  onHasta,
  rango,
  filtrosAplicados,
  idPrefijo = '',
  descripcionRango = 'Mostrando por fecha de creación (provisional)',
}: FiltrosSolicitudesProps) {
  const id = (sufijo: string) => `${idPrefijo}${sufijo}`;

  return (
    <div className="rounded-md border bg-card">
      <details className="group">
        <summary className="flex cursor-pointer select-none items-center gap-2 rounded-md px-4 py-3 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          Filtros
          {filtrosAplicados > 0 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {filtrosAplicados} {filtrosAplicados === 1 ? 'aplicado' : 'aplicados'}
            </span>
          ) : null}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-3 border-t px-4 py-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor={id('filtro-periodo')}>Periodo</Label>
            <select id={id('filtro-periodo')} aria-label="Periodo" className="h-10 w-full rounded-md border bg-background px-3" value={periodo} onChange={(e) => onPeriodo(e.target.value as FiltroPeriodo)}>
              {(Object.keys(ETIQUETA_PERIODO) as FiltroPeriodo[]).map((p) => (
                <option key={p} value={p}>{ETIQUETA_PERIODO[p]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={id('filtro-tipo')}>Tipo de viaje</Label>
            <select id={id('filtro-tipo')} aria-label="Tipo de viaje" className="h-10 w-full rounded-md border bg-background px-3" value={tipo} onChange={(e) => onTipo(e.target.value as TipoViaje | 'todos')}>
              {TIPOS_VIAJE.map((t) => (
                <option key={t.id} value={t.id}>{t.etiqueta}</option>
              ))}
            </select>
          </div>
          {periodo === 'personalizado' ? (
            <>
              <div className="space-y-1">
                <Label htmlFor={id('filtro-desde')}>Desde</Label>
                <Input id={id('filtro-desde')} type="date" value={desde} onChange={(e) => onDesde(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={id('filtro-hasta')}>Hasta</Label>
                <Input id={id('filtro-hasta')} type="date" value={hasta} onChange={(e) => onHasta(e.target.value)} />
              </div>
            </>
          ) : null}
        </div>
      </details>
      {rango ? (
        <div className="space-y-1 px-4 pb-3">
          <p data-testid="rango-visible" className="text-xs text-muted-foreground">
            {descripcionRango}: {rango.inicio} al {rango.fin}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
