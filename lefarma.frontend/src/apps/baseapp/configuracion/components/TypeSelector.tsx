import { Check, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIPOS_DATO_SELECCIONABLES, type TipoDatoConfig } from '../types';
import { ICONOS_TIPO, TONOS_TIPO } from './typeVisuals';

interface TypeSelectorProps {
  value: string;
  onChange: (tipo: TipoDatoConfig) => void;
  disabled?: boolean;
}

export function TypeSelector({ value, onChange, disabled = false }: TypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {TIPOS_DATO_SELECCIONABLES.map((tipo) => {
        const Icono = ICONOS_TIPO[tipo.valor];
        const seleccionado = value === tipo.valor;
        const tono = TONOS_TIPO[tipo.tono];

        return (
          <button
            key={tipo.valor}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tipo.valor)}
            aria-pressed={seleccionado}
            className={cn(
              'group relative flex min-h-[142px] flex-col gap-2 rounded-xl border-2 p-3.5 text-left transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              seleccionado ? tono.seleccionada : tono.tarjeta,
              !seleccionado && 'hover:-translate-y-0.5 hover:shadow-sm',
              disabled && 'cursor-default opacity-75 hover:translate-y-0',
            )}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors',
                  seleccionado ? tono.iconoSeleccionado : tono.icono,
                )}
              >
                <Icono size={22} isAnimated={!disabled} />
              </span>
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border transition-all',
                  seleccionado
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/25 text-transparent',
                )}
                aria-hidden
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold leading-tight">{tipo.etiqueta}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">{tipo.explicacion}</p>
            </div>

            <div className="mt-auto space-y-1.5 border-t border-current/10 pt-2">
              <p className="truncate font-mono text-[10px] text-foreground/65" title={tipo.ejemplo}>
                <span className="text-muted-foreground">Ej. </span>
                {tipo.ejemplo}
              </p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  tono.chip,
                )}
              >
                <List className="h-2.5 w-2.5" aria-hidden />
                {tipo.editor}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
