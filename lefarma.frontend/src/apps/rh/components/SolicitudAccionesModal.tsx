import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { FileSignature } from 'lucide-react';
import { InlineLoader } from '@/components/ui/inline-loader';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import type { AccionDisponibleResponse, FirmarRequest } from '@/types/solicitudPersonalWorkflow.types';
import { SolicitudHeaderCard } from './SolicitudHeaderCard';
import { SolicitudFirmaTab } from './SolicitudFirmaTab';
import { SolicitudFirmaModal } from './SolicitudFirmaModal';

interface SolicitudAccionesModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  solicitud: SolicitudPersonalResponse | null;
  acciones: AccionDisponibleResponse[];
  getEstadoInfo: (solicitud: Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'> | null | undefined) => { nombre: string; color: string };
  onFirmar: (req: FirmarRequest) => Promise<boolean>;
  isSubmittingFirma: boolean;
}

export type { SolicitudAccionesModalProps };

export function SolicitudAccionesModal({
  open,
  onClose,
  loading,
  solicitud,
  acciones,
  getEstadoInfo,
  onFirmar,
  isSubmittingFirma,
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
        setOpen={(o) => { if (!o) handleClose(); }}
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
          />
        )}
      </Modal>

      {solicitud && (
        <SolicitudFirmaModal
          open={accionParaFirma !== null}
          onClose={() => setAccionParaFirma(null)}
          accion={accionParaFirma}
          solicitud={solicitud}
          getEstadoInfo={getEstadoInfo}
          onSubmit={onFirmar}
          isSubmitting={isSubmittingFirma}
        />
      )}
    </>
  );
}