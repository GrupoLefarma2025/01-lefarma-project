import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  FileText,
  AlertTriangle,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { InlineLoader } from '@/components/ui/inline-loader';
import { SolicitudHeaderCard } from './SolicitudHeaderCard';
import { SolicitudDetalleTab } from './SolicitudDetalleTab';
import { CrearSolicitud } from './CrearSolicitud';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { API } from '@/shared/api/apiClient';
import { calendarioApi, calendarioLaboralApi, misIncidenciasChecadoApi } from '../services/rh.api';
import type { ApiResponse } from '@/types/api.types';
import type {
  CalendarioGlobalEvento,
  CalendarioLaboralResponse,
  IncidenciaChecadoResponse,
  SolicitudPersonalResponse,
} from '@/types/solicitudPersonal.types';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const CATEGORIA_STYLES: Record<string, { dot: string; bg: string; border: string; text: string }> =
  {
    '1': {
      dot: 'bg-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-900/50',
      text: 'text-emerald-800 dark:text-emerald-300',
    },
    '2': {
      dot: 'bg-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-900/50',
      text: 'text-amber-800 dark:text-amber-300',
    },
    '3': {
      dot: 'bg-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-blue-200 dark:border-blue-900/50',
      text: 'text-blue-800 dark:text-blue-300',
    },
    '4': {
      dot: 'bg-violet-500',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
      border: 'border-violet-200 dark:border-violet-900/50',
      text: 'text-violet-800 dark:text-violet-300',
    },
  };

function formatHora(valor?: string | null) {
  if (!valor) return '-';
  const partes = valor.split(':');
  return partes.length >= 2 ? `${partes[0]}:${partes[1]}` : valor;
}

function getCategoriaStyle(categoria: string) {
  return (
    CATEGORIA_STYLES[categoria] ?? {
      dot: 'bg-slate-500',
      bg: 'bg-slate-50 dark:bg-slate-950/30',
      border: 'border-slate-200 dark:border-slate-800',
      text: 'text-slate-800 dark:text-slate-300',
    }
  );
}

function getEstadoInfo(
  solicitud:
    | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
    | null
    | undefined
) {
  if (!solicitud) return { nombre: 'Desconocido', color: '#94a3b8' };
  return {
    nombre: solicitud.estadoNombre ?? `Estado ${solicitud.idEstado ?? '?'}`,
    color: solicitud.estadoColor ?? '#94a3b8',
  };
}

function toLocalMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMesAnio(anio: number, mes: number) {
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  });
}

interface DiaCelda {
  fecha: Date;
  eventos: CalendarioGlobalEvento[];
  esActual: boolean;
  esHoy: boolean;
  esNoLaborable: boolean;
  incidencia?: IncidenciaChecadoResponse;
}

function tieneIncidenciaReal(incidencia: IncidenciaChecadoResponse) {
  return (
    incidencia.incidenciaEntrada?.trim() ||
    incidencia.incidenciaSalida?.trim() ||
    incidencia.msgError?.trim()
  );
}

