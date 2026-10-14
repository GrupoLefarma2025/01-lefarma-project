import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, CheckCircle2, Loader2, PlayCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  Taller,
  TallerEstadoHistorial,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface TallerHistorialEstadosModalProps {
  open: boolean;
  onClose: () => void;
  taller: Taller | null;
}

/** Historial de transiciones del taller (taller_estados_historial; ADR-00008). */
export function TallerHistorialEstadosModal({
  open,
  onClose,
  taller,
}: TallerHistorialEstadosModalProps) {
  const [historial, setHistorial] = useState<TallerEstadoHistorial[]>([]);
  const [loading, setLoading] = useState(false);

  const idTaller = taller?.idTaller ?? null;

  const cargar = useCallback(async () => {
    if (idTaller == null) return;
    setLoading(true);
    try {
      const res = await educacionMedicaApi.talleres.estados(idTaller);
      if (res.data.success) {
        setHistorial(res.data.data ?? []);
      } else {
        toast.error(res.data.message ?? 'No se pudo cargar el historial');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [idTaller]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al abrir el modal; los setState ocurren tras el await
    if (open) void cargar();
  }, [open, cargar]);

  return (
    <Modal
      id="modal-taller-historial-estados"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={`Historial de estados${taller?.nombreHospital ? ` — ${taller.nombreHospital}` : ''}`}
      size="wide"
      footer={
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : historial.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Sin transiciones registradas.
        </p>
      ) : (
        <ul className="space-y-2">
          {historial.map((evento) => (
            <li
              key={evento.idHistorial}
              className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              {evento.estadoNuevo === 'Realizado' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : evento.estadoNuevo === 'Cancelado' ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : evento.estadoNuevo === 'EnCurso' ? (
                <PlayCircle className="h-4 w-4 text-blue-600" />
              ) : (
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">
                {evento.estadoAnterior ?? '—'} → {evento.estadoNuevo}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {evento.origen === 'Automatico' ? 'Automático' : 'Manual'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {evento.nombreUsuario ?? 'Sistema'} ·{' '}
                {new Date(evento.fecha).toLocaleString('es-MX')}
              </span>
              {evento.motivo && <span className="text-xs italic">“{evento.motivo}”</span>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
