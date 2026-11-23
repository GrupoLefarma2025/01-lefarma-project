import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasoStepper {
  id: number;
  titulo: string;
}

export interface WizardStepperProps {
  pasos: PasoStepper[];
  actual: number;
  className?: string;
  alcanzado?: number;
  onSelect?: (id: number) => void;
}

const WIZARD_CSS = `
.wizard-rail-pulse {
  background-image: radial-gradient(circle, var(--primary) 1.5px, transparent 1.6px);
  background-size: 9px 100%;
  background-repeat: repeat-x;
  background-position: left center;
  animation: wizard-rail-fill-loop 2s ease-in-out infinite;
}
@keyframes wizard-rail-fill-loop {
  0% { width: 0%; opacity: 0; }
  10% { opacity: 1; }
  80% { width: 100%; opacity: 1; }
  100% { width: 100%; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .wizard-rail-fill, .wizard-rail-pulse { animation: none !important; transition: none !important; }
}
`;

export function WizardStepper({ pasos, actual, alcanzado: alcanzadoProp, className, onSelect }: WizardStepperProps) {
  const total = pasos.length;
  const alcanzado = alcanzadoProp ?? actual;
  const avance = total <= 1 ? 1 : Math.min(1, Math.max(0, (alcanzado - 1) / (total - 1)));
  const segDesde = total <= 1 ? '0%' : `${Math.round(((actual - 1) / (total - 1)) * 1000) / 10}%`;
  const segAncho = total <= 1 ? '100%' : `${Math.round((1 / (total - 1)) * 1000) / 10}%`;

  return (
    <>
      <style>{WIZARD_CSS}</style>
      <div className={cn('relative', className)}>
        {}
        <div
          data-testid="wizard-rail"
          aria-hidden
          className="absolute left-[calc(100%/14)] right-[calc(100%/14)] top-[14px] h-[3px] overflow-hidden rounded-full bg-border"
        >
          <div
            data-testid="wizard-rail-fill"
            className="wizard-rail-fill absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${avance})` }}
          />
          {actual < total ? (
            <div
              aria-hidden
              className="absolute inset-y-0"
              style={{ left: segDesde, width: segAncho }}
            >
              <div
                data-testid="wizard-rail-pulse"
                className="wizard-rail-pulse h-full w-full rounded-full"
              />
            </div>
          ) : null}
        </div>

        <ol
          aria-label="Avance del asistente"
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {pasos.map((paso, indice) => {
            const esActual = indice === actual - 1;
            const esPausa = !esActual && paso.id === alcanzado && alcanzado > actual;
            const hecho = !esActual && !esPausa && indice < alcanzado;
            const puedeIr = (hecho || esPausa) && onSelect !== undefined;
            const etiqueta = indice < actual - 1
              ? `Volver al paso ${paso.id}: ${paso.titulo}`
              : `Ir al paso ${paso.id}: ${paso.titulo}`;
            const punto = (
              <span
                className={cn(
                  'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background',
                  hecho && 'border-primary bg-primary text-primary-foreground',
                  esActual && 'border-primary bg-background text-primary ring-4 ring-primary/20',
                  esPausa && 'border-dashed border-primary bg-background text-primary',
                  !hecho && !esActual && !esPausa && 'border-muted text-muted-foreground',
                )}
              >
                {hecho ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-semibold">{paso.id}</span>
                )}
              </span>
            );
            return (
              <li
                key={paso.id}
                data-testid={`indicador-paso-${paso.id}`}
                aria-current={esActual ? 'step' : undefined}
                className="flex min-w-0 flex-col items-center gap-2"
              >
                {puedeIr ? (
                  <button
                    type="button"
                    onClick={() => onSelect(paso.id)}
                    aria-label={etiqueta}
                    className="cursor-pointer rounded-full p-1 -m-1 transition-transform duration-150 ease-out hover:scale-105 hover:ring-4 hover:ring-primary/20 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {punto}
                  </button>
                ) : (
                  punto
                )}
                <span
                  className={cn(
                    'w-full break-words px-1 text-center text-xs leading-tight sm:text-sm',
                    esActual ? 'font-semibold text-foreground' : 'text-muted-foreground',
                    (hecho || esPausa) && 'font-medium text-foreground/80',
                  )}
                >
                  {paso.titulo}
                  {hecho ? <span className="sr-only"> (completado)</span> : null}
                  {esPausa ? <span className="sr-only"> (donde te quedaste)</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}