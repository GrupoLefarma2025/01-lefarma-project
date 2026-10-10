import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import type {
  WorkflowFlowResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { HistorialWorkflowItem } from '@/apps/educacion-medica/types/educacionMedica.types';
import { toApiError } from '@/utils/errors';
import { WorkflowHistorialModal } from '@/components/workflows/WorkflowHistorialModal';
import type { TipoDocumentoEm } from './documentoEntidad';

// Los pasos de los workflows son configuración estable: se cachean por sesión.
let cacheFlujo: Map<number, WorkflowFlowResponse> | null = null;

interface DocumentoHistorialModalProps {
  open: boolean;
  onClose: () => void;
  documento: string;
  estadoTexto: string;
  tipo: TipoDocumentoEm;
  idEntidad: number;
  idWorkflow?: number | null;
  idPasoActual?: number | null;
}

/**
 * Historial de un documento de Educación Médica. Carga la bitácora y el flujo,
 * y delega la vista en el modal compartido (`WorkflowHistorialModal`) que usan
 * todos los módulos.
 */
export function DocumentoHistorialModal({
  open,
  onClose,
  documento,
  estadoTexto,
  tipo,
  idEntidad,
  idWorkflow,
  idPasoActual,
}: DocumentoHistorialModalProps) {
  const [cargando, setCargando] = useState(false);
  const [historial, setHistorial] = useState<HistorialWorkflowItem[]>([]);
  const [workflowsFlow, setWorkflowsFlow] = useState<Map<number, WorkflowFlowResponse> | null>(
    () => cacheFlujo
  );

  const [aperturaAnterior, setAperturaAnterior] = useState(false);
  if (open !== aperturaAnterior) {
    setAperturaAnterior(open);
    if (open) {
      setCargando(true);
      setHistorial([]);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    const historialPromise =
      tipo === 'seleccion'
        ? educacionMedicaApi.seleccionesMensuales.historial(idEntidad)
        : educacionMedicaApi.rutas.historialVersion(idEntidad);

    const flujoPromise = cacheFlujo
      ? Promise.resolve(null)
      : API.get<ApiResponse<WorkflowFlowResponse[]>>('/config/workflows/flow').then((res) => {
          if (res.data.success && res.data.data) {
            const map = new Map<number, WorkflowFlowResponse>();
            for (const w of res.data.data) map.set(w.idWorkflow, w);
            cacheFlujo = map;
          }
          return null;
        });

    Promise.all([historialPromise, flujoPromise])
      .then(([histRes]) => {
        if (cancelado) return;
        if (histRes.data.success) setHistorial(histRes.data.data ?? []);
        if (cacheFlujo) setWorkflowsFlow(cacheFlujo);
      })
      .catch((error: unknown) => {
        if (!cancelado) {
          toast.error(toApiError(error).message ?? 'No se pudo cargar el historial');
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [open, tipo, idEntidad]);

  const pasosFlujo: WorkflowPasoFlowResponse[] = useMemo(() => {
    if (!idWorkflow || !workflowsFlow) return [];
    const workflow = workflowsFlow.get(idWorkflow);
    return (workflow?.pasos ?? []).filter((p) => p.activo).sort((a, b) => a.orden - b.orden);
  }, [idWorkflow, workflowsFlow]);

  return (
    <WorkflowHistorialModal
      open={open}
      onClose={onClose}
      titulo="Historial del documento"
      encabezado={
        <div className="bg-muted/30 rounded-md border p-3">
          <p className="text-sm font-semibold">{documento}</p>
          <p className="text-xs text-muted-foreground">Estado actual: {estadoTexto}</p>
        </div>
      }
      cargando={cargando}
      idPasoActual={idPasoActual ?? null}
      estadoNombre={estadoTexto}
      pasos={pasosFlujo}
      historial={historial}
    />
  );
}
