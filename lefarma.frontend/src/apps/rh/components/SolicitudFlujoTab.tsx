import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  XCircle,
  Undo2,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  UserRound,
  Clock,
  Ban,
  Circle,
} from 'lucide-react';
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

const fmtFechaCorta = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

interface SnapshotData {
  omisionAutomatica?: boolean;
  motivo?: string | null;
  idPasoOmitido?: number | null;
  idPasoDestinoSalto?: number | null;
  idPasoAnterior?: number | null;
  idPasoNuevo?: number | null;
  idEstadoNuevo?: number | null;
  datosAdicionales?: unknown;
}

const parseSnapshot = (raw?: string | null): SnapshotData | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SnapshotData;
  } catch {
    return null;
  }
};

const ESTADOS_TERMINALES = ['cerrada', 'rechazada', 'cancelada'];

const isEstadoTerminal = (nombre?: string | null) => {
  if (!nombre) return false;
  return ESTADOS_TERMINALES.some((c) => nombre.toLowerCase().includes(c));
};

const getEstadoTerminal = (nombre?: string | null): 'cerrada' | 'rechazada' | 'cancelada' | null => {
  if (!nombre) return null;
  const n = nombre.toLowerCase();
  if (n.includes('rechaz')) return 'rechazada';
  if (n.includes('cancel')) return 'cancelada';
  if (n.includes('cerr')) return 'cerrada';
  return null;
};

const inferirEstadoTerminalDesdeEvento = (
  nombreAccion?: string | null
): 'cerrada' | 'rechazada' | 'cancelada' | null => {
  const n = (nombreAccion || '').toLowerCase();
  if (n.includes('rechaz')) return 'rechazada';
  if (n.includes('cancel')) return 'cancelada';
  if (n.includes('cerr')) return 'cerrada';
  return null;
};

const getTipoEvento = (
  nombreAccion?: string | null
): 'rechazo' | 'retorno' | 'autorizacion' | 'otro' => {
  const n = (nombreAccion || '').toLowerCase();
  if (n.includes('rechaz')) return 'rechazo';
  if (n.includes('devuelv') || n.includes('retorn')) return 'retorno';
  if (n.includes('autor') || n.includes('aprob') || n.includes('envi') || n.includes('firm') || n.includes('paga') || n.includes('tesor') || n.includes('comprob'))
    return 'autorizacion';
  return 'otro';
};

interface PasoTimelineItem {
  tipo: 'paso';
  paso: WorkflowPasoFlowResponse;
  eventos: HistorialWorkflowItemResponse[];
  ultimoEvento?: HistorialWorkflowItemResponse;
  isActual: boolean;
  isRetorno: boolean;
  pasoOrigenRetorno?: string;
  estadoTerminal?: 'cerrada' | 'rechazada' | 'cancelada' | null;
}

interface OmitidosTimelineItem {
  tipo: 'omitidos';
  pasos: WorkflowPasoFlowResponse[];
  eventos: HistorialWorkflowItemResponse[];
}

interface NoAplicaTimelineItem {
  tipo: 'noAplica';
  pasos: WorkflowPasoFlowResponse[];
}

type TimelineItem = PasoTimelineItem | OmitidosTimelineItem | NoAplicaTimelineItem;

interface SolicitudFlujoTabProps {
  solicitud: SolicitudPersonalResponse;
  pasosWorkflow: WorkflowPasoFlowResponse[];
  historial: HistorialWorkflowItemResponse[];
}

