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
  /** Título del modal; cada módulo puede ajustarlo (p. ej. "Historial de solicitud"). */
  titulo?: string;
  /** Encabezado opcional del documento (card u otro resumen) mostrado antes del timeline. */
  encabezado?: ReactNode;
  cargando?: boolean;
  idPasoActual: number | null;
  estadoNombre?: string | null;
  pasos: WorkflowPasoFlowResponse[];
  historial: HistorialWorkflowItemResponse[];
  /** Subtítulo del timeline; por defecto "Paso a paso del documento". */
  descripcion?: string;
}

/**
 * Modal de historial (línea de tiempo del flujo) compartido por todos los módulos:
 * mismas tablas y timeline; solo cambia el título y el encabezado según de dónde se abra.
 */
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
          <History className="h-5 w-5" />
          <span>{titulo}</span>
        </div>
      }
      size="full"
    >
      {encabezado && <div className="mb-4">{encabezado}</div>}
      {cargando ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando historial...
        </div>
      ) : (
        <WorkflowFlujoTimeline
          idPasoActual={idPasoActual}
          estadoNombre={estadoNombre}
          pasos={pasos}
          historial={historial}
          descripcion={descripcion}
        />
      )}
    </Modal>
  );
}
