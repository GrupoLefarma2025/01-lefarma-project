import { cn } from '@/lib/utils';

/**
 * Estilo compartido de pestañas tipo carpeta (Destinos del wizard y pasos del
 * modal de cálculos).
 *
 * El texto en hover se fija explícitamente porque el botón base usa
 * `hover:text-accent-foreground` (blanco) y se perdería sobre el fondo claro
 * de la pestaña activa.
 */
export function folderTabClassName(active: boolean): string {
  return cn(
    'relative inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-t-lg rounded-b-none border border-b-0 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    active
      ? "z-10 border-border bg-card text-foreground ring-1 ring-primary/20 hover:bg-card hover:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-card after:content-['']"
      : 'border-border/70 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
  );
}
