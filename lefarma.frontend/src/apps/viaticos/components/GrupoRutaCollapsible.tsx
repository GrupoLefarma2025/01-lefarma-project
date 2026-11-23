import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sección de ruta (Ida, Regreso o Destino N) que se puede plegar. Se usa en
 * boletos y en el desglose para que varios destinos no alarguen el panel.
 */
export function GrupoRutaCollapsible({
  etiqueta,
  detalle,
  punto,
  texto,
  count,
  inicialmenteAbierto = false,
  className,
  contenidoClassName,
  children,
}: {
  etiqueta: string;
  detalle?: string | null;
  punto: string;
  texto: string;
  count?: number;
  inicialmenteAbierto?: boolean;
  className?: string;
  contenidoClassName?: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(inicialmenteAbierto);

  return (
    <section className={cn('rounded-xl border border-slate-200/70 bg-card', className)}>
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className={cn('h-2 w-2 shrink-0 rounded-full', punto)} aria-hidden />
        <span className={cn('shrink-0 text-[11px] font-semibold uppercase tracking-wide', texto)}>
          {etiqueta}
        </span>
        {typeof count === 'number' ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">({count})</span>
        ) : null}
        {detalle ? (
          <span
            className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground"
            title={detalle}
          >
            {detalle}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            abierto && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {abierto ? (
        <div className={cn('border-t border-slate-200/70 p-3', contenidoClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export default GrupoRutaCollapsible;
