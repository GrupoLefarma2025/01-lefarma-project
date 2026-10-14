import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasoStepper {
  id: number;
  titulo: string;
}

export interface WizardStepperProps {
  pasos: PasoStepper[];
  /** Id del paso actual. */
  actual: number;
  className?: string;
}

/**
 * Stepper horizontal de puntos conectados: completado (marca), actual
 * (relleno con anillo y `aria-current="step"`) y pendiente (hueco). Usa el
 * primario del tema para mantenerse consistente con el resto de la app.
 */
export function WizardStepper({ pasos, actual, className }: WizardStepperProps) {
  return (
    <ol aria-label="Avance del asistente" className={cn('flex items-start gap-0 overflow-x-auto', className)}>
      {pasos.map((paso, indice) => {
        const completado = paso.id < actual;
        const esActual = paso.id === actual;
        const ultimo = indice === pasos.length - 1;
        return (
          <li
            key={paso.id}
            data-testid={`indicador-paso-${paso.id}`}
            aria-current={esActual ? 'step' : undefined}
            className="flex min-w-20 flex-1 flex-col items-center gap-1"
          >
            <span className="flex w-full items-center" aria-hidden>
              <span className={cn('h-0.5 flex-1', indice === 0 ? 'bg-transparent' : completado || esActual ? 'bg-primary' : 'bg-muted')} />
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                  completado && 'border-primary bg-primary text-primary-foreground',
                  esActual && 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20',
                  !completado && !esActual && 'border-muted bg-background text-muted-foreground',
                )}
              >
                {completado ? <Check className="h-4 w-4" /> : <span className="text-xs font-semibold">{paso.id}</span>}
              </span>
              <span className={cn('h-0.5 flex-1', ultimo ? 'bg-transparent' : completado ? 'bg-primary' : 'bg-muted')} />
            </span>
            <span className={cn('px-1 text-center text-xs leading-tight', esActual ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
              {paso.titulo}
              {completado ? <span className="sr-only"> (completado)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