function useCalendario(anio: number, mes: number) {
  const [eventos, setEventos] = useState<CalendarioGlobalEvento[]>([]);
  const [diasCalendario, setDiasCalendario] = useState<CalendarioLaboralResponse[]>([]);
  const [incidencias, setIncidencias] = useState<IncidenciaChecadoResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalendario = async () => {
    try {
      setLoading(true);
      const [calRes, nolabRes, incRes] = await Promise.all([
        calendarioApi.get({ anio, mes, estados: ['CERRADA'] }),
        calendarioLaboralApi.get({ anio, mes }).catch(() => null),
        misIncidenciasChecadoApi.get({ anio, mes }).catch(() => null),
      ]);
      if (calRes.data.success) {
        setEventos(calRes.data.data ?? []);
      } else {
        setEventos([]);
      }
      if (nolabRes?.data.success) {
        setDiasCalendario(nolabRes.data.data ?? []);
      } else {
        setDiasCalendario([]);
      }
      if (incRes?.data.success) {
        setIncidencias(incRes.data.data ?? []);
      } else {
        setIncidencias([]);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      if (err.statusCode !== 403) {
        toast.error(err.message ?? 'No se pudo cargar el calendario de solicitudes.');
      }
      setEventos([]);
      setDiasCalendario([]);
      setIncidencias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendario();
  }, [anio, mes]);

  const dias = useMemo(() => {
    const hoy = toLocalMidnight(new Date());
    const inicioMes = new Date(anio, mes - 1, 1);
    const finMes = new Date(anio, mes, 0);
    const primerDiaSemana = inicioMes.getDay();
    const totalDias = finMes.getDate();

    const diasAnteriores = primerDiaSemana;
    const totalCeldas = Math.ceil((diasAnteriores + totalDias) / 7) * 7;

    const resultado: DiaCelda[] = [];
    const eventosPorFecha = new Map<string, CalendarioGlobalEvento[]>();
    const incidenciasPorFecha = new Map<string, IncidenciaChecadoResponse>();
    const noLaborablesSet = new Set<string>();

    eventos.forEach((e) => {
      const key = new Date(e.fecha).toISOString().split('T')[0];
      if (!eventosPorFecha.has(key)) eventosPorFecha.set(key, []);
      eventosPorFecha.get(key)!.push(e);
    });

    incidencias.forEach((i) => {
      const fechaInc = toLocalMidnight(new Date(i.fecha));
      if (fechaInc > hoy) return;
      if (!tieneIncidenciaReal(i)) return;
      const key = fechaInc.toISOString().split('T')[0];
      incidenciasPorFecha.set(key, i);
    });

    diasCalendario.forEach((d) => {
      const key = new Date(d.fecha).toISOString().split('T')[0];
      if (!d.laborable) {
        noLaborablesSet.add(key);
      }
    });

    for (let i = 0; i < totalCeldas; i++) {
      const fecha = new Date(anio, mes - 1, 1 - diasAnteriores + i);
      const key = fecha.toISOString().split('T')[0];
      resultado.push({
        fecha,
        eventos: eventosPorFecha.get(key) ?? [],
        esActual: fecha.getMonth() === inicioMes.getMonth(),
        esHoy: isSameDay(fecha, hoy),
        esNoLaborable: noLaborablesSet.has(key),
        incidencia: incidenciasPorFecha.get(key),
      });
    }

    return resultado;
  }, [eventos, diasCalendario, incidencias, anio, mes]);

  return { dias, loading, refetch: fetchCalendario };
}

function EventoBadge({
  evento,
  isPast,
  onClick,
}: {
  evento: CalendarioGlobalEvento;
  isPast: boolean;
  onClick?: () => void;
}) {
  const style = getCategoriaStyle(evento.categoria);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1 flex w-full items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-[10px] leading-tight transition-colors hover:brightness-95',
        style.bg,
        style.border,
        style.text,
        isPast && 'opacity-60'
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
      <span className="truncate">
        {evento.tipo} · {evento.folio}
      </span>
    </button>
  );
}

function IncidenciaBadge({ isPast, onClick }: { isPast: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1 flex w-full items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-[10px] leading-tight transition-colors hover:brightness-95',
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
        isPast && 'opacity-60'
      )}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span className="truncate">Incidencia</span>
    </button>
  );
}

