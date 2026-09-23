import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { misIncidenciasChecadoApi } from '../services/rh.api';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  IncidenciaChecadoResponse,
  PagedResult,
  SolicitudPersonalResponse,
} from '@/types/solicitudPersonal.types';
import { isEstadoTerminal } from '@/hooks/useSolicitudes';
import { IncidenciaModal } from './MiCalendario';
import { CrearSolicitud } from './CrearSolicitud';

function fmtFechaCorta(fecha: string) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MisPendientesCard({ refreshKey }: { refreshKey?: number } = {}) {
  const [incidencias, setIncidencias] = useState<IncidenciaChecadoResponse[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudPersonalResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] =
    useState<IncidenciaChecadoResponse | null>(null);
  const [incidenciaParaSolicitud, setIncidenciaParaSolicitud] =
    useState<IncidenciaChecadoResponse | null>(null);
  const [solicitudModalOpen, setSolicitudModalOpen] = useState(false);
  const [confirmCloseCrear, setConfirmCloseCrear] = useState(false);
  const crearDirtyRef = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const hoy = new Date();
    const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    try {
      const [incActual, incAnterior, solRes] = await Promise.all([
        misIncidenciasChecadoApi
          .get({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 })
          .catch(() => null),
        misIncidenciasChecadoApi
          .get({ anio: mesAnterior.getFullYear(), mes: mesAnterior.getMonth() + 1 })
          .catch(() => null),
        API.get<ApiResponse<PagedResult<SolicitudPersonalResponse>>>('/solicitudes-personal', {
          params: { verTodas: false, pageSize: 100 },
        }).catch(() => null),
      ]);

      const listaIncidencias = [
        ...(incActual?.data.success ? incActual.data.data ?? [] : []),
        ...(incAnterior?.data.success ? incAnterior.data.data ?? [] : []),
      ];
      setIncidencias(listaIncidencias);
      setSolicitudes(solRes?.data.success ? solRes.data.data?.items ?? [] : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const pendientes = useMemo(
    () =>
      incidencias
        .filter(
          (i) => !i.justificada && !i.enTramite && (i.incidenciasCalculadas ?? []).length > 0
        )
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [incidencias]
  );

  const solicitudesEnTramite = useMemo(
    () => solicitudes.filter((s) => !isEstadoTerminal(s.estadoNombre)),
    [solicitudes]
  );

  const handleJustificar = (incidencia: IncidenciaChecadoResponse) => {
    setIncidenciaSeleccionada(incidencia);
  };

  const handleAddSolicitud = () => {
    setIncidenciaParaSolicitud(incidenciaSeleccionada);
    setIncidenciaSeleccionada(null);
    crearDirtyRef.current = false;
    setSolicitudModalOpen(true);
  };

  const sinPendientes = pendientes.length === 0 && solicitudesEnTramite.length === 0;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Mis pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando tus pendientes...</p>
          ) : sinPendientes ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              No tienes pendientes por ahora.
            </div>
          ) : (
            <>
              {pendientes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                      {pendientes.length}{' '}
                      {pendientes.length === 1
                        ? 'incidencia por justificar'
                        : 'incidencias por justificar'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {pendientes.slice(0, 3).map((incidencia) => (
                      <div
                        key={`${incidencia.fecha}-${incidencia.nomina ?? ''}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {(incidencia.incidenciasCalculadas ?? [])
                              .map((i) => i.nombre)
                              .join(', ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmtFechaCorta(incidencia.fecha)}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => handleJustificar(incidencia)}>
                          <Plus className="mr-1.5 h-4 w-4" />
                          Justificar incidencia
                        </Button>
                      </div>
                    ))}
                    {pendientes.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        y {pendientes.length - 3}{' '}
                        {pendientes.length - 3 === 1 ? 'incidencia más' : 'incidencias más'} en tu
                        calendario
                      </p>
                    )}
                  </div>
                </div>
              )}

              {solicitudesEnTramite.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {solicitudesEnTramite.length}{' '}
                      {solicitudesEnTramite.length === 1
                        ? 'solicitud en trámite'
                        : 'solicitudes en trámite'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Esperando revisión o resolución
                    </span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/rh/solicitudes">Ver mis solicitudes</Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <IncidenciaModal
        incidencia={incidenciaSeleccionada}
        open={incidenciaSeleccionada !== null}
        onClose={() => setIncidenciaSeleccionada(null)}
        onAddSolicitud={handleAddSolicitud}
      />

      <Modal
        id="modal-crear-solicitud-pendientes"
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
            fetchData();
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

export default MisPendientesCard;
