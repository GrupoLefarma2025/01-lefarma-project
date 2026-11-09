import type { ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CatalogoToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
  className?: string;
}

export function CatalogoToolbar({
  left,
  right,
  onRefresh,
  refreshing = false,
  refreshLabel = 'Actualizar',
  className,
}: CatalogoToolbarProps) {
  return (
    <section
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-card p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800',
        className
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center gap-2">
        {right}
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg bg-card"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={refreshLabel}
            title={refreshLabel}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </section>
  );
}
