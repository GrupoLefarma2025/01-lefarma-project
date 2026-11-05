import { MapPin } from 'lucide-react';

const LEYENDA = [
  { etiqueta: 'Taller', punto: 'bg-orange-400' },
  { etiqueta: 'Visita', punto: 'bg-sky-400' },
  { etiqueta: 'Conflicto', punto: 'bg-rose-400' },
  { etiqueta: 'Bloqueado', punto: 'bg-amber-400' },
  { etiqueta: 'Extraordinario', punto: 'bg-violet-400' },
  { etiqueta: 'Cambio pendiente', punto: 'bg-amber-500' },
];

export function CalendarioLeyenda({ puedeEditar }: { puedeEditar: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-slate-200/70 bg-white/50 px-3 py-2 text-[9px] text-slate-400 dark:border-slate-800 dark:bg-slate-950/20">
      <span className="font-semibold uppercase tracking-[0.08em] text-slate-400">Leyenda</span>
      {LEYENDA.map((item) => (
        <span key={item.etiqueta} className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${item.punto}`} />
          {item.etiqueta}
        </span>
      ))}
      <span className="ml-auto inline-flex items-center gap-1 text-slate-300">
        <MapPin className="h-2.5 w-2.5" />
        {puedeEditar ? 'Arrastra para reprogramar' : 'Solo lectura'}
      </span>
    </div>
  );
}
