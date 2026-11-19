import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { aprobacionesApi } from '../../services/aprobaciones.api';
import { solicitudesApi } from '../../services/solicitudes.api';
import type { Solicitud } from '../../types/solicitud.types';
import { VistaDetalle } from '../mis-viajes/MisViajesPage';

export interface RevisarSolicitudDialogProps {
  /** Solicitud a revisar; `null` mantiene el diálogo cerrado. */
  idSolicitud: number | null;
  onClose: () => void;
  /** Se llama después de autorizar o rechazar con el mensaje a mostrar. */
  onResuelta: (mensaje: string) => void;
}

/**
 * Revisión de una solicitud pendiente: el mismo detalle que ve el solicitante
 * en Mis viajes, con las dos únicas salidas del punto de autorización.
 */
export function RevisarSolicitudDialog({ idSolicitud, onClose, onResuelta }: RevisarSolicitudDialogProps) {
  const [detalle, setDetalle] = useState<Solicitud | null>(null);
  const [cargando, setCargando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [accionando, setAccionando] = useState(false);

  useEffect(() => {
    if (idSolicitud === null) {
      setDetalle(null);
      setComentario('');
      return;
    }

    let vigente = true;
    setDetalle(null);
    setComentario('');
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

  const autorizar = useCallback(async () => {
    if (idSolicitud === null) return;
    setAccionando(true);
    try {
      const res = await aprobacionesApi.autorizar(idSolicitud);
      if (!res.data.success) {
        toast.error(res.data.message ?? 'No se pudo autorizar la solicitud.');
        return;
      }
      onResuelta('Solicitud autorizada. Ya está lista para el concentrado.');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo autorizar la solicitud.');
    } finally {
      setAccionando(false);
    }
  }, [idSolicitud, onResuelta]);

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

  return (
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
            Autoriza para que pase al concentrado o rechaza con el motivo para que el solicitante la corrija.
          </DialogDescription>
        </DialogHeader>

        {cargando ? <p role="status">Cargando detalle…</p> : null}
        {detalle ? <VistaDetalle solicitud={detalle} modoRevision pestanaInicial="autorizada" /> : null}

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
            <Check className="h-4 w-4" aria-hidden /> Autorizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
