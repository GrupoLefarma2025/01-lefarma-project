import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { RutaVisita } from '@/apps/educacion-medica/types/educacionMedica.types';

interface HorasVisitaModalProps {
  open: boolean;
  onClose: () => void;
  visita: RutaVisita | null;
  /** En modo ajuste (versión Cerrada) el motivo es obligatorio (ADR-00010). */
  requiereMotivo: boolean;
  guardando?: boolean;
  onGuardar: (
    horas: { horaSalida: string | null; horaLlegada: string | null },
    motivo?: string
  ) => void | Promise<void>;
}

/** Edición de hora_salida/hora_llegada de una visita (normal en Creada; auditada en Cerrada). */
export function HorasVisitaModal({
  open,
  onClose,
  visita,
  requiereMotivo,
  guardando,
  onGuardar,
}: HorasVisitaModalProps) {
  const [horaSalida, setHoraSalida] = useState('');
  const [horaLlegada, setHoraLlegada] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (open && visita) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio del formulario al abrir el modal
      setHoraSalida(visita.horaSalida?.slice(0, 5) ?? '');
      setHoraLlegada(visita.horaLlegada?.slice(0, 5) ?? '');
      setMotivo('');
    }
  }, [open, visita]);

  const guardar = async () => {
    if (requiereMotivo && motivo.trim().length < 5) {
      toast.error('El motivo del ajuste es obligatorio.');
      return;
    }
    await onGuardar(
      {
        horaSalida: horaSalida.trim() ? horaSalida : null,
        horaLlegada: horaLlegada.trim() ? horaLlegada : null,
      },
      requiereMotivo ? motivo.trim() : undefined
    );
  };

  return (
    <Modal
      id="modal-horas-visita"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={`Horas de la visita${visita?.nombreHospital ? ` — ${visita.nombreHospital}` : ''}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar horas'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Hora de salida</Label>
            <Input
              type="time"
              value={horaSalida}
              onChange={(e) => setHoraSalida(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Hora de llegada</Label>
            <Input
              type="time"
              value={horaLlegada}
              onChange={(e) => setHoraLlegada(e.target.value)}
            />
          </div>
        </div>
        {requiereMotivo && (
          <div className="space-y-1">
            <Label>Motivo del ajuste *</Label>
            <Textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explica el motivo (queda auditado)"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
