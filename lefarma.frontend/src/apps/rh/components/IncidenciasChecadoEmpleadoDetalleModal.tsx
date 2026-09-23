import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { incidenciasChecadoApi, solicitudesPersonalApi } from '../services/rh.api';
import type {
  IncidenciaChecadoResponse,
  ReglasDescuentoResponse,
  SolicitudPersonalResponse,
} from '@/types/solicitudPersonal.types';
import { Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { SolicitudHeaderCard } from './SolicitudHeaderCard';
import { SolicitudDetalleTab } from './SolicitudDetalleTab';
import { ReglasDescuentoContenido } from './ReglasDescuentoContenido';
import {
  textoAcumulacion,
  textoAcumulacionDetalle,
  tooltipIncidencia,
} from '../utils/incidencias';

interface Props {
  open: boolean;
  onClose: () => void;
  nomina: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

function formatHora(valor?: string | null) {
  if (!valor) return '-';
  const partes = valor.split(':');
  return partes.length >= 2 ? `${partes[0]}:${partes[1]}` : valor;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function IncidenciasChecadoEmpleadoDetalleModal({
  open,
  onClose,
  nomina,
  nombre,
  fechaInicio,
  fechaFin,
}: Props) {
  const [data, setData] = useState<IncidenciaChecadoResponse[]>([]);
  const [loading, setLoading] = useState(open);
  const [solicitudModalOpen, setSolicitudModalOpen] = useState(false);
  const [solicitudLoading, setSolicitudLoading] = useState(false);
  const [solicitud, setSolicitud] = useState<SolicitudPersonalResponse | null>(null);
  const [reglas, setReglas] = useState<ReglasDescuentoResponse | null>(null);

  const getEstadoInfo = useCallback(
    (
      s?:
        | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
        | null
        | undefined
    ) => ({
      nombre: s?.estadoNombre || 'Desconocido',
      color: s?.estadoColor || '#94a3b8',
    }),
    []
  );

  const handleVerSolicitud = useCallback(async (idSolicitud: number) => {
    setSolicitudModalOpen(true);
    setSolicitudLoading(true);
    try {
      const res = await solicitudesPersonalApi.getById(idSolicitud);
      if (res.data.success) {
        setSolicitud(res.data.data ?? null);
      } else {
        toast.error('No se pudo cargar la solicitud.');
        setSolicitud(null);
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      if (err.message !== 'REQUEST_CANCELED') {
        toast.error(err.message ?? 'Error al cargar la solicitud.');
      }
      setSolicitud(null);
    } finally {
      setSolicitudLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await incidenciasChecadoApi.getByEmpleado(
          nomina,
          fechaInicio,
          fechaFin,
          controller.signal
        );
        if (res.data.success) setData(res.data.data ?? []);
        else setData([]);
      } catch (error: unknown) {
        const err = toApiError(error);
        if (err.message === 'REQUEST_CANCELED') return;
        toast.error(err.message ?? 'No se pudieron cargar las incidencias.');
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    return () => controller.abort();
  }, [open, nomina, fechaInicio, fechaFin]);

  useEffect(() => {
    if (!open) return;
    const fetchReglas = async () => {
      try {
        const res = await incidenciasChecadoApi.getReglas();
        if (res.data.success) setReglas(res.data.data ?? null);
      } catch {
        setReglas(null);
      }
    };
    fetchReglas();
  }, [open]);

  const columns: ColumnDef<IncidenciaChecadoResponse>[] = useMemo(
    () => [
      {
        id: 'fecha',
        header: 'Fecha',
        cell: ({ row }) => {
          const fecha = parseLocalDate(row.original.fecha);
          return (
            <div className="flex flex-col">
              <span>
                {fecha.toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {fecha.toLocaleDateString('es-MX', { weekday: 'long' })}
              </span>
            </div>
          );
        },
      },
      {
        id: 'incidencia',
        header: 'Incidencia',
        cell: ({ row }) => {
          const o = row.original;
          const incidencias = o.incidenciasCalculadas ?? [];
          if (incidencias.length === 0) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          return (
            <div className="flex flex-col gap-1">
              {incidencias.map((inc, index) => {
                const cantidad = inc.cantidadAcumulada ?? 1;
                const contador =
                  cantidad > 1 && inc.posicionAcumulacion
                    ? `${inc.posicionAcumulacion}/${cantidad}`
                    : null;
                const noCuenta = o.justificada || o.enTramite;
                return (
                  <div key={index} className="flex flex-col gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={
                            inc.generaDescuento
                              ? 'w-fit border-red-300 bg-red-50 text-red-700'
                              : noCuenta
                                ? 'w-fit border-slate-200 bg-slate-50 text-slate-500'
                                : 'w-fit'
                          }
                        >
                          {inc.nombre}
                          {contador && <span className="ml-1 font-semibold">· {contador}</span>}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {tooltipIncidencia(inc, o.justificada, o.enTramite)}
                      </TooltipContent>
                    </Tooltip>
                    {!noCuenta && textoAcumulacionDetalle(inc) && (
                      <span className="text-xs text-muted-foreground">
                        {textoAcumulacionDetalle(inc)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        },
      },
      {
        id: 'entrada',
        header: 'Entrada',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{formatHora(row.original.entrada)}</span>
            <span className="text-xs text-muted-foreground">Entró: {formatHora(row.original.entro)}</span>
          </div>
        ),
      },
      {
        id: 'salida',
        header: 'Salida',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{formatHora(row.original.salida)}</span>
            <span className="text-xs text-muted-foreground">Salió: {formatHora(row.original.salio)}</span>
          </div>
        ),
      },
      {
        id: 'justificada',
        header: 'Estatus',
        cell: ({ row }) => {
          const o = row.original;
          const label = o.justificada ? 'Justificada' : o.enTramite ? 'En trámite' : 'Pendiente';
          const badgeClass = o.justificada
            ? 'bg-green-100 text-green-800'
            : o.enTramite
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800';

          return (
            <div className="flex flex-col gap-1">
              <span
                className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
              >
                {label}
              </span>
              {(o.justificada || o.enTramite) && o.tipoSolicitudNombre && (
                <span className="text-xs text-muted-foreground">{o.tipoSolicitudNombre}</span>
              )}
              {(o.justificada || o.enTramite) && o.idSolicitud && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto justify-start p-0 text-xs"
                  onClick={() => handleVerSolicitud(o.idSolicitud!)}
                >
                  Ver solicitud
                </Button>
              )}
            </div>
          );
        },
      },
      {
        id: 'descuento',
        header: '¿Genera descuento?',
        cell: ({ row }) => {
          const o = row.original;
          const incidencias = o.incidenciasCalculadas ?? [];
          const conDescuento = incidencias.find((i) => i.generaDescuento);

          if (o.descuento && conDescuento) {
            return (
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex w-fit items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  Sí
                </span>
                <span className="text-xs text-muted-foreground">
                  {textoAcumulacion(conDescuento)}
                </span>
              </div>
            );
          }

          const informativa =
            incidencias.find((i) => i.generaDescuentoTeorico && !i.generaDescuento) ??
            incidencias.find((i) => i.posicionAcumulacion);

          return (
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                No
              </span>
              <span className="text-xs text-muted-foreground">
                {o.justificada
                  ? 'Justificado, no cuenta'
                  : o.enTramite
                    ? 'En trámite, no cuenta'
                    : informativa
                      ? textoAcumulacion(informativa)
                      : '—'}
              </span>
            </div>
          );
        },
      },
    ],
    [handleVerSolicitud]
  );

  const periodoLabel = `${parseLocalDate(fechaInicio).toLocaleDateString('es-MX')} - ${parseLocalDate(
    fechaFin
  ).toLocaleDateString('es-MX')}`;

  const sortedData = useMemo(
    () => [...data].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [data]
  );

  const resumenDescuentos = useMemo(() => {
    let generados = 0;
    let justificados = 0;

    for (const item of data) {
      for (const inc of item.incidenciasCalculadas ?? []) {
        if (inc.generaDescuento) generados += 1;
        if (inc.generaDescuentoTeorico && (item.justificada || item.enTramite)) justificados += 1;
      }
    }

    return {
      generados,
      justificados,
      limite: reglas?.limiteDescuentosJustificadosMes ?? 2,
    };
  }, [data, reglas]);

  return (
    <>
      <Modal
        id="modal-detalle-empleado-incidencias"
        open={open}
        setOpen={onClose}
        title={`Incidencias de ${nombre}`}
        size="wide"
      >
        <TooltipProvider delayDuration={200}>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">{periodoLabel}</p>
            {!loading && (
              <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Info className="h-4 w-4" />
                  ¿Cómo se generan los descuentos?
                </div>
                <ReglasDescuentoContenido reglas={reglas} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    Descuentos por justificar: {resumenDescuentos.generados}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Descuentos justificados: {resumenDescuentos.justificados} de{' '}
                    {resumenDescuentos.limite}
                  </span>
                </div>
              </div>
            )}
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Cargando incidencias...</p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={sortedData}
                loading={loading}
                pagination={false}
                showRefreshButton={false}
              />
            )}
          </div>
        </TooltipProvider>
      </Modal>

      <Modal
        id="modal-solicitud-detalle-incidencia"
        open={solicitudModalOpen}
        setOpen={setSolicitudModalOpen}
        title={`Solicitud ${solicitud?.folio ?? ''}`}
        size="lg"
      >
        {solicitudLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando solicitud...</p>
          </div>
        ) : solicitud ? (
          <div className="space-y-4">
            <SolicitudHeaderCard solicitud={solicitud} getEstadoInfo={getEstadoInfo} />
            <SolicitudDetalleTab solicitud={solicitud} />
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No se pudo cargar la solicitud.
          </div>
        )}
      </Modal>
    </>
  );
}
