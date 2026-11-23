import { cn } from '@/lib/utils';

export function folderTabClassName(active: boolean): string {
  return cn(
    'relative inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-t-lg rounded-b-none border border-b-0 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    active
      ? "z-10 border-border bg-card text-foreground ring-1 ring-primary/20 hover:bg-card hover:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-card after:content-['']"
      : 'border-border/70 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
  );
}

export const folderTabTriggerClassName = cn(
  'relative inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-t-lg rounded-b-none border border-b-0 border-border/70 bg-muted/60 px-3 text-sm font-medium text-muted-foreground transition-colors',
  'hover:bg-muted hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'data-[state=active]:z-10 data-[state=active]:-mb-px data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-primary/20',
  'disabled:pointer-events-none disabled:opacity-50',
);
