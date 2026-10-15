import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColumnasTiempo, partirHoraMinuto, formatoHora12h } from './ColumnasTiempo';

export interface TimePickerProps {
  id: string;
  value: string;
  onChange: (hora: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * Reloj propio sobre el Popover de shadcn (mismo patrón que el DatePicker):
 * display grande + las columnas de hora compartidas. Elegir una opción
 * completa la hora (la parte faltante es 00) y cierra, igual que el
 * calendario cierra al elegir día. Se muestra en 12 horas (AM/PM); el valor
 * se guarda en 24 horas.
 */
export function TimePicker({ id, value, onChange, disabled, error, className }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const { hora, minuto } = partirHoraMinuto(value);
  const errorId = error ? `${id}-error` : undefined;
  const hintId = `${id}-ayuda`;

  function elegir(parte: 'hora' | 'minuto', valor: string) {
    const h = parte === 'hora' ? valor : hora;
    const m = parte === 'minuto' ? valor : minuto;
    if (h && m) onChange(`${h}:${m}`);
    else if (h) onChange(`${h}:00`);
    else if (m) onChange(`00:${m}`);
    setOpen(false);
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            className={cn('h-10 w-full justify-start text-left font-normal', !hora && !minuto && 'text-muted-foreground')}
          >
            <Clock className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {hora || minuto ? formatoHora12h(`${hora || '00'}:${minuto || '00'}`) : '--:--'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" align="start">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p aria-live="polite" className="text-2xl font-semibold tabular-nums tracking-tight">
                {hora && minuto ? formatoHora12h(`${hora}:${minuto}`) : '--:--'}
              </p>
              <Button type="button" size="sm" onClick={() => setOpen(false)} aria-label="Listo, cerrar">
                <Check className="h-4 w-4" aria-hidden />
                Listo
              </Button>
            </div>
            <ColumnasTiempo hora={hora} minuto={minuto} onOpcion={elegir} />
          </div>
        </PopoverContent>
      </Popover>
      <p id={hintId} className="text-xs text-muted-foreground">
        Hora en formato de 12 horas (AM/PM).
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
