import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface TimePickerProps {
  id: string;
  value: string;
  onChange: (hora: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, m) => String(m).padStart(2, '0'));

function partir(value: string): { hora: string; minuto: string } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hora: match[1], minuto: match[2] } : { hora: '', minuto: '' };
}

/**
 * Selector visual de hora y minutos sobre Radix Select: operable con teclado,
 * sin apariencia de control nativo del navegador. El formato de 24 horas es
 * PROVISIONAL y se declara en la interfaz hasta que el negocio lo apruebe.
 */
export function TimePicker({ id, value, onChange, disabled, error, className }: TimePickerProps) {
  const { hora, minuto } = partir(value);
  const errorId = error ? `${id}-error` : undefined;

  function cambiar(nuevaHora: string, nuevoMinuto: string) {
    if (nuevaHora && nuevoMinuto) onChange(`${nuevaHora}:${nuevoMinuto}`);
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-2" role="group" aria-labelledby={`${id}-etiqueta`}>
        <span id={`${id}-etiqueta`} className="sr-only">
          Hora en formato de 24 horas
        </span>
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${id}-hora`} className="text-xs text-muted-foreground">
            Hora
          </Label>
          <Select
            value={hora || undefined}
            onValueChange={(h) => cambiar(h, minuto || '00')}
            disabled={disabled}
          >
            <SelectTrigger id={`${id}-hora`} aria-describedby={errorId} className="h-10">
              <SelectValue placeholder="--">
                {hora ? <span aria-hidden={false}>{hora}</span> : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HORAS.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${id}-minuto`} className="text-xs text-muted-foreground">
            Minutos
          </Label>
          <Select
            value={minuto || undefined}
            onValueChange={(m) => cambiar(hora || '00', m)}
            disabled={disabled}
          >
            <SelectTrigger id={`${id}-minuto`} aria-describedby={errorId} className="h-10">
              <SelectValue placeholder="--">
                {minuto ? <span>{minuto}</span> : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MINUTOS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" aria-hidden={false}>
        {hora && minuto ? (
          <>
            Seleccionado: <strong>{`${hora}:${minuto}`}</strong>
          </>
        ) : (
          'Sin hora seleccionada.'
        )}{' '}
        Formato de 24 horas (provisional, sujeto a revisión).
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
