import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { incidenciasChecadoApi, solicitudesPersonalApi } from '../services/rh.api';
import type { IncidenciaChecadoResponse, SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { SolicitudHeaderCard } from './SolicitudHeaderCard';
import { SolicitudDetalleTab } from './SolicitudDetalleTab';

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
          const items: { label: string; text: string }[] = [];
          if (o.incidenciaEntrada) items.push({ label: 'Entrada', text: o.incidenciaEntrada });
          if (o.incidenciaSalida) items.push({ label: 'Salida', text: o.incidenciaSalida });
          if (o.msgError) items.push({ label: 'Omisión', text: o.msgError });
          if (items.length === 0) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          return (
            <div className="flex flex-col gap-1">
              {items.map((item, index) => (
                <span
                  key={index}
                  className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                >
                  <span className="font-semibold">{item.label}:</span> {item.text}
                </span>
              ))}
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
        header: 'Justificada',
        cell: ({ row }) => {
          const o = row.original;
          if (o.justificada) {
            return (
              <div className="flex flex-col gap-1">
                <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Justificada
                </span>
                {o.tipoSolicitudNombre && (
                  <span className="text-xs text-muted-foreground">{o.tipoSolicitudNombre}</span>
                )}
                {o.idSolicitud && (
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
          }
          return (
            <span className="inline-flex w-fit items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
              Pendiente
            </span>
          );
        },
      },
    ],
    [handleVerSolicitud]
  );

  const periodoLabel = `${parseLocalDate(fechaInicio).toLocaleDateString('es-MX')} - ${parseLocalDate(
    fechaFin
  ).toLocaleDateString('es-MX')}`;

  return (
    <>
      <Modal
        id="modal-detalle-empleado-incidencias"
        open={open}
        setOpen={onClose}
        title={`Incidencias de ${nombre}`}
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{periodoLabel}</p>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando incidencias...</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data}
              loading={loading}
              pagination={false}
              showRefreshButton={false}
            />
          )}
        </div>
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
