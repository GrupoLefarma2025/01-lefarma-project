import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { FileSignature } from 'lucide-react';
import { WorkflowAccionesPanel } from '@/components/workflows/WorkflowAccionesPanel';
import { WorkflowAccionModal } from '@/components/workflows/WorkflowAccionModal';
import type { AccionWorkflow } from '@/components/workflows/workflowAccion';
import { ENTIDAD_ARCHIVOS, type TipoDocumentoEm } from './documentoEntidad';

interface DocumentoFirmaModalProps {
  open: boolean;
  onClose: () => void;
  /** Encabezado del documento, p. ej. "Selección mensual 09/2026". */
  documento: string;
  estadoTexto: string;
  pasoNombre?: string | null;
  tipo: TipoDocumentoEm;
  idEntidad: number;
  idPasoActual?: number | null;
  acciones: AccionWorkflow[];
  hasFirma?: boolean;
  guardando?: boolean;
  onConfirmar: (
    accion: AccionWorkflow,
    comentario?: string,
    datosAdicionales?: Record<string, unknown> | null
  ) => boolean | Promise<boolean>;
}

/**
 * Modal de firma de un documento de Educación Médica: lista las acciones
 * disponibles del paso actual y abre el formulario dinámico (WorkflowAccionModal)
 * al elegir una. Compartido por la Bandeja de Autorizaciones, el listado de
 * Selecciones Mensuales y la planificación de Rutas (mismo endpoint, mismas
 * validaciones).
 *
 * Patrón RH: al confirmar una acción solo se cierra el formulario; la lista de
 * acciones queda abierta y se refresca con las acciones restantes. `onConfirmar`
 * devuelve `true` cuando la acción se aplicó.
 */
export function DocumentoFirmaModal({
  open,
  onClose,
  documento,
  estadoTexto,
  pasoNombre,
  tipo,
  idEntidad,
  idPasoActual,
  acciones,
  hasFirma,
  guardando,
  onConfirmar,
}: DocumentoFirmaModalProps) {
  const [accionPendiente, setAccionPendiente] = useState<AccionWorkflow | null>(null);

  // En cada transición del modal se parte de la lista de acciones (sin acción elegida).
  const [aperturaAnterior, setAperturaAnterior] = useState(false);
  if (open !== aperturaAnterior) {
    setAperturaAnterior(open);
    setAccionPendiente(null);
  }

  const entidad = ENTIDAD_ARCHIVOS[tipo];

  return (
    <>
      <Modal
        id="modal-documento-firma"
        open={open}
        setOpen={(o) => {
          if (!o) {
            setAccionPendiente(null);
            onClose();
          }
        }}
        title={
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            <span>Firma de documento</span>
          </div>
        }
        size="lg"
      >
        <div className="space-y-3">
          <div className="bg-muted/30 rounded-md border p-3">
            <p className="text-sm font-semibold">{documento}</p>
            <p className="text-xs text-muted-foreground">
              Estado actual: {estadoTexto}
              {pasoNombre ? ` · Paso: ${pasoNombre}` : ''}
            </p>
          </div>
          <WorkflowAccionesPanel
            acciones={acciones}
            onAccionClick={setAccionPendiente}
            isSubmitting={guardando}
            hasFirma={hasFirma}
          />
        </div>
      </Modal>

      <WorkflowAccionModal
        open={accionPendiente !== null}
        onClose={() => setAccionPendiente(null)}
        accion={accionPendiente}
        tituloEntidad={documento}
        hasFirma={hasFirma}
        guardando={guardando}
        entidadTipo={entidad.tipo}
        entidadId={idEntidad}
        carpetaAdjuntos={entidad.carpeta}
        idPasoActual={idPasoActual}
        onConfirmar={async (comentario, datosAdicionales) => {
          if (!accionPendiente) return;
          const ok = await onConfirmar(accionPendiente, comentario, datosAdicionales);
          if (ok) setAccionPendiente(null);
        }}
      />
    </>
  );
}
