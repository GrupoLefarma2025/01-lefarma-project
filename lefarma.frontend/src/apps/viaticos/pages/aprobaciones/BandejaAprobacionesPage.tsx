import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { toApiError } from '@/utils/errors';
import { AprobacionesBandejaTable } from '../../components/AprobacionesBandejaTable';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import {
  ESTADOS_SOLICITUD,
  estadoTexto,
  type FiltrosBandeja,
  type SolicitudBandeja,
} from '../../types/aprobaciones.types';

export const PERMISO_AUTORIZAR = 'viaticos.autorizar';

const FILTROS_INICIALES: FiltrosBandeja = { periodo: '', estado: '', gerencia: '' };

const campo = (filtros: FiltrosBandeja, clave: keyof FiltrosBandeja) => filtros[clave] ?? '';

export interface BandejaAprobacionesPageProps {
  /**
   * Visor de opciones de la solicitud. Lo cablea `BandejaAprobacionesConDetalle`,
   * que es quien monta el detalle real; sin callback, "Ver opciones" solo emite
   * la seleccion sin abrir nada.
   */
  onVerOpciones?: (solicitud: SolicitudBandeja) => void;
}

export default function BandejaAprobacionesPage({
  onVerOpciones,
}: BandejaAprobacionesPageProps = {}) {
  usePageTitle('Bandeja de Autorizaciones', 'Viáticos');

  const puedeAutorizar = usePermission({ require: PERMISO_AUTORIZAR });

  const [borrador, setBorrador] = useState<FiltrosBandeja>(FILTROS_INICIALES);
  const [aplicados, setAplicados] = useState<FiltrosBandeja>(FILTROS_INICIALES);
  const [solicitudes, setSolicitudes] = useState<SolicitudBandeja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autorizandoId, setAutorizandoId] = useState<number | null>(null);

  const cargar = useCallback(async (filtros: FiltrosBandeja) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await aprobacionesApi.bandeja(filtros);
      if (respuesta.data.success) {
        setSolicitudes(respuesta.data.data ?? []);
      } else {
        setSolicitudes([]);
        setError(respuesta.data.message ?? 'No se pudo cargar la bandeja de solicitudes.');
      }
    } catch (falla: unknown) {
      setSolicitudes([]);
      setError(toApiError(falla).message || 'No se pudo cargar la bandeja de solicitudes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(aplicados);
  }, [aplicados, cargar]);

  const actualizarBorrador = (clave: keyof FiltrosBandeja, valor: string) =>
    setBorrador((previos) => ({ ...previos, [clave]: valor }));

  const handleAutorizar = async (solicitud: SolicitudBandeja) => {
    if (autorizandoId !== null) return;
    setAutorizandoId(solicitud.id_solicitud);
    try {
      const respuesta = await aprobacionesApi.autorizar(solicitud.id_solicitud);
      if (respuesta.data.success) {
        // Parcheo local de la fila: el unico campo que mueve el endpoint es
        // `estado`, y recargar toda la bandeja perderia el scroll y los filtros.
        setSolicitudes((previas) =>
          previas.map((fila) =>
            fila.id_solicitud === solicitud.id_solicitud
              ? { ...fila, estado: 'autorizada' }
              : fila
          )
        );
        toast.success(respuesta.data.message ?? `Solicitud ${solicitud.id_solicitud} autorizada.`);
      } else {
        toast.error(respuesta.data.message ?? 'No se pudo autorizar la solicitud.');
      }
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo autorizar la solicitud.');
    } finally {
      setAutorizandoId(null);
    }
  };

  const hayFiltros = Object.values(aplicados).some(Boolean);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Bandeja de Autorizaciones</h1>
        <p className="text-sm text-muted-foreground">
          Solicitudes de viáticos enviadas, listas para autorizar.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="filtro-periodo" className="text-xs font-medium text-muted-foreground">
              Periodo
            </Label>
            <Input
              id="filtro-periodo"
              className="h-10"
              placeholder="yyyy-MM"
              value={campo(borrador, 'periodo')}
              onChange={(evento) => actualizarBorrador('periodo', evento.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filtro-estado" className="text-xs font-medium text-muted-foreground">
              Estado
            </Label>
            <select
              id="filtro-estado"
              aria-label="Estado"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={campo(borrador, 'estado')}
              onChange={(evento) => actualizarBorrador('estado', evento.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_SOLICITUD.map((estado) => (
                <option key={estado} value={estado}>
                  {estadoTexto(estado)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filtro-gerencia" className="text-xs font-medium text-muted-foreground">
              Gerencia
            </Label>
            <Input
              id="filtro-gerencia"
              className="h-10"
              placeholder="Todas las gerencias"
              value={campo(borrador, 'gerencia')}
              onChange={(evento) => actualizarBorrador('gerencia', evento.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={cargando}
            onClick={() => setAplicados({ ...borrador })}
          >
            <Search className="mr-1.5 h-4 w-4" />
            Buscar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={cargando}
            onClick={() => {
              setBorrador(FILTROS_INICIALES);
              setAplicados(FILTROS_INICIALES);
            }}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Limpiar filtros
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 space-y-2">
            <p className="font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void cargar(aplicados)}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando solicitudes...
        </div>
      ) : solicitudes.length > 0 ? (
        <AprobacionesBandejaTable
          solicitudes={solicitudes}
          puedeAutorizar={puedeAutorizar}
          autorizandoId={autorizandoId}
          onAutorizar={(solicitud) => void handleAutorizar(solicitud)}
          onVerOpciones={(solicitud) => onVerOpciones?.(solicitud)}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {hayFiltros
            ? 'No hay solicitudes que coincidan con los filtros aplicados. Ajusta el periodo, el estado o la gerencia.'
            : 'No hay solicitudes en la bandeja. Cuando un solicitante envíe su solicitud de viáticos aparecerá aquí.'}
        </div>
      )}

    </div>
  );
}