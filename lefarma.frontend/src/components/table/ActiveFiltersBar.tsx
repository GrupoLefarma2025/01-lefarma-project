import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface ActiveFilterChip {
  id: string;
  label: string;
}

interface ActiveFiltersBarProps {
  filters: ActiveFilterChip[];
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({ filters, onRemoveFilter, onClearAll }: ActiveFiltersBarProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 pb-3 pt-2 dark:border-slate-800">
      {filters.map((filter) => (
        <Badge
          key={filter.id}
          variant="outline"
          className="gap-1 border-sky-100 bg-sky-50/80 pr-1 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300"
        >
          {filter.label}
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 text-sky-600 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/40"
            onClick={() => onRemoveFilter(filter.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      {filters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          onClick={onClearAll}
        >
          Limpiar todos
        </Button>
      )}
    </div>
  );
}