export function SolicitudFlujoTab({ solicitud, pasosWorkflow, historial }: SolicitudFlujoTabProps) {
  const [expandedHistorial, setExpandedHistorial] = useState<Set<number>>(new Set());
  const [expandedOmitidos, setExpandedOmitidos] = useState<Set<number>>(new Set());
  const [expandedNoAplica, setExpandedNoAplica] = useState<Set<number>>(new Set());

  const pasosOrdenados = useMemo(
    () => [...pasosWorkflow].sort((a, b) => a.orden - b.orden),
    [pasosWorkflow]
  );

  const pasosPorId = useMemo(() => {
    const map = new Map<number, WorkflowPasoFlowResponse>();
    for (const p of pasosOrdenados) map.set(p.idPaso, p);
    return map;
  }, [pasosOrdenados]);

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

  const eventosOmision = useMemo(() => {
    return historial.filter((h) => parseSnapshot(h.datosSnapshot)?.omisionAutomatica === true);
  }, [historial]);

  const pasosOmitidosIds = useMemo(() => {
    const ids = new Set<number>();
    for (const e of eventosOmision) {
      const snap = parseSnapshot(e.datosSnapshot);
      if (snap?.idPasoOmitido) ids.add(snap.idPasoOmitido);
    }
    return ids;
  }, [eventosOmision]);

  const pasoDetencion = useMemo(() => {
    const eventosDetenidos = historial.filter((h) => {
      const tipo = getTipoEvento(h.nombreAccion);
      const nombre = (h.nombreAccion || '').toLowerCase();
      const esCancelacion = nombre.includes('cancel');
      return tipo === 'rechazo' || esCancelacion;
    });
    if (eventosDetenidos.length === 0) return null;
    const ultimoDetenido = [...eventosDetenidos].sort(
      (a, b) => new Date(b.fechaEvento).getTime() - new Date(a.fechaEvento).getTime()
    )[0];
    return pasosOrdenados.find((p) => p.idPaso === ultimoDetenido.idPaso) ?? null;
  }, [historial, pasosOrdenados]);

  const isSolicitudTerminal = useMemo(
    () =>
      isEstadoTerminal(solicitud.estadoNombre) ||
      pasosOrdenados.some((p) => p.idPaso === solicitud.idPasoActual && p.esFinal) ||
      pasoDetencion != null,
    [solicitud.estadoNombre, solicitud.idPasoActual, pasosOrdenados, pasoDetencion]
  );

  const indexPasoActual = useMemo(() => {
    return pasosOrdenados.findIndex((p) => p.idPaso === solicitud.idPasoActual);
  }, [pasosOrdenados, solicitud.idPasoActual]);

  const comentariosPorPaso = useMemo(() => {
    const map = new Map<number, string>();
    const ordenados = [...historial].sort(
      (a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime()
    );

    for (const evento of ordenados) {
      if (!evento.comentario) continue;
      const snap = parseSnapshot(evento.datosSnapshot);
      const idPasoAnterior = snap?.idPasoAnterior;
      const idPasoNuevo = snap?.idPasoNuevo;

      if (idPasoAnterior != null && idPasoNuevo != null && idPasoAnterior !== idPasoNuevo) {
        map.set(idPasoAnterior, evento.comentario);
      } else if (idPasoAnterior == null && idPasoNuevo != null) {
        map.set(idPasoNuevo, evento.comentario);
      } else {
        map.set(evento.idPaso, evento.comentario);
      }
    }
    return map;
  }, [historial]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    let bufferOmitidos: WorkflowPasoFlowResponse[] = [];
    let bufferNoAplica: WorkflowPasoFlowResponse[] = [];

    const esPasoPosteriorAlFinal = (paso: WorkflowPasoFlowResponse) => {
      if (pasoDetencion) {
        const idx = pasosOrdenados.findIndex((p) => p.idPaso === paso.idPaso);
        const idxDetencion = pasosOrdenados.findIndex((p) => p.idPaso === pasoDetencion.idPaso);
        return idxDetencion !== -1 && idx > idxDetencion;
      }
      if (!isSolicitudTerminal) return false;
      const idx = pasosOrdenados.findIndex((p) => p.idPaso === paso.idPaso);
      return indexPasoActual !== -1 && idx > indexPasoActual;
    };

    const esPasoFinalNoActivo = (paso: WorkflowPasoFlowResponse) => {
      return paso.esFinal && paso.idPaso !== solicitud.idPasoActual;
    };

    const flushOmitidos = () => {
      if (bufferOmitidos.length === 0) return;
      const eventos = eventosOmision.filter((e) => {
        const snap = parseSnapshot(e.datosSnapshot);
        return snap?.idPasoOmitido && bufferOmitidos.some((p) => p.idPaso === snap.idPasoOmitido);
      });
      items.push({ tipo: 'omitidos', pasos: bufferOmitidos, eventos });
      bufferOmitidos = [];
    };

    const flushNoAplica = () => {
      if (bufferNoAplica.length === 0) return;
      items.push({ tipo: 'noAplica', pasos: bufferNoAplica });
      bufferNoAplica = [];
    };

    for (const paso of pasosOrdenados) {
      if (esPasoFinalNoActivo(paso)) continue;

      if (esPasoPosteriorAlFinal(paso)) {
        bufferNoAplica.push(paso);
        continue;
      }

      if (pasosOmitidosIds.has(paso.idPaso)) {
        bufferOmitidos.push(paso);
        continue;
      }

      const isPasoActual = solicitud.idPasoActual === paso.idPaso;
      const eventos = eventosPorPaso.get(paso.idPaso) ?? [];
      if (isSolicitudTerminal && !isPasoActual && eventos.length === 0) {
        bufferNoAplica.push(paso);
        continue;
      }

      flushNoAplica();
      flushOmitidos();

      const ultimoEvento = eventos[eventos.length - 1];
      let isRetorno = false;
      let pasoOrigenRetorno: string | undefined;

      if (ultimoEvento) {
        const snap = parseSnapshot(ultimoEvento.datosSnapshot);
        if (snap?.idPasoAnterior && snap?.idPasoNuevo) {
          const pasoAnterior = pasosPorId.get(snap.idPasoAnterior);
          const pasoNuevo = pasosPorId.get(snap.idPasoNuevo);
          if (pasoAnterior && pasoNuevo && pasoNuevo.orden < pasoAnterior.orden) {
            isRetorno = true;
            pasoOrigenRetorno = pasoAnterior.nombrePaso;
          }
        }
      }

      const isPasoDetencion = pasoDetencion?.idPaso === paso.idPaso;
      let estadoTerminal: PasoTimelineItem['estadoTerminal'] = null;
      if ((isPasoActual || isPasoDetencion) && isSolicitudTerminal) {
        estadoTerminal =
          getEstadoTerminal(solicitud.estadoNombre) ??
          (isPasoDetencion
            ? inferirEstadoTerminalDesdeEvento(ultimoEvento?.nombreAccion)
            : null);
      }
      items.push({
        tipo: 'paso',
        paso,
        eventos,
        ultimoEvento,
        isActual: isPasoActual,
        isRetorno,
        pasoOrigenRetorno,
        estadoTerminal,
      });
    }

    flushOmitidos();
    flushNoAplica();
    return items;
  }, [
    pasosOrdenados,
    pasosOmitidosIds,
    eventosPorPaso,
    eventosOmision,
    pasosPorId,
    solicitud.idPasoActual,
    solicitud.estadoNombre,
    isSolicitudTerminal,
    indexPasoActual,
    pasoDetencion,
  ]);

  const toggleHistorial = (idPaso: number) => {
    setExpandedHistorial((prev) => {
      const next = new Set(prev);
      if (next.has(idPaso)) next.delete(idPaso);
      else next.add(idPaso);
      return next;
    });
  };

  const toggleOmitidos = (key: number) => {
    setExpandedOmitidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleNoAplica = (key: number) => {
    setExpandedNoAplica((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (pasosWorkflow.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Línea de tiempo del workflow</p>
            <p className="text-xs text-muted-foreground">Trazabilidad paso a paso</p>
          </div>
        </div>
        <p className="rounded border bg-background p-3 text-xs text-muted-foreground">
          Esta solicitud no tiene un workflow configurado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header resumen */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Línea de tiempo del flujo</p>
          <p className="text-xs text-muted-foreground">Paso a paso de la solicitud</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {pasosOrdenados.length} paso(s)
        </Badge>
      </div>


      {/* Timeline */}
      <div className="relative max-h-[40rem] overflow-y-auto pr-1">
        <div className="absolute bottom-0 left-[1.15rem] top-3 w-px bg-border" />
        <div className="space-y-1">
          {timelineItems.map((item, idx) => {
            if (item.tipo === 'omitidos') {
              return (
                <OmitidosItem
                  key={`omitidos-${idx}`}
                  item={item}
                  isExpanded={expandedOmitidos.has(idx)}
                  onToggle={() => toggleOmitidos(idx)}
                />
              );
            }
            if (item.tipo === 'noAplica') {
              return (
                <NoAplicaItem
                  key={`noaplica-${idx}`}
                  item={item}
                  isExpanded={expandedNoAplica.has(idx)}
                  onToggle={() => toggleNoAplica(idx)}
                />
              );
            }
            return (
              <PasoItem
                key={item.paso.idPaso}
                item={item}
                pasosPorId={pasosPorId}
                comentariosPorPaso={comentariosPorPaso}
                isExpanded={expandedHistorial.has(item.paso.idPaso)}
                onToggle={() => toggleHistorial(item.paso.idPaso)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PasoItem({
  item,
  pasosPorId,
  comentariosPorPaso,
  isExpanded,
  onToggle,
}: {
  item: PasoTimelineItem;
  pasosPorId: Map<number, WorkflowPasoFlowResponse>;
  comentariosPorPaso: Map<number, string>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { paso, eventos, ultimoEvento, isActual, isRetorno, pasoOrigenRetorno, estadoTerminal } = item;
  const tipoUltimo = ultimoEvento ? getTipoEvento(ultimoEvento.nombreAccion) : null;

  const isTerminalCerrada = isActual && estadoTerminal === 'cerrada';
  const isTerminalRechazada = isActual && estadoTerminal === 'rechazada';
  const isTerminalCancelada = isActual && estadoTerminal === 'cancelada';
  const isCompletado =
    (!isActual && (tipoUltimo === 'autorizacion' || eventos.length > 0));
  const isRechazado = (!isActual && tipoUltimo === 'rechazo') || isTerminalRechazada;
  const isCancelado = isTerminalCancelada;
  const isCerrada = isTerminalCerrada;

  const isDevuelto = !isActual && (tipoUltimo === 'retorno' || isRetorno);
  const dotConfig = isCompletado
    ? { icon: CheckCircle2, className: 'bg-emerald-500 text-white border-emerald-500' }
    : isRechazado
      ? { icon: XCircle, className: 'bg-red-500 text-white border-red-500' }
      : isCancelado
        ? { icon: Ban, className: 'bg-stone-500 text-white border-stone-500' }
        : isCerrada
          ? { icon: CheckCircle2, className: 'bg-emerald-500 text-white border-emerald-500' }
          : isDevuelto
            ? { icon: Undo2, className: 'bg-amber-500 text-white border-amber-500' }
          : isActual
            ? { icon: null, className: 'bg-blue-500 border-blue-500' }
            : { icon: Circle, className: 'bg-background border-border text-muted-foreground' };

  const cardClass = isCompletado
    ? 'border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/10'
    : isRechazado
      ? 'border-l-red-400 bg-red-50/40 dark:bg-red-950/10'
      : isCancelado
        ? 'border-l-stone-400 bg-stone-50/40 dark:bg-stone-950/10'
        : isCerrada
          ? 'border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/10'
          : isDevuelto
            ? 'border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/10'
            : isActual
              ? 'border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/10'
              : 'border-l-border/60 bg-muted/20';

  const badge = isCompletado
    ? {
        variant: 'outline' as const,
        label: 'Completado',
        className: 'border-emerald-400 text-emerald-600 bg-emerald-50/50',
      }
    : isRechazado
      ? { variant: 'destructive' as const, label: 'Rechazado', className: '' }
      : isCancelado
        ? {
            variant: 'outline' as const,
            label: 'Cancelado',
            className: 'border-stone-400 text-stone-600 bg-stone-50/50',
          }
        : isCerrada
          ? { variant: 'outline' as const, label: 'Cerrado', className: 'border-emerald-400 text-emerald-600 bg-emerald-50/50' }
          : isActual
            ? { variant: 'secondary' as const, label: 'Actual', className: '' }
            : isDevuelto
              ? {
                  variant: 'outline' as const,
                  label: 'Devuelto',
                  className: 'border-amber-400 text-amber-600 bg-amber-50/50',
                }
              : { variant: 'outline' as const, label: 'En espera', className: 'text-muted-foreground' };

  const DotIcon = dotConfig.icon;
  const comentarioPaso = comentariosPorPaso.get(paso.idPaso);

  return (
    <div className="relative pl-10">
      {/* Dot */}
      <div
        className={`absolute left-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 ${dotConfig.className}`}
      >
        {isActual ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-full w-full rounded-full bg-white" />
          </span>
        ) : DotIcon ? (
          <DotIcon className="h-3 w-3" strokeWidth={2.5} />
        ) : null}
      </div>

      {/* Card */}
      <div className={`rounded-lg border border-l-4 p-3 text-xs ${cardClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
              {paso.orden}
            </span>
            <span className="font-medium text-foreground">{paso.nombrePaso}</span>
          </div>
          <Badge variant={badge.variant} className={`text-[10px] ${badge.className}`}>
            {badge.label}
          </Badge>
        </div>

        {paso.descripcionAyuda && (
          <p className="mt-1 text-[11px] text-muted-foreground">{paso.descripcionAyuda}</p>
        )}

        {/* Resumen último evento */}
        {ultimoEvento ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{fmtFecha(ultimoEvento.fechaEvento)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <UserRound className="h-3 w-3" />
              <span>{ultimoEvento.nombreUsuario || `Usuario ${ultimoEvento.idUsuario}`}</span>
            </div>
            {isDevuelto && pasoOrigenRetorno && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                <Undo2 className="h-3 w-3" />
                <span>Devuelto desde: {pasoOrigenRetorno}</span>
              </div>
            )}
            {comentarioPaso && (
              <div className="mt-1.5 rounded-md border border-border/60 bg-background/80 px-2.5 py-2 text-[11px] italic leading-relaxed text-foreground/90">
                "{comentarioPaso}"
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">Sin actividad registrada</p>
        )}

        {/* Historial completo */}
        {eventos.length > 1 && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-6 gap-1 px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {isExpanded ? 'Ocultar historial' : `Ver historial (${eventos.length - 1} más)`}
            </Button>

            {isExpanded && (
              <div className="mt-2 space-y-2">
                {eventos.slice(0, -1).map((evt) => (
                  <EventoCard key={evt.idEvento} evento={evt} pasosPorId={pasosPorId} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OmitidosItem({
  item,
  isExpanded,
  onToggle,
}: {
  item: OmitidosTimelineItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { pasos, eventos } = item;
  const cantidad = pasos.length;

  return (
    <div className="relative pl-10">
      <div className="absolute left-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 bg-background text-muted-foreground">
        <MoreHorizontal className="h-3 w-3" />
      </div>

      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Omitido
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {cantidad} paso{cantidad > 1 ? 's' : ''} omitido{cantidad > 1 ? 's' : ''}
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-2 pl-2">
            {pasos.map((paso) => {
              const evt = eventos.find((e) => {
                const snap = parseSnapshot(e.datosSnapshot);
                return snap?.idPasoOmitido === paso.idPaso;
              });
              return (
                <div
                  key={paso.idPaso}
                  className="rounded-md border border-l-2 border-l-border/60 bg-background/80 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-muted-foreground">{paso.nombrePaso}</span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Omitido
                    </Badge>
                  </div>
                  {evt && (
                    <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>{fmtFecha(evt.fechaEvento)}</span>
                      </div>
                      {evt.comentario && (
                        <p className="italic">{evt.comentario}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function NoAplicaItem({
  item,
  isExpanded,
  onToggle,
}: {
  item: NoAplicaTimelineItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { pasos } = item;
  const cantidad = pasos.length;

  return (
    <div className="relative pl-10">
      <div className="absolute left-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 bg-background text-muted-foreground">
        <Ban className="h-3 w-3" />
      </div>

      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  No aplica
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {cantidad} paso{cantidad > 1 ? 's' : ''} no aplica{cantidad > 1 ? 'n' : ''}
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-2 pl-2">
            {pasos.map((paso) => (
              <div
                key={paso.idPaso}
                className="rounded-md border border-l-2 border-l-border/60 bg-background/80 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-muted-foreground">{paso.nombrePaso}</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    No aplica
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function EventoCard({
  evento,
  pasosPorId,
}: {
  evento: HistorialWorkflowItemResponse;
  pasosPorId: Map<number, WorkflowPasoFlowResponse>;
}) {
  const snap = parseSnapshot(evento.datosSnapshot);
  const pasoOrigen = snap?.idPasoAnterior ? pasosPorId.get(snap.idPasoAnterior) : null;
  const pasoDestino = snap?.idPasoNuevo ? pasosPorId.get(snap.idPasoNuevo) : null;
  const showTrans = pasoOrigen && pasoDestino && pasoOrigen.idPaso !== pasoDestino.idPaso;

  return (
    <div className="rounded-md border bg-background/80 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">
          {evento.nombreAccion || `Acción ${evento.idAccion}`}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {fmtFecha(evento.fechaEvento)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <UserRound className="h-3 w-3" />
        <span>{evento.nombreUsuario || `Usuario ${evento.idUsuario}`}</span>
      </div>
      {showTrans && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          <span className="text-foreground/60">{pasoOrigen?.nombrePaso}</span>
          <span className="mx-1">→</span>
          <span className="font-medium text-foreground">{pasoDestino?.nombrePaso}</span>
        </div>
      )}
      {evento.comentario && (
        <p className="mt-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 text-[11px] italic leading-relaxed text-foreground/90">
          “{evento.comentario}”
        </p>
      )}
    </div>
  );
}
