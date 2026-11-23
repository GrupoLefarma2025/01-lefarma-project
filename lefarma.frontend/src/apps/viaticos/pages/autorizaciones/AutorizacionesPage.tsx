import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { solicitudesApi } from '../../services/solicitudes.api';
import type { Solicitud } from '../../types/solicitud.types';
import { FiltrosSolicitudes } from '../mis-viajes/FiltrosSolicitudes';
import { SolicitudesViajeTable } from '../mis-viajes/SolicitudesViajeTable';
import { enRango, leerDatosViaje, rangoDelFiltro, type FilaViaje, type FiltroPeriodo, type TipoViaje } from '../mis-viajes/viajes.helpers';
import { RevisarSolicitudDialog } from './RevisarSolicitudDialog';

export function AutorizacionesPage({ hoy = new Date() }: { hoy?: Date }) {
  usePageTitle('Autorizaciones', 'Viáticos');
  const miId = useAuthStore((s) => s.user?.id);
  const miNombre = useAuthStore((s) => s.user?.nombre);

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('todo');
  const [tipo, setTipo] = useState<TipoViaje | 'todos'>('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [revisandoId, setRevisandoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await solicitudesApi.porAutorizar();
      if (res.data.success) setSolicitudes(res.data.data ?? []);
      else setError(res.data.message ?? 'No se pudieron cargar las solicitudes por autorizar.');
    } catch (falla: unknown) {
      setError(toApiError(falla).message || 'No se pudieron cargar las solicitudes por autorizar.');
    } finally {
      setCargando(false);
    }
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

  const filtrosAplicados = [
    periodo !== 'todo',
    tipo !== 'todos',
    Boolean(desde),
    Boolean(hasta),
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Solicitudes enviadas por cualquier persona que esperan tu autorización. Al autorizar pasan al concentrado.
      </p>

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

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

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

      <RevisarSolicitudDialog
        idSolicitud={revisandoId}
        onClose={() => setRevisandoId(null)}
        onResuelta={(mensaje) => {
          toast.success(mensaje);
          setRevisandoId(null);
          void cargar();
        }}
      />
    </div>
  );
}
