import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TextoExpandibleProps {
  text: string | null | undefined;
  fallback?: string;
  lineas?: 1 | 2;
  className?: string;
  triggerClassName?: string;
}

export function TextoExpandible({
  text,
  fallback = '-',
  lineas = 1,
  className = '',
  triggerClassName = '',
}: TextoExpandibleProps) {
  const valor = text?.trim() ? text : fallback;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      toast.success('Texto copiado.');
    } catch {
      toast.error('No se pudo copiar el texto.');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={valor}
          className={`group inline-flex min-w-0 max-w-full items-center gap-1 text-left ${triggerClassName}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <span
            className={`min-w-0 ${lineas === 2 ? 'line-clamp-2 whitespace-normal' : 'truncate'} ${className}`}
          >
            {valor}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-xs">
        <p className="break-words text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-200">
          {valor}
        </p>
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            onClick={copiar}
          >
            Copiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
