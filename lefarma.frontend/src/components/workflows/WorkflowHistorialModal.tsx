import type { ReactNode } from 'react';
import { Modal } from '@/components/ui/modal';
import { History, Loader2 } from 'lucide-react';
import type {
  HistorialWorkflowItemResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import { WorkflowFlujoTimeline } from './WorkflowFlujoTimeline';

interface WorkflowHistorialModalProps {
  open: boolean;
  onClose: () => void;
  titulo?: string;
  encabezado?: ReactNode;
  cargando?: boolean;
  idPasoActual: number | null;
  estadoNombre?: string | null;
  pasos: WorkflowPasoFlowResponse[];
  historial: HistorialWorkflowItemResponse[];
  responsablesPorPaso?: ReadonlyMap<number, string[]>;
  descripcion?: string;
}

export function WorkflowHistorialModal({
  open,
  onClose,
  titulo = 'Historial',
  encabezado,
  cargando = false,
  idPasoActual,
  estadoNombre,
  pasos,
  historial,
  responsablesPorPaso,
  descripcion,
}: WorkflowHistorialModalProps) {
  return (
    <Modal
      id="modal-workflow-historial"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <span>{titulo}</span>
        </div>
      }
      size="full"
      compact
    >
      {encabezado && <div className="mb-2">{encabezado}</div>}
      {cargando ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando historial...
        </div>
      ) : (
        <WorkflowFlujoTimeline
          idPasoActual={idPasoActual}
          estadoNombre={estadoNombre}
          pasos={pasos}
          historial={historial}
          responsablesPorPaso={responsablesPorPaso}
          descripcion={descripcion}
        />
      )}
    </Modal>
  );
}
