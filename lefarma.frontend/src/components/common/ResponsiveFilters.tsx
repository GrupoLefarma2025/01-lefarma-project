import {
  forwardRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ResponsiveFiltersProps {
  children: ReactNode;
  activeCount: number;
  onClear: () => void;
  title?: string;
  description?: string;
  align?: 'start' | 'center' | 'end';
  desktopWidthClassName?: string;
}

const FiltrosTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof Button> & { activeCount: number }
>(function FiltrosTrigger({ activeCount, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      className={cn(
        'relative h-9 gap-1.5 rounded-lg border-slate-200 bg-card px-3 text-xs font-medium',
        className
      )}
      {...props}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      Filtros
      {activeCount > 0 && (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-100 px-1 text-[9px] font-semibold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
          {activeCount}
        </span>
      )}
    </Button>
  );
});

export function ResponsiveFilters({
  children,
  activeCount,
  onClear,
  title = 'Filtros',
  description,
  align = 'end',
  desktopWidthClassName = 'w-[420px]',
}: ResponsiveFiltersProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const footer = (close: () => void) => (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-[11px] text-slate-500"
        onClick={onClear}
        disabled={activeCount === 0}
      >
        Limpiar
      </Button>
      <Button
        size="sm"
        className="h-8 rounded-lg bg-[#eb6c36] px-3 text-[11px] text-white hover:bg-[#d95a2b]"
        onClick={close}
      >
        Ver resultados
      </Button>
    </div>
  );

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <FiltrosTrigger
            activeCount={activeCount}
            className="hidden md:inline-flex"
          />
        </PopoverTrigger>
        <PopoverContent
          align={align}
          className={cn('max-h-[min(75vh,620px)] overflow-y-auto p-3', desktopWidthClassName)}
        >
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400">
            {title}
          </p>
          <div className="mt-2 space-y-3">{children}</div>
          {footer(() => setPopoverOpen(false))}
        </PopoverContent>
      </Popover>

      <FiltrosTrigger
        activeCount={activeCount}
        className="inline-flex md:hidden"
        onClick={() => setSheetOpen(true)}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[86vh] overflow-y-auto rounded-t-3xl border-slate-200 bg-[#f7f7f4] p-5 dark:border-slate-800 dark:bg-slate-950"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-base tracking-tight">{title}</SheetTitle>
            {description && (
              <SheetDescription className="text-xs text-slate-500">
                {description}
              </SheetDescription>
            )}
          </SheetHeader>
          <div className="space-y-3">{children}</div>
          <SheetFooter className="gap-2">{footer(() => setSheetOpen(false))}</SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
