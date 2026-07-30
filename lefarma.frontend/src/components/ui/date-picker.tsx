import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Matcher } from 'react-day-picker';

interface DatePickerProps {
  value?: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledDays?: Matcher | Matcher[];
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha...',
  disabled = false,
  disabledDays,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const dateValue = value ? new Date(value + 'T00:00:00') : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !dateValue && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {dateValue ? format(dateValue, 'PPP', { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(day) => {
            onChange(day ? format(day, 'yyyy-MM-dd') : null);
            setOpen(false);
          }}
          disabled={disabledDays}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
