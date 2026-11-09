import { Map, Table2 } from 'lucide-react';

export type ViewMode = 'tabla' | 'mapa';

const OPCIONES: Array<{ value: ViewMode; label: string; icon: typeof Map }> = [
  { value: 'tabla', label: 'Tabla', icon: Table2 },
  { value: 'mapa', label: 'Mapa', icon: Map },
];

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-slate-200/70 bg-slate-50/70 p-1 dark:border-slate-800 dark:bg-slate-900/40"
      role="group"
      aria-label="Vista del catálogo"
    >
      {OPCIONES.map((opcion) => {
        const Icono = opcion.icon;
        const activo = value === opcion.value;
        return (
          <button
            key={opcion.value}
            type="button"
            onClick={() => onChange(opcion.value)}
            aria-pressed={activo}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-all',
              activo
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            ].join(' ')}
          >
            <Icono className="h-3.5 w-3.5" />
            {opcion.label}
          </button>
        );
      })}
    </div>
  );
}
