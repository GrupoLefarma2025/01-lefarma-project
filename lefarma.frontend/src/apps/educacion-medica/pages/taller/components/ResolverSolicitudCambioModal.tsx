import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  Taller,
  TallerSolicitudCambioResumen,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface SolicitudDatos {
  antes?: {
    fechaTaller?: string | null;
    horaTaller?: string | null;
    lugar?: string | null;
    numeroParticipantes?: number | null;
  } | null;
  despues?: {
    fechaTaller?: string | null;
    horaTaller?: string | null;
    lugar?: string | null;
    numeroParticipantes?: number | null;
  } | null;
  motivoSolicitante?: string | null;
}

const fmtFecha = (fecha: string | null | undefined) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

const fmtValor = (campo: keyof NonNullable<SolicitudDatos['antes']>, valor: unknown) => {
  if (valor == null || valor === '') return '—';
  if (campo === 'fechaTaller') return fmtFecha(String(valor));
  if (campo === 'horaTaller') return String(valor).slice(0, 5);
  return String(valor);
};

const CAMPOS: { campo: keyof NonNullable<SolicitudDatos['antes']>; etiqueta: string }[] = [
  { campo: 'fechaTaller', etiqueta: 'Fecha' },
  { campo: 'horaTaller', etiqueta: 'Hora' },
  { campo: 'lugar', etiqueta: 'Lugar' },
  { campo: 'numeroParticipantes', etiqueta: 'Participantes' },
];

interface ResolverSolicitudCambioModalProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
  solicitud: TallerSolicitudCambioResumen | null;
  onResolved: () => void;
}

/**
 * Resolución de la solicitud de cambio del equipo por el CEM (ADR-00010):
 * aprobar aplica el ajuste (misma lógica + auditoría); rechazar solo registra motivo.
 */
export function ResolverSolicitudCambioModal({
  open,
  onClose,
  taller,
  solicitud,
  onResolved,
}: ResolverSolicitudCambioModalProps) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpieza del motivo al abrir el modal
    if (open) setMotivo('');
  }, [open]);

  const datos = useMemo<SolicitudDatos | null>(() => {
    if (!solicitud?.datosJson) return null;
    try {
      return JSON.parse(solicitud.datosJson) as SolicitudDatos;
    } catch {
      return null;
    }
  }, [solicitud]);

  const resolver = async (aprobar: boolean) => {
    if (!solicitud) return;
    if (motivo.trim().length < 5) {
      toast.error('El motivo de la resolución es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      const res = await educacionMedicaApi.talleres.resolverSolicitudCambio(solicitud.idSolicitud, {
        aprobar,
        motivo: motivo.trim(),
      });
      if (res.data.success) {
        toast.success(aprobar ? 'Solicitud aprobada y ajuste aplicado.' : 'Solicitud rechazada.');
        onResolved();
        onClose();
      } else {
        toast.error(res.data.message ?? 'No se pudo resolver la solicitud');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo resolver la solicitud');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      id="modal-resolver-solicitud-cambio"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={`Resolver solicitud de cambio${taller?.nombreHospital ? ` — ${taller.nombreHospital}` : ''}`}
      size="wide"
      footer={
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cerrar
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => void resolver(false)}
            disabled={guardando}
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            Rechazar
          </Button>
          <Button onClick={() => void resolver(true)} disabled={guardando}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {guardando ? 'Aplicando...' : 'Autorizar y aplicar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Pendiente</Badge>
          <span>
            Solicitó {solicitud?.nombreSolicitante ?? 'el equipo'} ·{' '}
            {solicitud?.fecha ? new Date(solicitud.fecha).toLocaleString('es-MX') : ''}
          </span>
        </div>

        {datos?.motivoSolicitante && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Motivo del solicitante: </span>
            {datos.motivoSolicitante}
          </p>
        )}

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="px-3 py-1.5 text-left">Campo</th>
                <th className="px-3 py-1.5 text-left">Antes</th>
                <th className="px-3 py-1.5 text-left">Después</th>
              </tr>
            </thead>
            <tbody>
              {CAMPOS.map(({ campo, etiqueta }) => (
                <tr key={campo} className="border-t">
                  <td className="px-3 py-1.5 text-muted-foreground">{etiqueta}</td>
                  <td className="px-3 py-1.5">{fmtValor(campo, datos?.antes?.[campo])}</td>
                  <td className="px-3 py-1.5 font-medium">
                    {fmtValor(campo, datos?.despues?.[campo])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <Label>Motivo de la resolución *</Label>
          <Textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explica la decisión (obligatorio)"
          />
          <p className="text-xs text-muted-foreground">
            Al autorizar se aplica el ajuste con la misma lógica del ajuste post-cierre (límite de
            días, sincronización de la visita de ruta y auditoría). Al rechazar no cambia nada.
          </p>
        </div>
      </div>
    </Modal>
  );
}
