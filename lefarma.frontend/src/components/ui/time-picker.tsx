import * as React from 'react';
import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface PartesHora {
  horas: number;
  minutos: number;
  segundos: number;
}

const VALORES_HORAS = Array.from({ length: 24 }, (_, indice) => indice);
const VALORES_MINUTOS = Array.from({ length: 60 }, (_, indice) => indice);
const VALORES_SEGUNDOS = Array.from({ length: 60 }, (_, indice) => indice);

const dosDigitos = (numero: number) => String(numero).padStart(2, '0');

/** "HH:mm" o "HH:mm:ss" → partes; null cuando el valor no es una hora válida. */
function partesDeHora(valor: string | null | undefined): PartesHora | null {
  if (!valor) return null;
  const coincidencia = valor.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!coincidencia) return null;
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  const segundos = Number(coincidencia[3] ?? 0);
  if (horas > 23 || minutos > 59 || segundos > 59) return null;
  return { horas, minutos, segundos };
}

interface ColumnaTiempoProps {
  etiqueta: string;
  valores: number[];
  actual: number;
  abierto: boolean;
  onElegir: (valor: number) => void;
}

function ColumnaTiempo({ etiqueta, valores, actual, abierto, onElegir }: ColumnaTiempoProps) {
  const contenedor = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const nodo = contenedor.current;
    if (!abierto || !nodo) return;
    const fila = nodo.querySelector<HTMLElement>('[data-actual="true"]');
    if (fila) nodo.scrollTop = fila.offsetTop - nodo.clientHeight / 2 + fila.clientHeight / 2;
  }, [abierto, actual]);

  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </span>
      <div
        ref={contenedor}
        role="listbox"
        aria-label={etiqueta}
        className="h-52 w-14 overflow-y-auto overscroll-contain rounded-md border bg-background p-1"
      >
        {valores.map((valor) => {
          const seleccionado = valor === actual;
          return (
            <button
              key={valor}
              type="button"
              role="option"
              aria-selected={seleccionado}
              data-actual={seleccionado || undefined}
              onClick={() => onElegir(valor)}
              className={cn(
                'flex h-8 w-full items-center justify-center rounded-sm font-mono text-sm tabular-nums transition-colors',
                seleccionado
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {dosDigitos(valor)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface TimePickerProps {
  /** Hora en formato `HH:mm` o `HH:mm:ss`; `null` o vacío cuando no hay valor. */
  value: string | null;
  /** Devuelve `HH:mm:ss` (o `HH:mm` sin segundos) y `null` al limpiar. */
  onValueChange: (value: string | null) => void;
  /** Muestra la columna de segundos y conserva la precisión al devolver el valor. */
  conSegundos?: boolean;
  disabled?: boolean;
  /** Marca el campo como inválido (borde y `aria-invalid`). */
  invalid?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
}

export function TimePicker({
  value,
  onValueChange,
  conSegundos = true,
  disabled = false,
  invalid = false,
  id,
  className,
  placeholder = conSegundos ? '--:--:--' : '--:--',
}: TimePickerProps) {
  const [abierto, setAbierto] = React.useState(false);
  const partes = partesDeHora(value);
  const activas = partes ?? { horas: 0, minutos: 0, segundos: 0 };

  const emitir = (siguientes: PartesHora) => {
    const texto = conSegundos
      ? `${dosDigitos(siguientes.horas)}:${dosDigitos(siguientes.minutos)}:${dosDigitos(siguientes.segundos)}`
      : `${dosDigitos(siguientes.horas)}:${dosDigitos(siguientes.minutos)}`;
    onValueChange(texto);
  };

  const elegir = (unidad: keyof PartesHora, valorUnidad: number) => {
    emitir({ ...activas, [unidad]: valorUnidad });
  };

  const usarAhora = () => {
    const ahora = new Date();
    emitir({
      horas: ahora.getHours(),
      minutos: ahora.getMinutes(),
      segundos: ahora.getSeconds(),
    });
  };

  const texto = partes
    ? conSegundos
      ? `${dosDigitos(partes.horas)}:${dosDigitos(partes.minutos)}:${dosDigitos(partes.segundos)}`
      : `${dosDigitos(partes.horas)}:${dosDigitos(partes.minutos)}`
    : null;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            'h-10 w-full max-w-xs justify-start gap-2 border-border bg-background font-mono font-normal',
            !texto && 'text-muted-foreground',
            invalid && 'border-destructive focus-visible:ring-destructive/30',
            className,
          )}
        >
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {texto ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex gap-1 p-2">
          <ColumnaTiempo
            etiqueta="Hora"
            valores={VALORES_HORAS}
            actual={activas.horas}
            abierto={abierto}
            onElegir={(valorUnidad) => elegir('horas', valorUnidad)}
          />
          <ColumnaTiempo
            etiqueta="Minuto"
            valores={VALORES_MINUTOS}
            actual={activas.minutos}
            abierto={abierto}
            onElegir={(valorUnidad) => elegir('minutos', valorUnidad)}
          />
          {conSegundos && (
            <ColumnaTiempo
              etiqueta="Segundo"
              valores={VALORES_SEGUNDOS}
              actual={activas.segundos}
              abierto={abierto}
              onElegir={(valorUnidad) => elegir('segundos', valorUnidad)}
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={usarAhora}
          >
            Ahora
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onValueChange(null)}
            >
              Limpiar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={() => setAbierto(false)}
            >
              Listo
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
