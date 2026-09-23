import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { InlineLoader } from '@/components/ui/inline-loader';
import { SolicitudHeaderCard } from './SolicitudHeaderCard';
import { SolicitudDetalleTab } from './SolicitudDetalleTab';
import { CrearSolicitud } from './CrearSolicitud';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { API } from '@/shared/api/apiClient';
import { calendarioApi, misIncidenciasChecadoApi, misDiasJornadaApi, diasHabilesApi } from '../services/rh.api';
import type { ApiResponse } from '@/types/api.types';
import type {
  CalendarioGlobalEvento,
  DiasJornadaResponse,
  IncidenciaChecadoResponse,
  SolicitudPersonalResponse,
} from '@/types/solicitudPersonal.types';
import type { DiaHabilResponse } from '@/types/vacaciones.types';

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
      dot: 'bg-cyan-500',
      bg: 'bg-cyan-50 dark:bg-cyan-950/30',
      border: 'border-cyan-200 dark:border-cyan-900/50',
      text: 'text-cyan-800 dark:text-cyan-300',
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
    '5': {
      dot: 'bg-rose-500',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-200 dark:border-rose-900/50',
      text: 'text-rose-800 dark:text-rose-300',
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
  esDescanso: boolean;
  esDiaNoLaborable: boolean;
  noHabilDescripcion?: string;
  incidencia?: IncidenciaChecadoResponse;
}

function tieneIncidenciaReal(incidencia: IncidenciaChecadoResponse) {
  return (incidencia.incidenciasCalculadas ?? []).length > 0;
}

