import { Fragment } from 'react';
import { CheckCircle } from 'lucide-react';

export interface StepIndicatorProps {
  /** Etiquetas de cada paso, en orden. */
  steps: string[];
  /** Paso actual (1-based). */
  current: number;
}

/**
 * Indicador de progreso para flujos multi-paso. Componente puramente
 * presentacional, data-driven via `steps` y `current`.
 *
 * - El paso `current` y los anteriores se resaltan (`bg-primary`).
 * - Los pasos completados (`current > step`) muestran un check.
 * - Los conectores se llenan cuando el paso previo está completo.
 */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="my-4 flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const stepNumber = i + 1;
        const isActive = current >= stepNumber;
        const isComplete = current > stepNumber;
        return (
          <Fragment key={label}>
            <div
              className={`flex items-center gap-2 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {isComplete ? <CheckCircle className="h-4 w-4" /> : stepNumber}
              </div>
              <span className="hidden text-sm font-medium sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 ? (
              <div className={`h-0.5 w-6 ${isComplete ? 'bg-primary' : 'bg-muted'}`} />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
