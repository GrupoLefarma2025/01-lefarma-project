import type { DragEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Clock3,
  LockKeyhole,
  MapPin,
  Presentation,
  UserRound,
} from 'lucide-react';
import type { CalendarioItem } from '../../../types/educacionMedica.types';
import { esFinDeSemana, estiloEvento, fmtHora, tonoEvento } from '../calendarioUtils';
import { TextoExpandible } from './TextoExpandible';

interface CalendarioEventoProps {
  item: CalendarioItem;
  variante?: 'semana' | 'mes' | 'matriz' | 'dia';
  activo?: boolean;
  onClick: (item: CalendarioItem) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>, item: CalendarioItem) => void;
}

export function CalendarioEvento({
  item,
  variante = 'semana',
  activo = false,
  onClick,
  onDragStart,
}: CalendarioEventoProps) {
  const tono = tonoEvento(item);
  const estilo = estiloEvento[tono];
  const hora = fmtHora(item.hora);
  const esMes = variante === 'mes';
  const esMatriz = variante === 'matriz';
  const compacto = esMes || esMatriz;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={Boolean(onDragStart)}
      onDragStart={(event) => onDragStart?.(event, item)}
      onClick={(event) => {
        event.stopPropagation();
        onClick(item);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick(item);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className={[
        'group relative w-full overflow-hidden rounded-xl border text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        estilo.card,
        activo ? 'shadow-sm ring-2 ring-slate-900/15 dark:ring-white/25' : '',
        compacto ? 'px-2 py-1.5' : 'px-2.5 py-2',
        onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      ].join(' ')}
      title={`${item.hospital ?? 'Hospital'} · ${item.gerencia}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${estilo.barra} ${
          esFinDeSemana(item.fecha) ? 'opacity-60' : ''
        }`}
      />

      <span className="flex items-start justify-between gap-2 pl-1">
        <span className="min-w-0">
          <TextoExpandible
            text={item.hospital}
            fallback="Hospital sin nombre"
            className={`font-semibold tracking-tight ${compacto ? 'text-[11px]' : 'text-[12px]'}`}
            triggerClassName="w-full"
          />
          {!esMes && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] opacity-65">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{item.region ?? item.gerencia}</span>
            </span>
          )}
        </span>

        {hora && !esMes && (
          <span className="shrink-0 rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {hora}
          </span>
        )}
      </span>

      {!esMes && (
        <span className="mt-1 flex items-center gap-1.5 pl-1">
          {item.idTaller ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/55 px-1.5 py-0.5 text-[9px] font-medium dark:bg-white/10">
              <Presentation className="h-2.5 w-2.5" />
              Taller
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/55 px-1.5 py-0.5 text-[9px] font-medium dark:bg-white/10">
              <Clock3 className="h-2.5 w-2.5" />
              Visita
            </span>
          )}
          {item.nombreEspecialista && !esMatriz && (
            <span className="inline-flex min-w-0 items-center gap-1 truncate text-[9px] opacity-65">
              <UserRound className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{item.nombreEspecialista}</span>
            </span>
          )}
          {item.conflictos.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] font-semibold text-rose-600 dark:text-rose-300">
              <AlertTriangle className="h-2.5 w-2.5" />
              {item.conflictos.length}
            </span>
          )}
          {item.bloqueado && (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
              <LockKeyhole className="h-2.5 w-2.5" />
            </span>
          )}
          {item.esExtraordinario && (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-300">
              <ArrowLeftRight className="h-2.5 w-2.5" />
              Extra
            </span>
          )}
        </span>
      )}

      {esMes && (
        <span className="mt-0.5 flex items-center gap-1 pl-1 text-[9px] opacity-65">
          {item.idTaller ? (
            <Presentation className="h-2.5 w-2.5" />
          ) : (
            <Building2 className="h-2.5 w-2.5" />
          )}
          <span className="truncate">{hora ?? item.gerencia}</span>
        </span>
      )}
    </div>
  );
}
