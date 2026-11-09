import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface ResumenCompactoItem {
  label: string;
  value: ReactNode;
  dotClassName?: string;
}

interface ResumenCompactoProps {
  items: ResumenCompactoItem[];
  loading?: boolean;
  className?: string;
}

export function ResumenCompacto({ items, loading = false, className }: ResumenCompactoProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-slate-200/80 bg-card px-3.5 py-2 text-xs text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800 dark:text-slate-400',
        className
      )}
    >
      {loading ? (
        <>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-28" />
        </>
      ) : (
        items.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span
              className={cn('h-1.5 w-1.5 rounded-full bg-slate-400', item.dotClassName)}
              aria-hidden
            />
            <strong className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {item.value}
            </strong>
            <span>{item.label}</span>
          </span>
        ))
      )}
    </div>
  );
}
