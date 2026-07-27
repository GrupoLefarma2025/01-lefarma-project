import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineLoaderProps {
  message?: string;
  className?: string;
}

export function InlineLoader({ message, className }: InlineLoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground', className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}