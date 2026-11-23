import { Database, KeyRound, Monitor, Server, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DESTINOS, type DestinoConfig, type VariableConfiguracion } from '../types';

interface DestinosVariableProps {
  variable: VariableConfiguracion;
  className?: string;
}

const DESTINO_VISUAL: Record<DestinoConfig, { icono: LucideIcon; clase: string }> = {
  backend: {
    icono: Server,
    clase:
      'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  frontend: {
    icono: Monitor,
    clase:
      'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-400',
  },
  sql: {
    icono: Database,
    clase:
      'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-400',
  },
  integraciones: {
    icono: KeyRound,
    clase:
      'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-400',
  },
};

export function DestinosVariable({ variable, className }: DestinosVariableProps) {
  const activos = DESTINOS.filter((destino) => variable[destino.campo]);

  if (activos.length === 0) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {activos.map((destino) => {
        const visual = DESTINO_VISUAL[destino.clave];
        const Icono = visual.icono;
        return (
          <span
            key={destino.clave}
            title={`${destino.etiqueta} · ${destino.descripcion}`}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-md border',
              visual.clase,
            )}
          >
            <Icono className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{destino.etiqueta}</span>
          </span>
        );
      })}
    </div>
  );
}
