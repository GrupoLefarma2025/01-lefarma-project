import { AlertTriangle, ArrowLeftRight, LockKeyhole } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CalendarioItem } from '../../../types/educacionMedica.types';
import { estadoEtiqueta } from '../calendarioUtils';

const ESTILO_ESTADO: Record<string, string> = {
  SinTaller:
    'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  Programado:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  EnCurso:
    'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300',
  Realizado:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  Cancelado:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
};

export function EstadoActividadBadge({ estado }: { estado: string }) {
  return (
    <Badge
      variant="outline"
      className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
        ESTILO_ESTADO[estado] ?? ESTILO_ESTADO.SinTaller
      }`}
    >
      {estadoEtiqueta[estado] ?? estado}
    </Badge>
  );
}

export function MarcasActividad({
  item,
  compacto = false,
}: {
  item: CalendarioItem;
  compacto?: boolean;
}) {
  const clase = compacto ? 'h-3 w-3' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-1">
      {item.esExtraordinario && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[8px] font-semibold text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
          title="Actividad extraordinaria"
        >
          <ArrowLeftRight className={clase} />
          {!compacto && 'Extra'}
        </span>
      )}
      {item.bloqueado && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
          title="Actividad bloqueada"
        >
          <LockKeyhole className={clase} />
          {!compacto && 'Bloqueado'}
        </span>
      )}
      {item.solicitudCambioPendiente && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
          title="Solicitud de cambio pendiente"
        >
          <AlertTriangle className={clase} />
          {!compacto && 'Solicitud'}
        </span>
      )}
    </span>
  );
}
