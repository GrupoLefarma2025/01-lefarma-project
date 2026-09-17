import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import type {
  WorkflowFlowResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import { WorkflowHistorial } from '@/components/workflows/WorkflowHistorial';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { HistorialWorkflowItem } from '@/apps/educacion-medica/types/educacionMedica.types';
import { toApiError } from '@/utils/errors';
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
 * Historial de un documento de Educación Médica, separado en Flujo (dónde está
 * el documento) y Bitácora (qué ocurrió). Independiente del detalle y la firma,
 * compartido por la Bandeja y el listado de Selecciones Mensuales.
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

  const idxActual = useMemo(
    () => pasosFlujo.findIndex((p) => p.idPaso === idPasoActual),
    [pasosFlujo, idPasoActual]
  );

  return (
    <Modal
      id="modal-documento-historial"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <span>Historial del documento</span>
        </div>
      }
      size="full"
    >
      <div className="space-y-5">
        <div className="bg-muted/30 rounded-md border p-3">
          <p className="text-sm font-semibold">{documento}</p>
          <p className="text-xs text-muted-foreground">Estado actual: {estadoTexto}</p>
        </div>

        {cargando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {pasosFlujo.length > 0 && (
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Flujo
                </h4>
                <div className="space-y-1">
                  {pasosFlujo.map((paso, idx) => {
                    const completado = idxActual !== -1 && idx < idxActual;
                    const actual = paso.idPaso === idPasoActual;
                    return (
                      <div key={paso.idPaso} className="flex items-center gap-2 text-sm">
                        {completado ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : actual ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Actual
                          </Badge>
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/50" />
                        )}
                        <span
                          className={
                            actual
                              ? 'font-medium'
                              : completado
                                ? 'text-muted-foreground'
                                : 'text-muted-foreground/70'
                          }
                        >
                          {paso.nombrePaso}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bitácora
              </h4>
              <WorkflowHistorial items={historial} />
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
