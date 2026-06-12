import { useState, useMemo } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MultiDatePickerProps {
  value?: string[];
  onChange: (dates: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiDatePicker({
  value = [],
  onChange,
  placeholder = 'Seleccionar días...',
  disabled = false,
  className,
}: MultiDatePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedDates = useMemo(
    () => value.map((d) => new Date(d + 'T00:00:00')),
    [value]
  );

  const handleSelect = (days: Date[] | undefined) => {
    if (!days) {
      onChange([]);
      return;
    }
    onChange(days.map((d) => format(d, 'yyyy-MM-dd')));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const sortedDates = useMemo(() => [...value].sort(), [value]);
  const diasCount = differenceInCalendarDays(
    selectedDates.length > 0 ? selectedDates[selectedDates.length - 1] : new Date(),
    selectedDates.length > 0 ? selectedDates[0] : new Date()
  ) + 1;

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              selectedDates.length === 0 && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {selectedDates.length > 0
              ? `${selectedDates.length} día(s) seleccionado(s)`
              : placeholder}
            {selectedDates.length > 0 && (
              <X
                className="ml-auto h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={clearAll}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {selectedDates.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sortedDates.map((d) => (
            <span
              key={d}
              className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {format(new Date(d + 'T00:00:00'), 'dd MMM', { locale: es })}
            </span>
          ))}
        </div>
      )}

      {selectedDates.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedDates.length} día(s) &middot; {diasCount} día(s) corrido(s) entre primera y última fecha
        </p>
      )}
    </div>
  );
}
