import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface OpcionModo {
  id: string;
  titulo: string;
  descripcion?: string;
}

export interface SelectorModoProps {
  ariaLabel: string;
  value: string;
  onChange: (id: string) => void;
  options: OpcionModo[];
  disabled?: boolean;
  className?: string;
}

export function SelectorModo({ ariaLabel, value, onChange, options, disabled, className }: SelectorModoProps) {
  const elegida = options.find((o) => o.id === value) ?? null;
  return (
    <div className={cn('space-y-1', className)}>
      <ToggleGroup
        type="single"
        aria-label={ariaLabel}
        value={value}
        onValueChange={(id) => {
          if (id) onChange(id);
        }}
        disabled={disabled}
        className="inline-flex w-auto max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#eb6c36]/40 bg-[#eb6c36]/15 p-1"
      >
        {options.map((opcion) => (
          <ToggleGroupItem
            key={opcion.id}
            value={opcion.id}
            aria-label={opcion.titulo}
            className="shrink-0 rounded-md px-4 py-2 text-sm font-semibold text-[#9a4a1f] data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow"
          >
            {opcion.titulo}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {elegida?.descripcion ? (
        <p className="text-sm text-muted-foreground">{elegida.descripcion}</p>
      ) : null}
    </div>
  );
}
