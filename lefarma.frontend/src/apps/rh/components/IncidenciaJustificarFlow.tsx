import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { IncidenciaChecadoResponse } from '@/types/solicitudPersonal.types';
import { IncidenciaModal } from './MiCalendario';
import { CrearSolicitud } from './CrearSolicitud';

interface IncidenciaJustificarFlowProps {
  incidencia: IncidenciaChecadoResponse | null;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Flujo compartido "ver incidencia → justificar incidencia":
 * abre el detalle de la incidencia y encadena el formulario de creación
 * de solicitud con la incidencia preseleccionada.
 */
export function IncidenciaJustificarFlow({
  incidencia,
  onClose,
  onSaved,
}: IncidenciaJustificarFlowProps) {
  const [incidenciaParaSolicitud, setIncidenciaParaSolicitud] =
    useState<IncidenciaChecadoResponse | null>(null);
  const [solicitudModalOpen, setSolicitudModalOpen] = useState(false);
  const [confirmCloseCrear, setConfirmCloseCrear] = useState(false);
  const crearDirtyRef = useRef(false);

  const handleAddSolicitud = () => {
    setIncidenciaParaSolicitud(incidencia);
    onClose();
    crearDirtyRef.current = false;
    setSolicitudModalOpen(true);
  };

  return (
    <>
      <IncidenciaModal
        incidencia={incidencia}
        open={incidencia !== null}
        onClose={onClose}
        onAddSolicitud={handleAddSolicitud}
      />

      <Modal
        id="modal-crear-solicitud-incidencia"
        open={solicitudModalOpen}
        setOpen={(o) => {
          if (!o) setSolicitudModalOpen(false);
        }}
        beforeClose={() => {
          if (!crearDirtyRef.current) return true;
          setConfirmCloseCrear(true);
          return false;
        }}
        title={
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <span>Crear solicitud</span>
          </div>
        }
        size="full"
      >
        <CrearSolicitud
          incidencia={incidenciaParaSolicitud}
          fechaInicial={incidenciaParaSolicitud?.fecha}
          onDirtyChange={(dirty) => {
            crearDirtyRef.current = dirty;
          }}
          onClose={() => setSolicitudModalOpen(false)}
          onSaved={() => {
            setSolicitudModalOpen(false);
            setIncidenciaParaSolicitud(null);
            onSaved?.();
          }}
        />
      </Modal>

      <AlertDialog open={confirmCloseCrear} onOpenChange={setConfirmCloseCrear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes datos capturados en la solicitud. Si cierras ahora, se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                crearDirtyRef.current = false;
                setConfirmCloseCrear(false);
                setSolicitudModalOpen(false);
              }}
            >
              Cerrar sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default IncidenciaJustificarFlow;
