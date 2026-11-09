import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type BannerTone = 'info' | 'warning' | 'danger' | 'success';

const TONOS: Record<BannerTone, string> = {
  info: 'border-sky-200/70 bg-sky-50/60 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300',
  warning:
    'border-amber-200/80 bg-amber-50/70 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200',
  danger:
    'border-rose-200/80 bg-rose-50/70 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/20 dark:text-rose-300',
  success:
    'border-emerald-200/80 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-300',
};

export function CatalogBanner({
  tone = 'info',
  title,
  icon,
  action,
  children,
  className,
}: {
  tone?: BannerTone;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs leading-relaxed',
        TONOS[tone],
        className
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <span className="mt-0.5 shrink-0">{icon ?? <Info className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
