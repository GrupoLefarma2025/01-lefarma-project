import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface RechazarSolicitudDialogProps {
  abierto: boolean;
  folio: string;
  motivo: string;
  procesando: boolean;
  titulo?: string;
  descripcion?: string;
  etiquetaMotivo?: string;
  etiquetaConfirmar?: string;
  etiquetaProcesando?: string;
  onMotivo: (motivo: string) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export function RechazarSolicitudDialog({
  abierto,
  folio,
  motivo,
  procesando,
  titulo,
  descripcion = 'Quien la envió verá este motivo y podrá corregirla para volver a enviarla.',
  etiquetaMotivo = 'Motivo del rechazo',
  etiquetaConfirmar = 'Rechazar solicitud',
  etiquetaProcesando = 'Rechazando…',
  onMotivo,
  onCancelar,
  onConfirmar,
}: RechazarSolicitudDialogProps) {
  const sinMotivo = motivo.trim() === '';

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguiente) => {
        if (!siguiente) onCancelar();
      }}
    >
      <DialogContent data-testid="rechazar-solicitud" className="w-[92vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo ?? `¿Rechazar la solicitud ${folio}?`}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo-rechazo">{etiquetaMotivo}</Label>
          <Textarea
            id="motivo-rechazo"
            autoFocus
            rows={4}
            placeholder="Explica qué debe corregirse."
            value={motivo}
            disabled={procesando}
            onChange={(evento) => onMotivo(evento.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            El motivo es obligatorio y queda registrado en la solicitud.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            disabled={sinMotivo || procesando}
            onClick={onConfirmar}
          >
            {procesando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <X className="h-4 w-4" aria-hidden />
            )}
            {procesando ? etiquetaProcesando : etiquetaConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
