import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import { solicitudesApi } from '../../services/solicitudes.api';
import { CalculosViajeModal } from '../../components/CalculosViajeModal';
import { EditarCostosDialog } from '../../components/EditarCostosDialog';
import type { PropuestaRuta, PropuestaVersion, Solicitud } from '../../types/solicitud.types';
import { VistaDetalle } from '../mis-viajes/MisViajesPage';
import { opcionesDePropuesta } from '../mis-viajes/viajes.helpers';
import { ConfirmarAutorizacionDialog } from './ConfirmarAutorizacionDialog';
import { RechazarSolicitudDialog } from './RechazarSolicitudDialog';
import {
  etiquetaPropuesta,
  fusionarVersiones,
  historialDePropuesta,
} from './propuestasRevision';

export interface RevisarSolicitudDialogProps {
  idSolicitud: number | null;
  solicitudInicial?: Solicitud | null;
  onClose: () => void;
  onResuelta: (mensaje: string) => void;
}

export function RevisarSolicitudDialog({
  idSolicitud,
  solicitudInicial = null,
  onClose,
  onResuelta,
}: RevisarSolicitudDialogProps) {
  const solicitudDeLaFila =
    solicitudInicial !== null && solicitudInicial.id_solicitud === idSolicitud
      ? solicitudInicial
      : null;

  const [idMostrado, setIdMostrado] = useState<number | null>(idSolicitud);
  const [detalle, setDetalle] = useState<Solicitud | null>(solicitudDeLaFila);
  const [cargando, setCargando] = useState(idSolicitud !== null && solicitudDeLaFila === null);
  const [comentario, setComentario] = useState('');
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [versionesExtra, setVersionesExtra] = useState<PropuestaVersion[]>([]);
  const [calculosAbiertos, setCalculosAbiertos] = useState(false);
  const [costosAbiertos, setCostosAbiertos] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  if (idMostrado !== idSolicitud) {
    setIdMostrado(idSolicitud);
    setDetalle(solicitudDeLaFila);
    setCargando(idSolicitud !== null && solicitudDeLaFila === null);
    setComentario('');
    setPidiendoMotivo(false);
    setAccionando(false);
    setVersionesExtra([]);
    setCalculosAbiertos(false);
    setCostosAbiertos(false);
    setConfirmando(false);
  }

  useEffect(() => {
    if (idSolicitud === null) return;

    let vigente = true;
    const mostrarFalla =
      solicitudInicial === null || solicitudInicial.id_solicitud !== idSolicitud;
    void (async () => {
      try {
        const res = await solicitudesApi.detalle(idSolicitud);
        if (!vigente) return;
        if (res.data.success && res.data.data) setDetalle(res.data.data);
        else if (mostrarFalla) toast.error(res.data.message ?? 'No se pudo cargar la solicitud.');
      } catch (falla: unknown) {
        if (vigente && mostrarFalla) {
          toast.error(toApiError(falla).message || 'No se pudo cargar la solicitud.');
        }
      } finally {
        if (vigente) setCargando(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, [idSolicitud, solicitudInicial]);

  const versiones = useMemo(() => {
    if (!detalle) return [];
    return fusionarVersiones(historialDePropuesta(detalle), versionesExtra);
  }, [detalle, versionesExtra]);

  const versionActual = versiones.length > 0 ? versiones[versiones.length - 1] : null;

  const versionBase = useMemo(() => {
    if (versionActual === null) return null;
    return {
      calculo: versionActual.calculo,
      opciones: opcionesDePropuesta(versionActual.opciones),
    };
  }, [versionActual]);

  const registrarPropuesta = useCallback(
    async (nueva: PropuestaRuta, origen: 'recalculo' | 'costos') => {
      if (idSolicitud === null) return;
      const numero = (versiones[versiones.length - 1]?.numero ?? 1) + 1;
      const version: PropuestaVersion = {
        numero,
        origen,
        creado_en: new Date().toISOString(),
        calculo: nueva.calculo,
        opciones: nueva.opciones,
        resumen: nueva.resumen,
      };
      setVersionesExtra((previo) => fusionarVersiones(previo, [version]));
      try {
        const res = await aprobacionesApi.guardarPropuesta(idSolicitud, {
          origen,
          calculo: nueva.calculo,
          opciones: nueva.opciones,
          resumen: nueva.resumen,
        });
        if (!res.data.success) {
          toast.error(
            res.data.message
              ?? 'La propuesta quedó en esta sesión, pero no se pudo guardar en el historial.',
          );
        }
      } catch (falla: unknown) {
        toast.error(
          toApiError(falla).message
            || 'La propuesta quedó en esta sesión, pero no se pudo guardar en el historial.',
        );
      }
    },
    [idSolicitud, versiones],
  );

  const autorizar = useCallback(async () => {
    if (idSolicitud === null) return;
    setConfirmando(false);
    setAccionando(true);
    try {
      const autorizaPropuesta = versionActual !== null && versionActual.numero > 1;
      const res = autorizaPropuesta && versionActual !== null
        ? await aprobacionesApi.autorizar(idSolicitud, {
            calculo: versionActual.calculo,
            opciones: versionActual.opciones,
          })
        : await aprobacionesApi.autorizar(idSolicitud);
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo autorizar la solicitud.');
        return;
      }
      onResuelta(
        autorizaPropuesta && versionActual !== null
          ? `Solicitud autorizada con la ${etiquetaPropuesta(versionActual.numero).toLowerCase()}. Ya está en el concentrado.`
          : 'Solicitud autorizada. Ya está en el concentrado.',
      );
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo autorizar la solicitud.');
    } finally {
      setAccionando(false);
    }
  }, [idSolicitud, onResuelta, versionActual]);

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
      setPidiendoMotivo(false);
      onResuelta('Solicitud rechazada. Vuelve a Mis viajes como borrador para corregirla.');
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
              Compara lo que pidió el solicitante con la ruta propuesta. Cada recálculo o edición de
              costos queda como una propuesta nueva; autoriza cuando los importes cuadren o rechaza
              con el motivo para que la corrijan.
            </DialogDescription>
          </DialogHeader>

          {cargando ? <p role="status">Cargando detalle…</p> : null}
          {detalle ? (
            <VistaDetalle
              solicitud={detalle}
              modoRevision
              pestanaInicial="comparar"
              versiones={versiones}
              pestanasVisibles={['comparar', 'calculada']}
              acciones={acciones}
            />
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={accionando || !detalle}
              onClick={() => setPidiendoMotivo(true)}
            >
              <X className="h-4 w-4" aria-hidden />
              Rechazar
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={accionando || !detalle}
              onClick={() => setConfirmando(true)}
            >
              <Check className="h-4 w-4" aria-hidden />
              Autorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmarAutorizacionDialog
        abierto={confirmando && detalle !== null}
        folio={folio}
        version={versionActual}
        procesando={accionando}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          void autorizar();
        }}
      />

      <RechazarSolicitudDialog
        abierto={pidiendoMotivo && detalle !== null}
        folio={folio}
        motivo={comentario}
        procesando={accionando}
        onMotivo={setComentario}
        onCancelar={() => setPidiendoMotivo(false)}
        onConfirmar={() => {
          void rechazar();
        }}
      />

      {detalle ? (
        <CalculosViajeModal
          solicitud={detalle}
          open={calculosAbiertos}
          onOpenChange={setCalculosAbiertos}
          onEnviado={() => setCalculosAbiertos(false)}
          modo="autorizar"
          onPropuesta={(nueva) => {
            void registrarPropuesta(nueva, 'recalculo');
          }}
        />
      ) : null}

      {costosAbiertos && versionBase ? (
        <EditarCostosDialog
          calculo={versionBase.calculo}
          opciones={versionBase.opciones}
          onOpenChange={(abierto) => {
            if (!abierto) setCostosAbiertos(false);
          }}
          onGuardar={(nueva) => {
            void registrarPropuesta(nueva, 'costos');
          }}
        />
      ) : null}
    </>
  );
}
