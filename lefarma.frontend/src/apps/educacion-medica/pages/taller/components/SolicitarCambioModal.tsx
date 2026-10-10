import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { Taller } from '@/apps/educacion-medica/types/educacionMedica.types';

const aTexto = (valor: string | number | null | undefined) =>
  valor == null ? '' : String(valor);
const aNumero = (valor: string): number | null => {
  const limpio = valor.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};
const aTextoONull = (valor: string): string | null => {
  const limpio = valor.trim();
  return limpio ? limpio : null;
};

const fmtFecha = (fecha: string | null | undefined) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

interface SolicitarCambioModalProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
  onCreated: () => void;
}

/**
 * "Solicitar cambio" del equipo (ADR-00010): con el candado puesto o la matriz fuera
 * de captura, el cambio viaja como solicitud al CEM (diff antes/después + motivo).
 */
export function SolicitarCambioModal({
  open,
  onClose,
  taller,
  onCreated,
}: SolicitarCambioModalProps) {
  const [fechaTaller, setFechaTaller] = useState('');
  const [horaTaller, setHoraTaller] = useState('');
  const [lugar, setLugar] = useState('');
  const [numeroParticipantes, setNumeroParticipantes] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open && taller) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga del diff al abrir el modal
      setFechaTaller(aTexto(taller.fechaTaller?.slice(0, 10)));
      setHoraTaller(aTexto(taller.horaTaller?.slice(0, 5)));
      setLugar(aTexto(taller.lugar));
      setNumeroParticipantes(aTexto(taller.numeroParticipantes));
      setMotivo('');
    }
  }, [open, taller]);

  const enviar = async () => {
    if (!taller) return;
    if (motivo.trim().length < 5) {
      toast.error('El motivo de la solicitud es obligatorio.');
      return;
    }

    const payload: {
      motivo: string;
      fechaTaller?: string | null;
      horaTaller?: string | null;
      lugar?: string | null;
      numeroParticipantes?: number | null;
    } = { motivo: motivo.trim() };

    const fechaNueva = aTextoONull(fechaTaller);
    const horaNueva = aTextoONull(horaTaller);
    const lugarNuevo = aTextoONull(lugar);
    const participantesNuevo = aNumero(numeroParticipantes);

    if (fechaNueva && fechaNueva !== taller.fechaTaller?.slice(0, 10)) payload.fechaTaller = fechaNueva;
    if (horaNueva && horaNueva !== taller.horaTaller?.slice(0, 5)) payload.horaTaller = horaNueva;
    if (lugarNuevo && lugarNuevo !== taller.lugar) payload.lugar = lugarNuevo;
    if (participantesNuevo != null && participantesNuevo !== taller.numeroParticipantes) {
      payload.numeroParticipantes = participantesNuevo;
    }

    if (Object.keys(payload).length <= 1) {
      toast.error('Modifica al menos un campo (fecha, hora, lugar o participantes).');
      return;
    }

    setGuardando(true);
    try {
      const res = await educacionMedicaApi.talleres.crearSolicitudCambio(taller.idTaller, payload);
      if (res.data.success) {
        toast.success('Solicitud enviada al Coordinador de Educación Médica.');
        onCreated();
        onClose();
      } else {
        toast.error(res.data.message ?? 'No se pudo enviar la solicitud');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo enviar la solicitud');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      id="modal-solicitar-cambio"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={`Solicitar cambio del taller${taller?.nombreHospital ? ` — ${taller.nombreHospital}` : ''}`}
      size="wide"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={guardando}>
            {guardando ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
        </div>
      }
    >
      {taller && (
        <div className="space-y-4">
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            El documento está bloqueado o fuera de captura: el Coordinador de Educación Médica
            resolverá tu solicitud desde la Matriz General. Al aprobarla se aplica el cambio con
            auditoría (motivo, antes/después).
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Fecha del taller</Label>
              <Input type="date" value={fechaTaller} onChange={(e) => setFechaTaller(e.target.value)} />
              <p className="text-xs text-muted-foreground">Actual: {fmtFecha(taller.fechaTaller)}</p>
            </div>
            <div className="space-y-1">
              <Label>Hora</Label>
              <Input type="time" value={horaTaller} onChange={(e) => setHoraTaller(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Actual: {taller.horaTaller?.slice(0, 5) ?? '—'}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Lugar</Label>
              <Input value={lugar} onChange={(e) => setLugar(e.target.value)} />
              <p className="text-xs text-muted-foreground">Actual: {taller.lugar ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <Label>No. de participantes</Label>
              <Input
                type="number"
                min={0}
                value={numeroParticipantes}
                onChange={(e) => setNumeroParticipantes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Actual: {taller.numeroParticipantes ?? '—'}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Motivo de la solicitud *</Label>
            <Textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explica por qué se requiere el cambio"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