function useCalendario(anio: number, mes: number) {
  const [eventos, setEventos] = useState<CalendarioGlobalEvento[]>([]);
  const [diasJornada, setDiasJornada] = useState<DiasJornadaResponse | null>(null);
  const [diasHabiles, setDiasHabiles] = useState<DiaHabilResponse[]>([]);
  const [incidencias, setIncidencias] = useState<IncidenciaChecadoResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalendario = async () => {
    try {
      setLoading(true);
      const [calRes, jornadaRes, habilesRes, incRes] = await Promise.all([
        calendarioApi.get({ anio, mes }),
        misDiasJornadaApi.get({ anio, mes }).catch(() => null),
        diasHabilesApi.get({ anio, mes }).catch(() => null),
        misIncidenciasChecadoApi.get({ anio, mes }).catch(() => null),
      ]);
      if (calRes.data.success) {
        setEventos(calRes.data.data ?? []);
      } else {
        setEventos([]);
      }
      if (jornadaRes?.data.success) {
        setDiasJornada(jornadaRes.data.data ?? null);
      } else {
        setDiasJornada(null);
      }
      if (habilesRes?.data.success) {
        setDiasHabiles(habilesRes.data.data ?? []);
      } else {
        setDiasHabiles([]);
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
      setDiasJornada(null);
      setDiasHabiles([]);
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
    const descansosSet = new Set<string>();
    const noHabilesPorFecha = new Map<string, string>();

    const jornadaPorDia: Record<number, boolean> = {
      0: diasJornada?.domingo ?? true,
      1: diasJornada?.lunes ?? true,
      2: diasJornada?.martes ?? true,
      3: diasJornada?.miercoles ?? true,
      4: diasJornada?.jueves ?? true,
      5: diasJornada?.viernes ?? true,
      6: diasJornada?.sabado ?? true,
    };

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

    diasHabiles.forEach((d) => {
      if (d.consumeSaldo) return;
      const key = new Date(d.fecha).toISOString().split('T')[0];
      noLaborablesSet.add(key);
      if (d.descripcion) {
        noHabilesPorFecha.set(key, d.descripcion);
      }
    });

    for (let i = 0; i < totalCeldas; i++) {
      const fecha = new Date(anio, mes - 1, 1 - diasAnteriores + i);
      const key = fecha.toISOString().split('T')[0];
      const trabaja = jornadaPorDia[fecha.getDay()];
      if (!trabaja) {
        descansosSet.add(key);
      }

      resultado.push({
        fecha,
        eventos: eventosPorFecha.get(key) ?? [],
        esActual: fecha.getMonth() === inicioMes.getMonth(),
        esHoy: isSameDay(fecha, hoy),
        esDescanso: descansosSet.has(key),
        esDiaNoLaborable: noLaborablesSet.has(key),
        noHabilDescripcion: noHabilesPorFecha.get(key),
        incidencia: incidenciasPorFecha.get(key),
      });
    }

    return resultado;
  }, [eventos, diasJornada, diasHabiles, incidencias, anio, mes]);

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
  const esCanceladaORechazada = evento.estado === 'CANCELADA' || evento.estado === 'RECHAZADA';

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${evento.tipo} · ${evento.folio} · ${evento.estado}`}
      style={
        evento.estadoColor
          ? { borderLeftWidth: '3px', borderLeftColor: evento.estadoColor }
          : undefined
      }
      className={cn(
        'mb-1 flex w-full items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-xs leading-tight transition-colors hover:brightness-95',
        style.bg,
        style.border,
        style.text,
        isPast && 'opacity-60',
        esCanceladaORechazada && 'opacity-50 line-through'
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
      <span className="truncate">
        {evento.tipo} · {evento.folio}
      </span>
    </button>
  );
}

function IncidenciaBadge({
  isPast,
  onClick,
  label,
}: {
  isPast: boolean;
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label ?? 'Incidencia de checado'}
      className={cn(
        'mb-1 flex w-full items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-xs leading-tight transition-colors hover:brightness-95',
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
        isPast && 'opacity-60'
      )}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      <span className="truncate">{label ?? 'Incidencia'}</span>
    </button>
  );
}

export function IncidenciaModal({
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

  const incidencias = incidencia.incidenciasCalculadas ?? [];

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
        ) : incidencia.enTramite ? (
          <div className="flex items-center gap-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <Clock className="h-4 w-4" />
            <span className="font-semibold">En trámite</span>
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

        {incidencia.descuento && (
          <div className="flex items-center gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold">Genera descuento en nómina</span>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipos de incidencia
          </h4>
          <div className="flex flex-wrap gap-2">
            {incidencias.length === 0 ? (
              <span className="text-sm text-muted-foreground">-</span>
            ) : (
              incidencias.map((inc) => (
                <Badge key={inc.tipoIncidencia} variant="outline">
                  {inc.nombre}
                </Badge>
              ))
            )}
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

        {!incidencia.justificada && !incidencia.enTramite && (
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" onClick={onAddSolicitud}>
              <Plus className="mr-1.5 h-4 w-4" />
              Justificar incidencia
            </Button>
          </div>
        )}
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

export function MiCalendario({ onSolicitudGuardada }: { onSolicitudGuardada?: () => void } = {}) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] =
    useState<IncidenciaChecadoResponse | null>(null);
  const [incidenciaParaSolicitud, setIncidenciaParaSolicitud] =
    useState<IncidenciaChecadoResponse | null>(null);
  const [solicitudModalOpen, setSolicitudModalOpen] = useState(false);
  const [confirmCloseCrear, setConfirmCloseCrear] = useState(false);
  const crearDirtyRef = useRef(false);
  const { dias, loading, refetch } = useCalendario(anio, mes);

  const handleAddSolicitud = () => {
    setIncidenciaParaSolicitud(incidenciaSeleccionada);
    setIncidenciaSeleccionada(null);
    crearDirtyRef.current = false;
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
              Solicitudes por día desde su creación (incluye canceladas y rechazadas). Haz clic en un evento para ver el detalle.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleHoy}>
              Hoy
            </Button>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                className="h-8 w-8"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="h-8 w-8"
                aria-label="Mes siguiente"
              >
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
                      label={dia.incidencia.incidenciasCalculadas?.[0]?.nombre}
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
                      dia.esDiaNoLaborable && 'bg-red-50/40 dark:bg-red-950/20',
                      !dia.esDiaNoLaborable && dia.esDescanso && 'bg-slate-100/70 dark:bg-slate-900/40'
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          dia.esHoy && 'ring-primary/20 bg-primary text-primary-foreground ring-2',
                          dia.esDiaNoLaborable &&
                            !dia.esHoy &&
                            'font-semibold text-red-600 dark:text-red-400',
                          !dia.esDiaNoLaborable &&
                            dia.esDescanso &&
                            !dia.esHoy &&
                            'font-semibold text-slate-600 dark:text-slate-400'
                        )}
                        title={
                          dia.esDiaNoLaborable
                            ? (dia.noHabilDescripcion ?? 'Día no laborable')
                            : dia.esDescanso
                              ? 'Día de descanso según tu jornada'
                              : undefined
                        }
                      >
                        {dia.fecha.getDate()}
                      </span>
                    </div>

                    {dia.esDiaNoLaborable ? (
                      <div className="mb-1 rounded bg-red-100 px-1.5 py-0.5 text-center text-xs font-semibold uppercase tracking-wide text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        {dia.noHabilDescripcion ?? 'No laborable'}
                      </div>
                    ) : dia.esDescanso ? (
                      <div className="mb-1 rounded bg-slate-200 px-1.5 py-0.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        Descanso
                      </div>
                    ) : null}

                    <div className="flex flex-col">
                      {visibles}

                      {ocultos.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="hover:bg-muted/80 mt-0.5 w-full rounded bg-muted px-1.5 py-0.5 text-left text-xs font-medium text-muted-foreground transition-colors"
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

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Tipos de solicitud:</span>
              {Object.entries({
                '1': 'Incidencia',
                '2': 'Permiso',
                '3': 'Vacaciones',
                '4': 'Goce de Sueldo',
                '5': 'Incapacidad',
              }).map(([key, label]) => {
                const style = getCategoriaStyle(key);
                return (
                  <span key={key} className="flex items-center gap-1">
                    <span className={cn('h-2 w-2 rounded-full', style.dot)} />
                    {label}
                  </span>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Días:</span>
              <span
                className="flex items-center gap-1"
                title="Día de descanso según tu jornada laboral"
              >
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Descanso (tu jornada)
              </span>
              <span
                className="flex items-center gap-1"
                title="Día no laborable (festivo o inhábil)"
              >
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Día no laborable
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Incidencias:</span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Incidencia de checado
              </span>
            </div>
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
        beforeClose={() => {
          if (!crearDirtyRef.current) return true;
          setConfirmCloseCrear(true);
          return false;
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
          onDirtyChange={(dirty) => {
            crearDirtyRef.current = dirty;
          }}
          onClose={() => setSolicitudModalOpen(false)}
          onSaved={() => {
            setSolicitudModalOpen(false);
            setIncidenciaParaSolicitud(null);
            refetch();
            onSolicitudGuardada?.();
          }}
        />
      </Modal>

      <AlertDialog open={confirmCloseCrear} onOpenChange={setConfirmCloseCrear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes datos capturados en la solicitud. Si cierras ahora, se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                crearDirtyRef.current = false;
                setConfirmCloseCrear(false);
                setSolicitudModalOpen(false);
              }}
            >
              Cerrar sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default MiCalendario;
