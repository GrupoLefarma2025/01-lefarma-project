import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, m) => String(m).padStart(2, '0'));

export interface ColumnasTiempoProps {
  hora: string;
  minuto: string;
  onOpcion: (parte: 'hora' | 'minuto', valor: string) => void;
  /**
   * Hora mínima elegible (por ejemplo, la hora actual cuando la fecha es
   * hoy). Deshabilita horas anteriores a `hora` y, cuando la hora elegida es
   * esa misma, los minutos anteriores a `minuto`.
   */
  minimo?: { hora: string; minuto: string } | null;
}

/** Parte 'HH:mm' en hora/minuto; lo inválido o vacío queda sin elegir. */
export function partirHoraMinuto(value: string): { hora: string; minuto: string } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hora: match[1], minuto: match[2] } : { hora: '', minuto: '' };
}

/** Muestra 'HH:mm' de 24h en 12h con AM/PM. Lo inválido se devuelve intacto. */
export function formatoHora12h(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return value;
  const h24 = Number(match[1]);
  const periodo = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${match[2]} ${periodo}`;
}

/**
 * Dos columnas con ajuste por snap (hora 00–23, minutos 00–59) para elegir
 * hora. Al montarse se centran en el valor actual (sin desplazamiento
 * animado: respuesta instantánea y sin mareo). La decisión de qué hacer con
 * la opción (completar, cerrar, etc.) es del padre vía `onOpcion`.
 */
export function ColumnasTiempo({ hora, minuto, onOpcion, minimo }: ColumnasTiempoProps) {
  const columnaHora = useRef<HTMLDivElement>(null);
  const columnaMinutos = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      columnaHora.current?.querySelector('[data-activo="true"]')?.scrollIntoView?.({ block: 'center' });
      columnaMinutos.current?.querySelector('[data-activo="true"]')?.scrollIntoView?.({ block: 'center' });
    });
    return () => cancelAnimationFrame(t);
  }, []);

  function bloqueada(parte: 'hora' | 'minuto', opcion: string): boolean {
    if (!minimo) return false;
    if (parte === 'hora') return opcion < minimo.hora;
    return hora === minimo.hora && opcion < minimo.minuto;
  }

  function columna(opciones: string[], elegido: string, ref: React.RefObject<HTMLDivElement | null>, grupo: string, parte: 'hora' | 'minuto') {
    return (
      <div role="group" aria-label={grupo} className="min-w-0 flex-1">
        <p className="pb-1 text-center text-xs font-medium text-muted-foreground">{grupo}</p>
        <div ref={ref} className="h-44 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md border px-1 py-1">
          <div aria-hidden className="h-[72px] shrink-0" />
          {opciones.map((opcion) => {
            const activo = opcion === elegido;
            const sinSalida = bloqueada(parte, opcion);
            return (
              <button
                key={opcion}
                type="button"
                data-activo={activo}
                disabled={sinSalida}
                onClick={() => onOpcion(parte, opcion)}
                className={cn(
                  'flex w-full snap-center items-center justify-center rounded-md py-1.5 text-sm tabular-nums transition-colors duration-100 active:scale-95',
                  activo
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                  sinSalida && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                )}
              >
                {opcion}
              </button>
            );
          })}
          <div aria-hidden className="h-[72px] shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {columna(HORAS, hora, columnaHora, 'Hora', 'hora')}
      {columna(MINUTOS, minuto, columnaMinutos, 'Minutos', 'minuto')}
    </div>
  );
}
