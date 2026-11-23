import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import { leerCalculoDesdeDatos } from '../../services/calculoViaje';
import { solicitudesApi } from '../../services/solicitudes.api';
import { CalculosViajeModal } from '../../components/CalculosViajeModal';
import { EditarCostosDialog } from '../../components/EditarCostosDialog';
import type { PropuestaRuta, Solicitud } from '../../types/solicitud.types';
import { VistaDetalle } from '../mis-viajes/MisViajesPage';
import { opcionesDePropuesta } from '../mis-viajes/viajes.helpers';

export interface RevisarSolicitudDialogProps {
  idSolicitud: number | null;
  onClose: () => void;
  onResuelta: (mensaje: string) => void;
}

export function RevisarSolicitudDialog({ idSolicitud, onClose, onResuelta }: RevisarSolicitudDialogProps) {
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargando, setCargando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [accionando, setAccionando] = useState(false);
  const [propuesta, setPropuesta] = useState<PropuestaRuta | null>(null);
  const [calculosAbiertos, setCalculosAbiertos] = useState(false);
  const [costosAbiertos, setCostosAbiertos] = useState(false);

  useEffect(() => {
    if (idSolicitud === null) {
      setDetalle(null);
      setComentario('');
      return;
    }

    let vigente = true;
    setDetalle(null);
    setComentario('');
    setPropuesta(null);
    setCalculosAbiertos(false);
    setCostosAbiertos(false);
    setCargando(true);
    void (async () => {
      try {
        const res = await solicitudesApi.detalle(idSolicitud);
        if (!vigente) return;
        if (res.data.success && res.data.data) setDetalle(res.data.data);
        else toast.error(res.data.message ?? 'No se pudo cargar la solicitud.');
      } catch (falla: unknown) {
        if (vigente) toast.error(toApiError(falla).message || 'No se pudo cargar la solicitud.');
      } finally {
        if (vigente) setCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [idSolicitud]);

  const versionBase = useMemo(() => {
    if (!detalle) return null;
    if (propuesta) {
      return { calculo: propuesta.calculo, opciones: opcionesDePropuesta(propuesta.opciones) };
    }
    const calculo = leerCalculoDesdeDatos(detalle.datos);
    return calculo ? { calculo, opciones: detalle.opciones } : null;
  }, [detalle, propuesta]);

  const autorizar = useCallback(async () => {
    if (idSolicitud === null) return;
    setAccionando(true);
    try {
      const res = propuesta
        ? await aprobacionesApi.autorizar(idSolicitud, {
            calculo: propuesta.calculo,
            opciones: propuesta.opciones,
          })
        : await aprobacionesApi.autorizar(idSolicitud);
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo autorizar la solicitud.');
        return;
      }
      onResuelta(
        propuesta
          ? 'Solicitud autorizada con la ruta propuesta. Ya está lista para el concentrado.'
          : 'Solicitud autorizada. Ya está lista para el concentrado.',
      );
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo autorizar la solicitud.');
    } finally {
      setAccionando(false);
    }
  }, [idSolicitud, onResuelta, propuesta]);

  const rechazar = useCallback(async () => {
    if (idSolicitud === null) return;
    if (comentario.trim() === '') {
      toast.error('Escribe el motivo del rechazo.');
      return;
    }
    setAccionando(true);
    try {
      const res = await aprobacionesApi.rechazar(idSolicitud, comentario.trim());
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo rechazar la solicitud.');
        return;
      }
      onResuelta('Solicitud rechazada. El solicitante puede corregirla y volver a enviarla.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo rechazar la solicitud.');
    } finally {
      setAccionando(false);
    }
  }, [comentario, idSolicitud, onResuelta]);

  const folio = detalle?.folio ?? (idSolicitud !== null ? `#${idSolicitud}` : '');

  const acciones = detalle ? (
    <>
      <Button
        type="button"
        size="lg"
        className="h-12 w-full gap-2 text-base sm:w-auto"
        onClick={() => {
          setCalculosAbiertos(true);
        }}
      >
        <RefreshCw className="h-5 w-5" aria-hidden /> Recalcular viaje
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-12 w-full gap-2 text-base sm:w-auto"
        disabled={!versionBase}
        onClick={() => setCostosAbiertos(true)}
      >
        <Wallet className="h-5 w-5" aria-hidden /> Editar costos
      </Button>
    </>
  ) : null;

  return (
    <>
      <Dialog
        open={idSolicitud !== null}
        onOpenChange={(abierto) => {
          if (!abierto) onClose();
        }}
      >
        <DialogContent data-testid="revision-autorizacion" className="w-[90vw] max-w-[1400px]">
          <DialogHeader>
            <DialogTitle>Revisión de la solicitud {folio}</DialogTitle>
            <DialogDescription>
              {propuesta
                ? 'Vas a autorizar la ruta propuesta: revísala contra lo que pidió el solicitante antes de continuar, o rechaza con el motivo para que la corrija.'
                : 'Compara lo que pidió el solicitante con la ruta calculada. Si algo no sirve, recalcula el viaje o edita los costos; si no, autoriza o rechaza con el motivo para que la corrija.'}
            </DialogDescription>
          </DialogHeader>

          {cargando ? <p role="status">Cargando detalle…</p> : null}
          {detalle ? (
            <VistaDetalle
              solicitud={detalle}
              modoRevision
              pestanaInicial="comparar"
              propuesta={propuesta}
              acciones={acciones}
            />
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="motivo-rechazo">Motivo del rechazo</Label>
            <Input
              id="motivo-rechazo"
              placeholder="Solo si vas a rechazar: explica qué debe corregirse."
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={accionando || !detalle || comentario.trim() === ''}
              onClick={() => { void rechazar(); }}
            >
              <X className="h-4 w-4" aria-hidden /> Rechazar
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={accionando || !detalle}
              onClick={() => { void autorizar(); }}
            >
              <Check className="h-4 w-4" aria-hidden />
              {propuesta ? 'Autorizar ruta propuesta' : 'Autorizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detalle ? (
        <CalculosViajeModal
          solicitud={detalle}
          open={calculosAbiertos}
          onOpenChange={setCalculosAbiertos}
          onEnviado={() => setCalculosAbiertos(false)}
          modo="autorizar"
          onPropuesta={setPropuesta}
        />
      ) : null}

      {costosAbiertos && versionBase ? (
        <EditarCostosDialog
          calculo={versionBase.calculo}
          opciones={versionBase.opciones}
          onOpenChange={(abierto) => {
            if (!abierto) setCostosAbiertos(false);
          }}
          onGuardar={setPropuesta}
        />
      ) : null}
    </>
  );
}
