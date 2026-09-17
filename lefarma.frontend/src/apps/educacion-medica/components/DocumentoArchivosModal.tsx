import { Modal } from '@/components/ui/modal';
import { Paperclip } from 'lucide-react';
import { DocumentoArchivosTab } from './DocumentoArchivosTab';
import { ENTIDAD_ARCHIVOS, type TipoDocumentoEm } from './documentoEntidad';

interface DocumentoArchivosModalProps {
  open: boolean;
  onClose: () => void;
  documento: string;
  tipo: TipoDocumentoEm;
  idEntidad: number;
}

/**
 * Archivos de un documento de Educación Médica en modal independiente
 * (listar, subir, ver, descargar, borrar). Compartido por la Bandeja de
 * Autorizaciones y el listado de Selecciones Mensuales.
 */
export function DocumentoArchivosModal({
  open,
  onClose,
  documento,
  tipo,
  idEntidad,
}: DocumentoArchivosModalProps) {
  const entidad = ENTIDAD_ARCHIVOS[tipo];

  return (
    <Modal
      id="modal-documento-archivos"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          <span>Archivos del documento</span>
        </div>
      }
      size="full"
    >
      <div className="space-y-3">
        <div className="bg-muted/30 rounded-md border p-3">
          <p className="text-sm font-semibold">{documento}</p>
          <p className="text-xs text-muted-foreground">
            {tipo === 'seleccion' ? 'Selección mensual' : 'Versión de rutas'}
          </p>
        </div>
        <DocumentoArchivosTab
          key={`${entidad.tipo}-${idEntidad}`}
          entidadTipo={entidad.tipo}
          entidadId={idEntidad}
          carpeta={entidad.carpeta}
        />
      </div>
    </Modal>
  );
}
