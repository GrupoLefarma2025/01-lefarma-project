import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface MotivoDialogProps {
  open: boolean;
  onClose: () => void;
  titulo: string;
  descripcion?: string;
  confirmLabel?: string;
  guardando?: boolean;
  onConfirmar: (motivo: string) => void | Promise<void>;
}

/**
 * Diálogo de motivo del modo ajuste (ADR-00010): todo cambio post-cierre exige
 * motivo obligatorio y queda auditado en ajustes_post_cierre.
 */
export function MotivoDialog({
  open,
  onClose,
  titulo,
  descripcion,
  confirmLabel = 'Aplicar ajuste',
  guardando,
  onConfirmar,
}: MotivoDialogProps) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpieza del motivo al abrir el diálogo
    if (open) setMotivo('');
  }, [open]);

  const confirmar = async () => {
    if (motivo.trim().length < 5) {
      toast.error('El motivo es obligatorio (mínimo 5 caracteres).');
      return;
    }
    await onConfirmar(motivo.trim());
  };

  return (
    <Modal
      id="modal-motivo-ajuste"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={titulo}
      size="sm"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={guardando}>
            {guardando ? 'Aplicando...' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
        <div className="space-y-1">
          <Label>Motivo *</Label>
          <Textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explica el motivo del ajuste (queda en la auditoría)"
          />
        </div>
      </div>
    </Modal>
  );
}