function IncidenciaModal({
  incidencia,
  open,
  onClose,
  onAddSolicitud,
}: {
  incidencia: IncidenciaChecadoResponse | null;
  open: boolean;
  onClose: () => void;
  onAddSolicitud: () => void;
}) {
  if (!incidencia) return null;

  const incidencias: { label: string; text: string; tipo: 'entrada' | 'salida' | 'omision' }[] = [];
  if (incidencia.incidenciaEntrada?.trim()) {
    incidencias.push({ label: 'Entrada', text: incidencia.incidenciaEntrada, tipo: 'entrada' });
  }
  if (incidencia.incidenciaSalida?.trim()) {
    incidencias.push({ label: 'Salida', text: incidencia.incidenciaSalida, tipo: 'salida' });
  }
  if (incidencia.msgError?.trim()) {
    incidencias.push({ label: 'Omisión', text: incidencia.msgError, tipo: 'omision' });
  }

  return (
    <Modal
      id="modal-incidencia-calendario"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span>Incidencia de checado</span>
        </div>
      }
      size="md"
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-base font-medium">
            {incidencia.nombreDiaSemana ?? ''},{' '}
            {new Date(incidencia.fecha).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {incidencia.nombre} · Nómina {incidencia.nomina}
          </p>
        </div>

        {incidencia.justificada ? (
          <div className="flex items-center gap-2 rounded bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold">Justificada</span>
            {incidencia.tipoSolicitudNombre && (
              <span className="text-muted-foreground">· {incidencia.tipoSolicitudNombre}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <XCircle className="h-4 w-4" />
            <span className="font-semibold">Pendiente de justificar</span>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Detalle de incidencias
          </h4>
          <div className="grid gap-2">
            {incidencias.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'rounded px-3 py-2 text-sm',
                  item.tipo === 'omision'
                    ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                )}
              >
                <span className="font-semibold">{item.label}:</span> {item.text}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Horarios
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 rounded bg-muted px-3 py-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Entrada</span>
                <span>{formatHora(incidencia.entrada)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded bg-muted px-3 py-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Salida</span>
                <span>{formatHora(incidencia.salida)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">Registró entrada</span>
              <span>{formatHora(incidencia.entro)}</span>
            </div>
            <div className="flex items-center gap-2 rounded bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground">Registró salida</span>
              <span>{formatHora(incidencia.salio)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" onClick={onAddSolicitud}>
            <Plus className="mr-1.5 h-4 w-4" />
            Añadir solicitud
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DetalleModal({
  idSolicitud,
  open,
  onClose,
}: {
  idSolicitud: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [solicitud, setSolicitud] = useState<SolicitudPersonalResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !idSolicitud) {
      setSolicitud(null);
      return;
    }

    const fetchDetalle = async () => {
      try {
        setLoading(true);
        const response = await API.get<ApiResponse<SolicitudPersonalResponse>>(
          `/solicitudes-personal/${idSolicitud}`
        );
        if (response.data.success) {
          setSolicitud(response.data.data);
        } else {
          setSolicitud(null);
        }
      } catch (error: unknown) {
        const err = toApiError(error);
        toast.error(err.message ?? 'No se pudo cargar el detalle de la solicitud.');
        setSolicitud(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetalle();
  }, [open, idSolicitud]);

  return (
    <Modal
      id="modal-detalle-calendario"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <span>Detalle de solicitud</span>
        </div>
      }
      size="full"
    >
      {solicitud && (
        <div className="mb-4">
          <SolicitudHeaderCard solicitud={solicitud} getEstadoInfo={getEstadoInfo} />
        </div>
      )}
      {loading && <InlineLoader message="Cargando detalle de la solicitud..." />}
      {!loading && !solicitud && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No se pudo cargar el detalle</p>
        </div>
      )}
      {!loading && solicitud && <SolicitudDetalleTab solicitud={solicitud} />}
    </Modal>
  );
}

export function MiCalendario() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] =
    useState<IncidenciaChecadoResponse | null>(null);
  const [incidenciaParaSolicitud, setIncidenciaParaSolicitud] =
    useState<IncidenciaChecadoResponse | null>(null);
  const [solicitudModalOpen, setSolicitudModalOpen] = useState(false);
  const { dias, loading, refetch } = useCalendario(anio, mes);

  const handleAddSolicitud = () => {
    setIncidenciaParaSolicitud(incidenciaSeleccionada);
    setIncidenciaSeleccionada(null);
    setSolicitudModalOpen(true);
  };

  const handleHoy = () => {
    setAnio(hoy.getFullYear());
    setMes(hoy.getMonth() + 1);
  };

  const handlePrev = () => {
    const nueva = new Date(anio, mes - 2, 1);
    setAnio(nueva.getFullYear());
    setMes(nueva.getMonth() + 1);
  };

  const handleNext = () => {
    const nueva = new Date(anio, mes, 1);
    setAnio(nueva.getFullYear());
    setMes(nueva.getMonth() + 1);
  };

  const meses = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: new Date(2000, i, 1).toLocaleDateString('es-MX', { month: 'long' }),
      })),
    []
  );

  const anioActual = hoy.getFullYear();
  const anios = useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => String(anioActual - 5 + i));
  }, [anioActual]);

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-col gap-4 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Mi calendario de solicitudes
            </CardTitle>
            <CardDescription className="text-xs">
              Solicitudes cerradas por día. Haz clic en un evento para ver el detalle.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleHoy}>
              Hoy
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="h-8 w-32 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="capitalize">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anios.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={refetch}
              disabled={loading}
              className="h-8 w-8"
              aria-label="Refrescar calendario"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-semibold capitalize">{formatMesAnio(anio, mes)}</h3>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs font-medium text-muted-foreground">
            {DIAS_SEMANA.map((dia) => (
              <div key={dia} className="bg-muted px-2 py-2 text-center uppercase tracking-wide">
                {dia}
              </div>
            ))}
          </div>

          {loading && dias.length === 0 ? (
            <div className="mt-2 grid grid-cols-7 gap-px rounded-lg border bg-border">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[100px] bg-card p-2 sm:min-h-[120px]">
                  <Skeleton className="mb-2 h-4 w-6" />
                  <Skeleton className="mb-1 h-5 w-full" />
                  <Skeleton className="mb-1 h-5 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-7 gap-px rounded-lg border bg-border">
              {dias.map((dia, idx) => {
                const hoyLocal = toLocalMidnight(new Date());
                const isPast = dia.fecha < hoyLocal;

                const items: React.ReactNode[] = [];
                if (dia.incidencia) {
                  items.push(
                    <IncidenciaBadge
                      key={`incidencia-${dia.fecha.toISOString()}`}
                      isPast={isPast}
                      onClick={() => setIncidenciaSeleccionada(dia.incidencia!)}
                    />
                  );
                }
                dia.eventos.forEach((e) => {
                  items.push(
                    <EventoBadge
                      key={`${e.idSolicitud}-${e.fecha}`}
                      evento={e}
                      isPast={isPast}
                      onClick={() => setDetalleId(e.idSolicitud)}
                    />
                  );
                });

                const visibles = items.slice(0, 3);
                const ocultos = items.slice(3);

                return (
                  <div
                    key={idx}
                    className={cn(
                      'relative min-h-[100px] bg-card p-1.5 transition-colors sm:min-h-[120px] sm:p-2',
                      dia.esHoy && 'bg-primary/5',
                      dia.esNoLaborable && 'bg-red-50/40 dark:bg-red-950/20'
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          dia.esHoy && 'ring-primary/20 bg-primary text-primary-foreground ring-2',
                          dia.esNoLaborable &&
                            !dia.esHoy &&
                            'font-semibold text-red-600 dark:text-red-400'
                        )}
                        title={dia.esNoLaborable ? 'Día no laborable' : undefined}
                      >
                        {dia.fecha.getDate()}
                      </span>
                    </div>

                    {dia.esNoLaborable && (
                      <div className="mb-1 rounded bg-red-100 px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        No laborable
                      </div>
                    )}

                    <div className="flex flex-col">
                      {visibles}

                      {ocultos.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="hover:bg-muted/80 mt-0.5 w-full rounded bg-muted px-1.5 py-0.5 text-left text-[10px] font-medium text-muted-foreground transition-colors"
                            >
                              +{ocultos.length} más
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 space-y-2 p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              {dia.fecha.toLocaleDateString('es-MX', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                              })}
                            </p>
                            <div className="flex flex-col">
                              {items.map((item, i) => (
                                <React.Fragment key={i}>{item}</React.Fragment>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">Categorías:</span>
            {Object.entries({
              '1': 'Incidencia',
              '2': 'Permiso',
              '3': 'Vacaciones',
              '4': 'Goce de Sueldo',
            }).map(([key, label]) => {
              const style = getCategoriaStyle(key);
              return (
                <span key={key} className="flex items-center gap-1">
                  <span className={cn('h-2 w-2 rounded-full', style.dot)} />
                  {label}
                </span>
              );
            })}
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Día no laborable
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              Incidencia de checado
            </span>
          </div>
        </CardContent>
      </Card>

      <DetalleModal
        idSolicitud={detalleId}
        open={detalleId !== null}
        onClose={() => setDetalleId(null)}
      />

      <IncidenciaModal
        incidencia={incidenciaSeleccionada}
        open={incidenciaSeleccionada !== null}
        onClose={() => setIncidenciaSeleccionada(null)}
        onAddSolicitud={handleAddSolicitud}
      />

      <Modal
        id="modal-crear-solicitud-calendario"
        open={solicitudModalOpen}
        setOpen={(o) => {
          if (!o) setSolicitudModalOpen(false);
        }}
        title={
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <span>Crear solicitud</span>
          </div>
        }
        size="full"
      >
        <CrearSolicitud
          incidencia={incidenciaParaSolicitud}
          fechaInicial={incidenciaParaSolicitud?.fecha}
          onClose={() => setSolicitudModalOpen(false)}
          onSaved={() => {
            setSolicitudModalOpen(false);
            setIncidenciaParaSolicitud(null);
            refetch();
          }}
        />
      </Modal>
    </>
  );
}

export default MiCalendario;
