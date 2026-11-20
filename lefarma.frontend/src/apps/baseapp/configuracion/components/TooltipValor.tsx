import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TooltipValorProps {
  /** Elemento que abre el tooltip (debe ser un solo nodo y aceptar ref). */
  trigger: ReactElement;
  titulo: string;
  detalle: string;
  /** Texto completo que se copia; puede ser una función para no construirlo hasta el clic. */
  textoParaCopiar: string | (() => string);
  icono: ReactNode;
  children: ReactNode;
  className?: string;
}

async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Respaldo para navegadores sin permisos de Clipboard API.
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(area);
    }
  }
}

/**
 * Tooltip de valores largos: cabecera con título, conteo y botón de copiar,
 * cuerpo con scroll y altura máxima. Se usa igual para textos y listas.
 */
export function TooltipValor({
  trigger,
  titulo,
  detalle,
  textoParaCopiar,
  icono,
  children,
  className,
}: TooltipValorProps) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    },
    [],
  );

  const copiar = async () => {
    const texto = typeof textoParaCopiar === 'function' ? textoParaCopiar() : textoParaCopiar;
    const ok = await copiarAlPortapapeles(texto);
    if (!ok) {
      toast.error('No se pudo copiar al portapapeles');
      return;
    }
    setCopiado(true);
    if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setCopiado(false), 1600);
    toast.success('Copiado al portapapeles');
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'max-h-72 w-[24rem] max-w-[calc(100vw_-_2rem)] overflow-auto rounded-lg border border-border bg-popover px-0 py-0 text-[12px] font-normal leading-5 text-popover-foreground shadow-xl',
            className,
          )}
        >
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-popover px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {icono}
              {titulo}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
                {detalle}
              </span>
              <button
                type="button"
                onClick={copiar}
                className="inline-flex h-6 min-w-[4.75rem] items-center justify-center gap-1 rounded-md border border-border bg-background px-1.5 text-[10px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Copiar al portapapeles"
              >
                {copiado ? (
                  <Check className="h-3 w-3 text-emerald-600" aria-hidden />
                ) : (
                  <Copy className="h-3 w-3" aria-hidden />
                )}
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </span>
          </div>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
