import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { InlineLoader } from '@/components/ui/inline-loader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WorkflowHistorialModal } from '@/components/workflows/WorkflowHistorialModal';
import { useSolicitudesAutorizaciones } from '@/hooks/useSolicitudes';
import { SolicitudHeaderCard } from './SolicitudHeaderCard';
import { autorizacionesIncidenciasApi } from '../services/rh.api';
import { periodoLabel } from '../utils/periodos';
import type { AutorizacionesIncidenciasResponse } from '@/types/solicitudPersonal.types';
import { toApiError } from '@/utils/errors';
import { toast } from 'sonner';

interface Periodo {
  anio: number;
  mes: number;
}

function clavePeriodo({ anio, mes }: Periodo): string {
  return `${anio}-${mes}`;
}

function periodoDesdeClave(clave: string): Periodo {
  const [anio, mes] = clave.split('-').map(Number);
  return { anio, mes };
}

function opcionesUltimosMeses(cantidad = 12): Array<{ value: string; label: string }> {
  const hoy = new Date();
  return Array.from({ length: cantidad }, (_, indice) => {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - indice, 1);
    const periodo = { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1 };
    return { value: clavePeriodo(periodo), label: periodoLabel(periodo.anio, periodo.mes) };
  });
}

function formatoFecha(valor?: string | null): string {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Distintivo del Dashboard de RH que se muestra dentro de la tarjeta «Mis pendientes»:
 * cuántas incidencias (solicitudes de cualquier categoría) tienen en el mes los
 * integrantes del equipo del usuario, contadas por el día de la incidencia. Al pulsarlo
 * abre el detalle con desglose por empleado, historial por solicitud y el combobox de meses.
 */
export function MisAutorizacionesIncidenciasBadge({ refreshKey }: { refreshKey?: number } = {}) {
  const opciones = useMemo(() => opcionesUltimosMeses(), []);
  const [clave, setClave] = useState(() => {
    const hoy = new Date();
    return clavePeriodo({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  });
  const [data, setData] = useState<AutorizacionesIncidenciasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);

  const {
    selectedSolicitud,
    selectSolicitud,
    loadingDetalle,
    fetchDetalleCompleto,
    loadingHistorial,
    fetchHistorial,
    historial,
    pasosWorkflow,
    responsablesPorPaso,
    getEstadoInfo,
  } = useSolicitudesAutorizaciones();

  const periodo = useMemo(() => periodoDesdeClave(clave), [clave]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await autorizacionesIncidenciasApi.get({ anio: periodo.anio, mes: periodo.mes });
      if (res.data?.success) {
        setData(res.data.data ?? null);
      } else {
        setData(null);
        toast.error(res.data.message ?? 'No se pudieron cargar tus autorizaciones');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'No se pudieron cargar tus autorizaciones');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodo.anio, periodo.mes]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  const total = data?.total ?? 0;
  const etiquetaPeriodo = periodoLabel(periodo.anio, periodo.mes);

  const abrirDetalle = () => setDetalleOpen(true);

  // Historial del flujo de esa solicitud (misma línea de tiempo que en Mis solicitudes).
  const abrirHistorial = useCallback(
    async (idSolicitud: number) => {
      selectSolicitud(idSolicitud);
      setHistorialOpen(true);
      await Promise.all([fetchDetalleCompleto(idSolicitud), fetchHistorial(idSolicitud)]);
    },
    [selectSolicitud, fetchDetalleCompleto, fetchHistorial]
  );

  return (
    <>
      {loading ? (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          Incidencias autorizadas…
        </span>
      ) : (
        <button
          type="button"
          onClick={abrirDetalle}
          aria-label="Ver el detalle de las incidencias que he autorizado"
          className={
            total > 0
              ? 'inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-200'
              : 'inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70'
          }
        >
          {total} {total === 1 ? 'incidencia autorizada' : 'incidencias autorizadas'} este mes
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      <Modal
        id="modal-mis-autorizaciones-incidencias"
        open={detalleOpen}
        setOpen={setDetalleOpen}
        title="Incidencias que he autorizado"
        subtitle="Se cuentan por el día de la incidencia (no por el día de la firma); no se incluyen canceladas ni rechazadas."
        size="full"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56 space-y-1">
              <label
                htmlFor="autorizaciones-incidencias-mes"
                className="text-xs font-medium text-muted-foreground"
              >
                Mes
              </label>
              <Select value={clave} onValueChange={setClave}>
                <SelectTrigger id="autorizaciones-incidencias-mes" className="h-9">
                  <SelectValue placeholder="Selecciona un mes" />
                </SelectTrigger>
                <SelectContent>
                  {opciones.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border bg-muted/30 px-4 py-2">
              <p className="text-xs text-muted-foreground">Total del mes</p>
              <p className="text-2xl font-bold tabular-nums">{total}</p>
            </div>
          </div>

          {loading ? (
            <InlineLoader message="Cargando autorizaciones..." />
          ) : total === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No hay incidencias autorizadas en {etiquetaPeriodo}.
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Desglose por empleado</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empleado</TableHead>
                        <TableHead className="text-right">Incidencias autorizadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.porEmpleado ?? []).map((empleado) => (
                        <TableRow key={empleado.idUsuario}>
                          <TableCell className="text-sm">{empleado.nombre}</TableCell>
                          <TableCell className="text-right text-sm font-medium tabular-nums">
                            {empleado.total}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Detalle</h3>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Día de la incidencia</TableHead>
                        <TableHead>Folio</TableHead>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Tipo de solicitud</TableHead>
                        <TableHead>Mi firma</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Historial</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.detalle ?? []).map((item) => (
                        <TableRow key={`${item.idSolicitud}-${item.fechaIncidencia}`}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatoFecha(item.fechaIncidencia)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-medium">
                            {item.folio}
                          </TableCell>
                          <TableCell className="text-sm">{item.empleadoNombre}</TableCell>
                          <TableCell className="text-sm">{item.tipoSolicitud}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatoFecha(item.fechaAutorizacion)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {item.estadoNombre ?? '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 px-2"
                              aria-label={`Ver historial de ${item.folio}`}
                              onClick={() => abrirHistorial(item.idSolicitud)}
                            >
                              <History className="h-4 w-4" />
                              Historial
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </>
          )}
        </div>
      </Modal>

      <WorkflowHistorialModal
        open={historialOpen}
        onClose={() => {
          setHistorialOpen(false);
          selectSolicitud(null);
        }}
        titulo="Historial de solicitud"
        encabezado={
          selectedSolicitud ? (
            <SolicitudHeaderCard
              solicitud={selectedSolicitud}
              getEstadoInfo={getEstadoInfo}
              compact
            />
          ) : undefined
        }
        cargando={loadingHistorial || loadingDetalle}
        idPasoActual={selectedSolicitud?.idPasoActual ?? null}
        estadoNombre={selectedSolicitud?.estadoNombre}
        pasos={pasosWorkflow}
        historial={historial}
        responsablesPorPaso={responsablesPorPaso}
      />
    </>
  );
}

export default MisAutorizacionesIncidenciasBadge;
