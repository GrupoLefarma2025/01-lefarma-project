import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, UserRound, MoveRight } from 'lucide-react';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import type {
  HistorialWorkflowItemResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';

const fmtFecha = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const getTipoEvento = (
  nombreAccion?: string | null
): 'rechazo' | 'retorno' | 'autorizacion' | 'otro' => {
  const n = (nombreAccion || '').toLowerCase();
  if (n.includes('rechaz')) return 'rechazo';
  if (n.includes('devuelv') || n.includes('retorn')) return 'retorno';
  if (n.includes('autor') || n.includes('aprob') || n.includes('envi') || n.includes('firm'))
    return 'autorizacion';
  return 'otro';
};

interface SolicitudFlujoTabProps {
  solicitud: SolicitudPersonalResponse;
  pasosWorkflow: WorkflowPasoFlowResponse[];
  historial: HistorialWorkflowItemResponse[];
}

export function SolicitudFlujoTab({ solicitud, pasosWorkflow, historial }: SolicitudFlujoTabProps) {
  const eventosPorPaso = useMemo(() => {
    const map = new Map<number, HistorialWorkflowItemResponse[]>();
    const ordenado = [...historial].sort(
      (a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime()
    );
    for (const item of ordenado) {
      const arr = map.get(item.idPaso) ?? [];
      arr.push(item);
      map.set(item.idPaso, arr);
    }
    return map;
  }, [historial]);

  const pasosCompletados = useMemo(() => {
    const set = new Set<number>();
    for (const item of historial) {
      if (item.datosSnapshot) {
        try {
          const snap = JSON.parse(item.datosSnapshot);
          if (snap.idPasoAnterior) set.add(snap.idPasoAnterior);
        } catch {
          /* ignore */
        }
      }
    }
    return set;
  }, [historial]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Línea de tiempo del workflow</p>
          <p className="text-xs text-muted-foreground">Trazabilidad paso a paso</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {pasosWorkflow.length} paso(s)
        </Badge>
      </div>

      {pasosWorkflow.length === 0 ? (
        <p className="rounded border bg-background p-3 text-xs text-muted-foreground">
          Esta solicitud no tiene un workflow configurado.
        </p>
      ) : (
        <div className="relative max-h-[36rem] overflow-y-auto pr-1">
          <div className="bg-border/60 absolute bottom-4 left-[1.1rem] top-4 w-0.5 rounded-full" />
          <div className="space-y-2">
            {pasosWorkflow.map((paso, idx) => {
              const isActual = solicitud.idPasoActual === paso.idPaso;
              const eventosPaso = eventosPorPaso.get(paso.idPaso) || [];
              const ultimoEvento = eventosPaso[eventosPaso.length - 1];
              const tipoUltimo = ultimoEvento ? getTipoEvento(ultimoEvento.nombreAccion) : null;
              const isCompletado =
                !isActual && (tipoUltimo === 'autorizacion' || pasosCompletados.has(paso.idPaso));
              const isRechazado = !isActual && tipoUltimo === 'rechazo';
              const isDevuelto = !isActual && tipoUltimo === 'retorno';

              const dotBg = isCompletado
                ? 'bg-emerald-500 border-emerald-500'
                : isActual
                  ? 'bg-blue-500 border-blue-500'
                  : isRechazado
                    ? 'bg-red-400 border-red-400'
                    : isDevuelto
                      ? 'bg-amber-400 border-amber-400'
                      : 'bg-background border-border';

              const DotIcon = isCompletado
                ? CheckCircle2
                : isRechazado
                  ? XCircle
                  : isDevuelto
                    ? AlertTriangle
                    : null;

              const cardClass = isActual
                ? 'border-l-blue-400 bg-blue-50/60 dark:bg-blue-950/15'
                : isCompletado
                  ? 'border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/10'
                  : isRechazado
                    ? 'border-l-red-300 bg-red-50/40 dark:bg-red-950/10'
                    : isDevuelto
                      ? 'border-l-amber-300 bg-amber-50/40 dark:bg-amber-950/10'
                      : 'border-l-border/50 opacity-60';

              return (
                <div key={paso.idPaso} className="relative pl-10">
                  <div
                    className={`absolute left-3 top-3 z-10 flex items-center justify-center rounded-full border-2 ${dotBg}`}
                    style={{ width: '1.1rem', height: '1.1rem', left: '0.55rem' }}
                  >
                    {isActual ? (
                      <span className="relative flex h-full w-full">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-50" />
                        <span className="relative inline-flex h-full w-full rounded-full bg-blue-500" />
                      </span>
                    ) : DotIcon ? (
                      <DotIcon className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                    ) : null}
                  </div>

                  <div className={`rounded-lg border border-l-4 p-3 text-xs ${cardClass}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="font-medium">{paso.nombrePaso}</span>
                      </div>
                      {isActual ? (
                        <Badge variant="secondary" className="text-[10px]">
                          ● Actual
                        </Badge>
                      ) : isCompletado ? (
                        <Badge className="bg-emerald-500 text-[10px] hover:bg-emerald-500">
                          ✓ Completado
                        </Badge>
                      ) : isRechazado ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Rechazado
                        </Badge>
                      ) : isDevuelto ? (
                        <Badge
                          variant="outline"
                          className="border-amber-400 text-[10px] text-amber-600"
                        >
                          Devuelto
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          En espera
                        </Badge>
                      )}
                    </div>

                    {paso.descripcionAyuda && (
                      <p className="mt-1 text-muted-foreground">{paso.descripcionAyuda}</p>
                    )}

                    {eventosPaso.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Historial de actividad
                        </p>
                        {eventosPaso.map((item) => {
                          let transFrom: string | null = null;
                          let transTo: string | null = null;
                          if (item.datosSnapshot) {
                            try {
                              const snap = JSON.parse(item.datosSnapshot) as {
                                idPasoAnterior?: number | null;
                                idPasoNuevo?: number | null;
                              };
                              transFrom = snap.idPasoAnterior
                                ? (pasosWorkflow.find((p) => p.idPaso === snap.idPasoAnterior)
                                    ?.nombrePaso ?? null)
                                : null;
                              transTo = snap.idPasoNuevo
                                ? (pasosWorkflow.find((p) => p.idPaso === snap.idPasoNuevo)
                                    ?.nombrePaso ?? null)
                                : null;
                            } catch {
                              /* ignore */
                            }
                          }
                          const showTrans = (transFrom || transTo) && transFrom !== transTo;

                          return (
                            <div
                              key={item.idEvento}
                              className="bg-background/80 overflow-hidden rounded-lg border text-xs"
                            >
                              <div className="border-border/50 bg-muted/30 flex items-center justify-between gap-2 border-b px-3 py-2">
                                <span className="truncate font-semibold">
                                  {item.nombreAccion || `Acción ${item.idAccion}`}
                                </span>
                                <span className="flex-shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                                  {fmtFecha(item.fechaEvento)}
                                </span>
                              </div>
                              <div className="space-y-1 px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-20 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Realizado por
                                  </span>
                                  <div className="text-foreground/80 flex items-center gap-1">
                                    <UserRound className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                    <span>{item.nombreUsuario || `Usuario ${item.idUsuario}`}</span>
                                  </div>
                                </div>
                                {showTrans && (
                                  <div className="flex items-center gap-2">
                                    <span className="w-20 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Movimiento
                                    </span>
                                    <div className="text-foreground/80 flex items-center gap-1">
                                      <MoveRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                                      <span>
                                        {transFrom && (
                                          <>
                                            <span className="text-foreground/60">{transFrom}</span>
                                            <span className="mx-1 text-muted-foreground">→</span>
                                          </>
                                        )}
                                        <span className="font-medium">{transTo}</span>
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {item.comentario && (
                                  <div className="border-border/60 bg-muted/60 mt-2 rounded-md border px-3 py-2.5 shadow-sm">
                                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Comentario
                                    </p>
                                    <p className="text-foreground/90 text-[11px] italic leading-relaxed">
                                      {item.comentario}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-1 text-muted-foreground">Sin actividad registrada</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
