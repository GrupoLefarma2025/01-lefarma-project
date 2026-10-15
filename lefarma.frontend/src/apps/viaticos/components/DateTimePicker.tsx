import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColumnasTiempo, partirHoraMinuto, formatoHora12h } from './ColumnasTiempo';

export interface DateTimePickerProps {
  id: string;
  /** Fecha 'yyyy-MM-dd' o ''. */
  fecha: string;
  /** Hora 'HH:mm' o ''. */
  hora: string;
  onFecha: (fecha: string) => void;
  onHora: (hora: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function parseFecha(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Fecha y hora en un solo campo: un botón abre un panel con el calendario y
 * las columnas de hora lado a lado (mismo patrón que el DatePicker). Cada
 * elección actualiza su parte al instante; cuando fecha y hora quedan
 * completas, el panel se cierra solo. Se muestra en 12 horas (AM/PM); el
 * valor se guarda en 24 horas.
 */
export function DateTimePicker({
  id,
  fecha,
  hora,
  onFecha,
  onHora,
  placeholder = 'Elige fecha y hora',
  disabled,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const fechaDate = parseFecha(fecha);
  const { hora: hh, minuto: mm } = partirHoraMinuto(hora);

  function elegirFecha(day: Date | undefined) {
    onFecha(day ? format(day, 'yyyy-MM-dd') : '');
    // Si ya había hora, con la fecha queda completo y se cierra.
    if (day && hora) setOpen(false);
  }

  function elegirHora(parte: 'hora' | 'minuto', valor: string) {
    const h = parte === 'hora' ? valor : hh;
    const m = parte === 'minuto' ? valor : mm;
    const completa = h && m ? `${h}:${m}` : h ? `${h}:00` : m ? `00:${m}` : '';
    if (completa) onHora(completa);
    // Si ya había fecha, con la hora queda completo y se cierra.
    if (completa && fecha) setOpen(false);
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-10 w-full justify-start text-left font-normal',
              !fechaDate && !hora && 'text-muted-foreground',
            )}
          >
            <CalendarClock className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {fechaDate ? format(fechaDate, 'PPP', { locale: es }) : placeholder}
            {fechaDate || hora ? ` · ${hora ? formatoHora12h(hora) : '--:--'}` : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div role="group" aria-label="Día">
              <Calendar
                mode="single"
                selected={fechaDate}
                onSelect={elegirFecha}
                initialFocus
              />
            </div>
            <div className="w-full sm:w-52">
              <ColumnasTiempo hora={hh} minuto={mm} onOpcion={elegirHora} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Hora en formato de 12 horas (AM/PM).
      </p>
    </div>
  );
}
