import {
  AlignLeft,
  Braces,
  Calendar,
  CalendarClock,
  Clock,
  FileJson,
  Hash,
  List,
  ListFilter,
  Sigma,
  ToggleLeft,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIPOS_DATO, type TipoDatoConfig } from '../types';

const ICONOS: Record<TipoDatoConfig, LucideIcon> = {
  texto_corto: Type,
  texto_largo: AlignLeft,
  entero: Hash,
  decimal: Sigma,
  booleano: ToggleLeft,
  fecha: Calendar,
  hora: Clock,
  fecha_hora: CalendarClock,
  seleccion: ListFilter,
  objeto: Braces,
  lista: List,
  json: FileJson,
};

interface TypeSelectorProps {
  value: string;
  onChange: (tipo: TipoDatoConfig) => void;
  disabled?: boolean;
}

export function TypeSelector({ value, onChange, disabled = false }: TypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {TIPOS_DATO.map((tipo) => {
        const Icono = ICONOS[tipo.valor];
        const seleccionado = value === tipo.valor;

        return (
          <button
            key={tipo.valor}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tipo.valor)}
            aria-pressed={seleccionado}
            className={cn(
              'group flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              seleccionado
                ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                : 'border-border bg-card hover:border-primary/50 hover:bg-muted/40',
              disabled && !seleccionado && 'opacity-40',
              disabled && 'cursor-default',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md border',
                seleccionado
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border bg-muted/60 text-muted-foreground group-hover:text-foreground',
              )}
            >
              <Icono className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium leading-tight">{tipo.etiqueta}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">
              {tipo.descripcion}
            </span>
          </button>
        );
      })}
    </div>
  );
}
