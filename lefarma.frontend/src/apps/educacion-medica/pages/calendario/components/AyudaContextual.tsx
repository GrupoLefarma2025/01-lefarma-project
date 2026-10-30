import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AyudaContextualProps {
  titulo: string;
  children: ReactNode;
  className?: string;
}

export function AyudaContextual({ titulo, children, className = '' }: AyudaContextualProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${className}`}
          aria-label={`Ayuda: ${titulo}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-xs">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{titulo}</p>
        <div className="mt-1 leading-relaxed text-slate-500 dark:text-slate-400">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
