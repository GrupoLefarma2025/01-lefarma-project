import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ColumnFilter } from '@/types/table.types';

interface ActiveFiltersBarProps {
  filters: ColumnFilter[];
  onRemoveFilter: (columnId: string) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({ filters, onRemoveFilter, onClearAll }: ActiveFiltersBarProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {filters.map(filter => (
        <Badge key={filter.columnId} variant="secondary" className="gap-1 pr-1">
          {filter.displayLabel}
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={() => onRemoveFilter(filter.columnId)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      {filters.length > 1 && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClearAll}>
          Limpiar todos
        </Button>
      )}
    </div>
  );
}