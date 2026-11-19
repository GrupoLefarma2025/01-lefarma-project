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
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-[900px]:grid-cols-3">
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
            title={tipo.explicacion}
            className={cn(
              'group relative flex flex-col gap-1 rounded-lg border-2 p-2 text-left transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              seleccionado ? tono.seleccionada : tono.tarjeta,
              !seleccionado && 'hover:shadow-sm',
              disabled && 'cursor-default opacity-75',
            )}
          >
            <div className="flex w-full items-center gap-1.5">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                  seleccionado ? tono.iconoSeleccionado : tono.icono,
                )}
              >
                <Icono size={14} isAnimated={!disabled} />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight">
                {tipo.etiqueta}
              </span>
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all',
                  seleccionado
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/25 text-transparent',
                )}
                aria-hidden
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            </div>

            <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {tipo.explicacion}
            </p>

            <div className="mt-auto flex w-full items-center justify-between gap-2 border-t border-current/10 pt-1">
              <p
                className="min-w-0 truncate font-mono text-[10px] text-foreground/65"
                title={tipo.ejemplo}
              >
                <span className="text-muted-foreground">Ej. </span>
                {tipo.ejemplo}
              </p>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0 text-[10px] font-medium',
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
