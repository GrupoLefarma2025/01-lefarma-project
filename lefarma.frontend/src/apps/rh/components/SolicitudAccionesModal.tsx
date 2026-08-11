import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/components/ui/modal';
import { FileSignature } from 'lucide-react';
import { InlineLoader } from '@/components/ui/inline-loader';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import type {
  AccionDisponibleResponse,
  FirmarRequest,
  HistorialWorkflowItemResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import { SolicitudHeaderCard } from './SolicitudHeaderCard';
import { SolicitudFirmaTab } from './SolicitudFirmaTab';
import { SolicitudFirmaModal } from './SolicitudFirmaModal';
import { SolicitudPersonalPDF } from './PDF/SolicitudPersonalPDF';

interface SolicitudAccionesModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  solicitud: SolicitudPersonalResponse | null;
  acciones: AccionDisponibleResponse[];
  historial?: HistorialWorkflowItemResponse[];
  pasosWorkflow?: WorkflowPasoFlowResponse[];
  getEstadoInfo: (
    solicitud:
      | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
      | null
      | undefined
  ) => { nombre: string; color: string };
  onFirmar: (req: FirmarRequest) => Promise<boolean>;
  onEnviarDirector?: (req: FirmarRequest, pdfBlob: Blob) => Promise<boolean>;
  isSubmittingFirma: boolean;
  hasFirma?: boolean;
}

export type { SolicitudAccionesModalProps };

export function SolicitudAccionesModal({
  open,
  onClose,
  loading,
  solicitud,
  acciones,
  historial = [],
  pasosWorkflow = [],
  getEstadoInfo,
  onFirmar,
  onEnviarDirector,
  isSubmittingFirma,
  hasFirma = true,
}: SolicitudAccionesModalProps) {
  const [accionParaFirma, setAccionParaFirma] = useState<AccionDisponibleResponse | null>(null);

  const handleClose = () => {
    setAccionParaFirma(null);
    onClose();
  };

  return (
    <>
      <Modal
        id="modal-solicitud-acciones"
        open={open}
        setOpen={(o) => {
          if (!o) handleClose();
        }}
        title={
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            <span>Firma de solicitud</span>
          </div>
        }
        size="lg"
      >
        {solicitud && (
          <div className="mb-4">
            <SolicitudHeaderCard solicitud={solicitud} getEstadoInfo={getEstadoInfo} />
          </div>
        )}

        {loading && <InlineLoader message="Cargando acciones disponibles..." />}

        {!loading && !solicitud && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <FileSignature className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Selecciona una solicitud para ver sus acciones</p>
          </div>
        )}

        {!loading && solicitud && (
          <SolicitudFirmaTab
            acciones={acciones}
            onAccionClick={setAccionParaFirma}
            isSubmittingFirma={isSubmittingFirma}
            hasFirma={hasFirma}
          />
        )}
      </Modal>

      {solicitud && (
        <SolicitudFirmaModal
          open={accionParaFirma !== null}
          onClose={() => setAccionParaFirma(null)}
          accion={accionParaFirma}
          solicitud={solicitud}
          historial={historial}
          pasosWorkflow={pasosWorkflow}
          getEstadoInfo={getEstadoInfo}
          onSubmit={onFirmar}
          onEnviarDirector={onEnviarDirector}
          isSubmitting={isSubmittingFirma}
        />
      )}

      {solicitud &&
        accionParaFirma?.tipoAccionCodigo === 'ENVIAR_DIRECTOR' &&
        createPortal(
          <div
            id="solicitud-personal-envio-director-pdf-portal"
            style={{
              position: 'fixed',
              left: '-9999px',
              top: 0,
              width: '820px',
              minWidth: '820px',
              minHeight: '1px',
              height: 'auto',
              background: '#ffffff',
            }}
          >
            <SolicitudPersonalPDF
              solicitud={solicitud}
              historial={historial}
              pasosWorkflow={pasosWorkflow}
            />
          </div>,
          document.body
        )}
    </>
  );
}
