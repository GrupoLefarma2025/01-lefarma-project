import { cn } from '@/lib/utils';

export interface OpcionSwitchTab {
  id: string;
  titulo: string;
}

export interface SwitchTabProps {
  ariaLabel: string;
  value: string;
  onChange: (id: string) => void;
  options: OpcionSwitchTab[];
  disabled?: boolean;
  className?: string;
}

/**
 * Switch de pestañas animado: píldora con un thumb que se desliza a la
 * opción activa (solo transform, con `prefers-reduced-motion` instantáneo).
 * Las opciones son radios (Tab + flechas ←/→) en el primario del tema.
 */
export function SwitchTab({ ariaLabel, value, onChange, options, disabled, className }: SwitchTabProps) {
  const indice = Math.max(0, options.findIndex((o) => o.id === value));

  function mover(direccion: 1 | -1, contenedor: HTMLDivElement) {
    if (disabled) return;
    const siguiente = (indice + direccion + options.length) % options.length;
    onChange(options[siguiente].id);
    const radios = contenedor.querySelectorAll('[role="radio"]');
    (radios[siguiente] as HTMLElement | undefined)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('relative grid rounded-full bg-muted p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); mover(1, e.currentTarget); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1, e.currentTarget); }
      }}
    >
      {/* Thumb: ocupa 1/n del interior y se traslada su propio ancho por paso. */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-primary shadow transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${indice * 100}%)` }}
      />
      {options.map((opcion) => {
        const activa = opcion.id === value;
        return (
          <button
            key={opcion.id}
            type="button"
            role="radio"
            aria-checked={activa}
            disabled={disabled}
            onClick={() => onChange(opcion.id)}
            className={cn(
              'relative z-10 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              activa ? 'text-primary-foreground' : 'text-primary hover:text-primary/80',
            )}
          >
            {opcion.titulo}
          </button>
        );
      })}
    </div>
  );
}
