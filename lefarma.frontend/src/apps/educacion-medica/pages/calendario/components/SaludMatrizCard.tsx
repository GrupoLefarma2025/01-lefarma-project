import { AlertTriangle, CheckCircle2, Info, Lock, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MatrizRevision } from '../../../types/educacionMedica.types';

interface SaludMatrizCardProps {
  revision: MatrizRevision | null;
  capturaAbierta: boolean;
  loading?: boolean;
}

const indicadores = (revision: MatrizRevision) => [
  { label: 'Visitas tipo taller', value: revision.visitasTipoTaller },
  { label: 'Con taller', value: revision.visitasConTaller },
  { label: 'Sin taller', value: revision.visitasSinTaller, alerta: revision.visitasSinTaller > 0 },
  { label: 'Talleres', value: revision.totalTalleres },
  { label: 'Sin recursos', value: revision.talleresSinRecursos, alerta: revision.talleresSinRecursos > 0 },
  { label: 'Sin costo', value: revision.talleresSinCosto, alerta: revision.talleresSinCosto > 0 },
  {
    label: 'Fuera de versión',
    value: revision.talleresFueraVersionActiva,
    alerta: revision.talleresFueraVersionActiva > 0,
  },
  {
    label: 'Solicitudes',
    value: revision.solicitudesPendientes,
    alerta: revision.solicitudesPendientes > 0,
  },
];

export function SaludMatrizCard({ revision, capturaAbierta, loading }: SaludMatrizCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            Salud de la matriz
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Cobertura contra las visitas de la versión de rutas activa.
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            capturaAbierta
              ? 'gap-1 rounded-full border-emerald-300 text-[10px] text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
              : 'gap-1 rounded-full border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-300'
          }
        >
          {capturaAbierta ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {capturaAbierta ? 'Captura abierta' : 'Captura cerrada'}
        </Badge>
      </div>

      {loading ? (
        <p className="mt-4 text-xs text-slate-400">Calculando cobertura…</p>
      ) : !revision ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          No se pudo cargar la revisión de cobertura.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {indicadores(revision).map((indicador) => (
              <div
                key={indicador.label}
                className={[
                  'rounded-xl border px-3 py-2',
                  indicador.alerta
                    ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
                    : 'border-slate-200/70 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40',
                ].join(' ')}
              >
                <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-slate-400">
                  {indicador.label}
                </p>
                <p
                  className={[
                    'mt-0.5 text-lg font-semibold tabular-nums',
                    indicador.alerta
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-800 dark:text-slate-100',
                  ].join(' ')}
                >
                  {indicador.value}
                </p>
              </div>
            ))}
          </div>

          {revision.visitasSinTaller > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11px] leading-relaxed text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No todas las visitas requieren taller. Si el hospital no tenía disponibilidad, la visita
              sin taller puede ser intencional; confírmalo antes de enviar la matriz.
            </p>
          )}

          {revision.advertencias.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {revision.advertencias.map((advertencia) => (
                <div
                  key={`${advertencia.codigo}-${advertencia.mensaje}`}
                  className={[
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed',
                    advertencia.severidad === 'warning'
                      ? 'border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300'
                      : advertencia.severidad === 'error'
                        ? 'border-rose-200 bg-rose-50/60 text-rose-800 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300'
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
                  ].join(' ')}
                >
                  {advertencia.severidad === 'warning' || advertencia.severidad === 'error' ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{advertencia.mensaje}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
