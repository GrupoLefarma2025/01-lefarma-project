import { useRef, useState } from 'react';
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
  fecha: string;
  hora: string;
  onFecha: (fecha: string) => void;
  onHora: (hora: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  desde?: { fecha: string; hora: string } | null;
}

function parseFecha(value: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? undefined : d;
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

export function DateTimePicker({
  id,
  fecha,
  hora,
  onFecha,
  onHora,
  placeholder = 'Elige fecha y hora',
  disabled,
  className,
  desde = null,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const [minutoElegido, setMinutoElegido] = useState(false);
  const completoAlAbrirRef = useRef(false);

  const fechaDate = parseFecha(fecha);
  const { hora: hh, minuto: mm } = partirHoraMinuto(hora);
  const horaActual = dosDigitos(ahora.getHours());
  const minutoActual = dosDigitos(ahora.getMinutes());
  const horaMostrada = hh || horaActual;
  const minutoMostrado = mm || minutoActual;
  const desdeDate = desde?.fecha ? parseFecha(desde.fecha) : undefined;
  const desdeEsHoy = Boolean(desdeDate && mismoDia(desdeDate, ahora));
  const { hora: desdeHora, minuto: desdeMinuto } = partirHoraMinuto(desde?.hora ?? '');
  const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const minDia = desdeDate && desdeDate.getTime() > inicioDeHoy.getTime() ? desdeDate : inicioDeHoy;
  const minHoraDeDesde = desdeHora && desdeMinuto ? { hora: desdeHora, minuto: desdeMinuto } : null;
  const minHora = mismoDia(minDia, inicioDeHoy)
    ? (desdeEsHoy && minHoraDeDesde && `${minHoraDeDesde.hora}:${minHoraDeDesde.minuto}` > `${horaActual}:${minutoActual}`
        ? minHoraDeDesde
        : { hora: horaActual, minuto: minutoActual })
    : minHoraDeDesde;
  const minimo = fechaDate && mismoDia(fechaDate, minDia) ? minHora : null;

  function cambiarApertura(abierto: boolean) {
    if (abierto) {
      setAhora(new Date());
      setMinutoElegido(false);
      completoAlAbrirRef.current = Boolean(fecha && hh && mm);
    }
    setOpen(abierto);
  }

  function elegirFecha(day: Date | undefined) {
    if (!day) {
      onFecha('');
      return;
    }
    onFecha(format(day, 'yyyy-MM-dd'));
    let horaValida = Boolean(hh && mm);
    if (!hh || !mm) {
      const ahoraNuevo = new Date();
      let h = hh || dosDigitos(ahoraNuevo.getHours());
      let m = mm || dosDigitos(ahoraNuevo.getMinutes());
      if (minHora && mismoDia(day, minDia) && `${h}:${m}` < `${minHora.hora}:${minHora.minuto}`) {
        h = minHora.hora;
        m = minHora.minuto;
      }
      onHora(`${h}:${m}`);
      horaValida = true;
    } else if (minHora && mismoDia(day, minDia) && `${hh}:${mm}` < `${minHora.hora}:${minHora.minuto}`) {
      onHora('');
      horaValida = false;
    }
    if (horaValida) setOpen(false);
  }

  function elegirHora(parte: 'hora' | 'minuto', valor: string) {
    const h = parte === 'hora' ? valor : (hh || horaMostrada);
    let m = parte === 'minuto' ? valor : (mm || minutoMostrado);
    if (minimo && h === minimo.hora && m && m < minimo.minuto) m = minimo.minuto;
    const completa = h && m ? `${h}:${m}` : '';
    if (completa) onHora(completa);
    if (parte === 'minuto') setMinutoElegido(true);
    const minutoListo = parte === 'minuto' || minutoElegido || completoAlAbrirRef.current;
    if (completa && fecha && minutoListo) setOpen(false);
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Popover open={open} onOpenChange={cambiarApertura}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-10 w-full justify-start text-left font-normal',
              !fechaDate && !hora && 'text-foreground/75',
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
                disabled={{ before: minDia }}
                initialFocus
              />
            </div>
            <div className="w-full sm:w-52">
              <ColumnasTiempo hora={horaMostrada} minuto={minutoMostrado} onOpcion={elegirHora} minimo={minimo} />
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
