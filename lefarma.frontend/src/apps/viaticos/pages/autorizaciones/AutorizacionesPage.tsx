import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClipboardCheck, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { solicitudesApi } from '../../services/solicitudes.api';
import type { Solicitud } from '../../types/solicitud.types';
import { FiltrosSolicitudes } from '../mis-viajes/FiltrosSolicitudes';
import { SolicitudesViajeTable } from '../mis-viajes/SolicitudesViajeTable';
import { VistaDetalle } from '../mis-viajes/MisViajesPage';
import { enRango, leerDatosViaje, rangoDelFiltro, type FilaViaje, type FiltroPeriodo, type TipoViaje } from '../mis-viajes/viajes.helpers';
import { RevisarSolicitudDialog } from './RevisarSolicitudDialog';

function mesHastaHoy(hoy: Date): { desde: string; hasta: string } {
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return { desde: `${anio}-${mes}-01`, hasta: `${anio}-${mes}-${dia}` };
}

export function AutorizacionesPage({ hoy = new Date() }: { hoy?: Date }) {
  usePageTitle('Autorizaciones', 'Viáticos');
  const miId = useAuthStore((s) => s.user?.id);
  const miNombre = useAuthStore((s) => s.user?.nombre);

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [autorizadas, setAutorizadas] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorPendientes, setErrorPendientes] = useState<string | null>(null);
  const [errorAutorizadas, setErrorAutorizadas] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('todo');
  const [tipo, setTipo] = useState<TipoViaje | 'todos'>('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [revisandoId, setRevisandoId] = useState<number | null>(null);

  const rangoMes = useMemo(() => mesHastaHoy(hoy), [hoy]);
  const [periodoAutorizadas, setPeriodoAutorizadas] = useState<FiltroPeriodo>('personalizado');
  const [tipoAutorizadas, setTipoAutorizadas] = useState<TipoViaje | 'todos'>('todos');
  const [desdeAutorizadas, setDesdeAutorizadas] = useState(rangoMes.desde);
  const [hastaAutorizadas, setHastaAutorizadas] = useState(rangoMes.hasta);
  const [viendoId, setViendoId] = useState<number | null>(null);

  const solicitudEnRevision = useMemo(
    () =>
      revisandoId === null
        ? null
        : (solicitudes.find((s) => s.id_solicitud === revisandoId) ?? null),
    [revisandoId, solicitudes],
  );

  const solicitudEnConsulta = useMemo(
    () =>
      viendoId === null
        ? null
        : (autorizadas.find((s) => s.id_solicitud === viendoId) ?? null),
    [viendoId, autorizadas],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorPendientes(null);
    setErrorAutorizadas(null);

    const [pendientes, revisadas] = await Promise.allSettled([
      solicitudesApi.porAutorizar(),
      solicitudesApi.autorizadas(),
    ]);

    if (pendientes.status === 'fulfilled') {
      if (pendientes.value.data.success) setSolicitudes(pendientes.value.data.data ?? []);
      else setErrorPendientes(pendientes.value.data.message ?? 'No se pudieron cargar las solicitudes por autorizar.');
    } else {
      setErrorPendientes(toApiError(pendientes.reason).message || 'No se pudieron cargar las solicitudes por autorizar.');
    }

    if (revisadas.status === 'fulfilled') {
      if (revisadas.value.data.success) setAutorizadas(revisadas.value.data.data ?? []);
      else setErrorAutorizadas(revisadas.value.data.message ?? 'No se pudieron cargar las solicitudes autorizadas.');
    } else {
      setErrorAutorizadas(toApiError(revisadas.reason).message || 'No se pudieron cargar las solicitudes autorizadas.');
    }

    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const rango = rangoDelFiltro(periodo, hoy, desde, hasta);

  const filas = useMemo<FilaViaje[]>(() => {
    return [...solicitudes]
      .sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion) || b.id_solicitud - a.id_solicitud)
      .map((s) => ({ solicitud: s, resumen: leerDatosViaje(s.datos) }))
      .filter(({ resumen }) => (tipo === 'todos' ? true : resumen.tipoViaje === tipo))
      .filter(({ solicitud }) => enRango(solicitud.fecha_creacion, rango));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudes, tipo, periodo, desde, hasta]);

  const rangoAutorizadas = rangoDelFiltro(periodoAutorizadas, hoy, desdeAutorizadas, hastaAutorizadas);

  const filasAutorizadas = useMemo<FilaViaje[]>(() => {
    return [...autorizadas]
      .sort((a, b) => b.fecha_modificacion.localeCompare(a.fecha_modificacion) || b.id_solicitud - a.id_solicitud)
      .map((s) => ({ solicitud: s, resumen: leerDatosViaje(s.datos) }))
      .filter(({ resumen }) => (tipoAutorizadas === 'todos' ? true : resumen.tipoViaje === tipoAutorizadas))
      .filter(({ solicitud }) => enRango(solicitud.fecha_modificacion || solicitud.fecha_creacion, rangoAutorizadas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizadas, tipoAutorizadas, periodoAutorizadas, desdeAutorizadas, hastaAutorizadas]);

  const filtrosAplicados = [
    periodo !== 'todo',
    tipo !== 'todos',
    Boolean(desde),
    Boolean(hasta),
  ].filter(Boolean).length;

  const filtrosAutorizadas = [
    periodoAutorizadas !== 'todo',
    tipoAutorizadas !== 'todos',
  ].filter(Boolean).length;

  const accionesDe = useCallback(
    (fila: FilaViaje): ReactNode => {
      const folio = fila.solicitud.folio ?? `#${fila.solicitud.id_solicitud}`;
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label={`Revisar la solicitud ${folio}`}
          onClick={() => setRevisandoId(fila.solicitud.id_solicitud)}
        >
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          Revisar
        </Button>
      );
    },
    [],
  );

  const accionesAutorizada = useCallback(
    (fila: FilaViaje): ReactNode => {
      const folio = fila.solicitud.folio ?? `#${fila.solicitud.id_solicitud}`;
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label={`Ver el detalle de la solicitud ${folio}`}
          onClick={() => setViendoId(fila.solicitud.id_solicitud)}
        >
          <Eye className="h-4 w-4" aria-hidden />
          Ver detalle
        </Button>
      );
    },
    [],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Solicitudes enviadas por cualquier persona que esperan tu autorización. Al autorizar pasan al
        concentrado y quedan en la pestaña Autorizados, sin edición ni recálculo.
      </p>

      <Tabs defaultValue="por-autorizar" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="por-autorizar">Por autorizar ({filas.length})</TabsTrigger>
          <TabsTrigger value="autorizados">Autorizados ({filasAutorizadas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="por-autorizar" className="space-y-4">
          <FiltrosSolicitudes
            periodo={periodo}
            onPeriodo={setPeriodo}
            tipo={tipo}
            onTipo={setTipo}
            desde={desde}
            onDesde={setDesde}
            hasta={hasta}
            onHasta={setHasta}
            rango={rango}
            filtrosAplicados={filtrosAplicados}
            idPrefijo="autorizaciones-"
          />

          {errorPendientes ? <p role="alert" className="text-sm text-destructive">{errorPendientes}</p> : null}

          <SolicitudesViajeTable
            filas={filas}
            cargando={cargando}
            titulo="Solicitudes por autorizar"
            subtitulo={`Pendientes: ${filas.length}`}
            tableId="viaticos-autorizaciones-v1"
            miId={miId}
            miNombre={miNombre}
            onVerDetalle={(id) => setRevisandoId(id)}
            onRefresh={() => { void cargar(); }}
            acciones={accionesDe}
          />
        </TabsContent>

        <TabsContent value="autorizados" className="space-y-4">
          <FiltrosSolicitudes
            periodo={periodoAutorizadas}
            onPeriodo={setPeriodoAutorizadas}
            tipo={tipoAutorizadas}
            onTipo={setTipoAutorizadas}
            desde={desdeAutorizadas}
            onDesde={setDesdeAutorizadas}
            hasta={hastaAutorizadas}
            onHasta={setHastaAutorizadas}
            rango={rangoAutorizadas}
            filtrosAplicados={filtrosAutorizadas}
            idPrefijo="autorizados-"
            descripcionRango="Mostrando por fecha de autorización"
          />

          {errorAutorizadas ? <p role="alert" className="text-sm text-destructive">{errorAutorizadas}</p> : null}

          <SolicitudesViajeTable
            filas={filasAutorizadas}
            cargando={cargando}
            titulo="Solicitudes autorizadas"
            subtitulo={`Autorizados: ${filasAutorizadas.length}`}
            tableId="viaticos-autorizados-v1"
            miId={miId}
            miNombre={miNombre}
            onVerDetalle={(id) => setViendoId(id)}
            onRefresh={() => { void cargar(); }}
            acciones={accionesAutorizada}
          />
        </TabsContent>
      </Tabs>

      <RevisarSolicitudDialog
        idSolicitud={revisandoId}
        solicitudInicial={solicitudEnRevision}
        onClose={() => setRevisandoId(null)}
        onResuelta={(mensaje) => {
          toast.success(mensaje);
          setRevisandoId(null);
          void cargar();
        }}
      />

      <Dialog
        open={solicitudEnConsulta !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setViendoId(null);
        }}
      >
        <DialogContent
          data-testid="detalle-autorizada"
          className="max-h-[92vh] w-[94vw] max-w-[1500px] overflow-y-auto p-4 sm:p-6"
        >
          <DialogHeader>
            <DialogTitle>
              Detalle de la solicitud {solicitudEnConsulta?.folio ?? ''}
            </DialogTitle>
            <DialogDescription>
              Solicitud autorizada: ya forma parte del concentrado y no se puede editar ni recalcular.
            </DialogDescription>
          </DialogHeader>

          {solicitudEnConsulta ? (
            <VistaDetalle solicitud={solicitudEnConsulta} modoRevision pestanaInicial="autorizada" />
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setViendoId(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
