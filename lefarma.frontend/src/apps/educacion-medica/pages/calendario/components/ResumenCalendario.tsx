import { useState } from 'react';
import { AlertTriangle, CalendarCheck2, CheckCircle2, ChevronDown, UserRound } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ResumenCalendarioProps {
  total: number;
  talleres: number;
  conflictos: number;
  sinResponsable: number;
  onVerConflictos?: () => void;
}

function DatoResumen({
  icon: Icon,
  label,
  value,
  detalle,
  tono,
}: {
  icon: typeof CalendarCheck2;
  label: string;
  value: number;
  detalle: string;
  tono: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200/70 bg-card px-2.5 py-2 dark:border-slate-800">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tono}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
        <span className="block text-sm font-semibold tabular-nums leading-tight text-slate-800 dark:text-slate-100">
          {value}
          <span className="ml-1 text-[9px] font-normal text-slate-400">{detalle}</span>
        </span>
      </span>
    </div>
  );
}

export function ResumenCalendario({
  total,
  talleres,
  conflictos,
  sinResponsable,
  onVerConflictos,
}: ResumenCalendarioProps) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto}>
      <div className="rounded-xl border border-slate-200/80 bg-card px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              aria-expanded={abierto}
            >
              Resumen
              <ChevronDown
                className={`h-3 w-3 transition-transform ${abierto ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>

          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <CalendarCheck2 className="h-3 w-3 text-slate-400" />
            <strong className="font-semibold text-slate-700 dark:text-slate-200">{total}</strong>
            actividades
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <strong className="font-semibold text-slate-700 dark:text-slate-200">{talleres}</strong>
            talleres
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10px] text-slate-500 transition-colors hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300"
            onClick={onVerConflictos}
            disabled={!onVerConflictos}
          >
            <AlertTriangle className="h-3 w-3 text-rose-500" />
            <strong className="font-semibold text-slate-700 dark:text-slate-200">
              {conflictos}
            </strong>
            conflictos
          </button>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <UserRound className="h-3 w-3 text-amber-500" />
            <strong className="font-semibold text-slate-700 dark:text-slate-200">
              {sinResponsable}
            </strong>
            sin responsable
          </span>
        </div>

        <CollapsibleContent className="mt-2">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <DatoResumen
              icon={CalendarCheck2}
              label="Actividades"
              value={total}
              detalle="en el periodo"
              tono="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            />
            <DatoResumen
              icon={CheckCircle2}
              label="Talleres"
              value={talleres}
              detalle={`${total - talleres} por programar`}
              tono="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
            />
            <DatoResumen
              icon={AlertTriangle}
              label="Conflictos"
              value={conflictos}
              detalle="por revisar"
              tono="bg-rose-50 text-rose-500 dark:bg-rose-950 dark:text-rose-300"
            />
            <DatoResumen
              icon={UserRound}
              label="Sin responsable"
              value={sinResponsable}
              detalle="sin ejecutivo"
              tono="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
