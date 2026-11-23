import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DireccionTramo({
  desde,
  hasta,
  compacto = false,
  className,
}: {
  desde: string;
  hasta: string;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="text-muted-foreground">{desde}</span>
      <ArrowRight
        aria-hidden
        strokeWidth={2.75}
        className={cn('shrink-0 text-primary', compacto ? 'h-3.5 w-3.5' : 'h-4 w-4')}
      />
      <span className="sr-only">hacia</span>
      <span className="font-semibold text-foreground">{hasta}</span>
    </span>
  );
}

export default DireccionTramo;
