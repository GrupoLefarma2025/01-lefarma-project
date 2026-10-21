import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface AyudaPdfModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  pdfPath: string;
  titulo?: string;
}

export function AyudaPdfModal({
  open,
  setOpen,
  pdfPath,
  titulo = 'Manual de ayuda',
}: AyudaPdfModalProps) {
  const url = `${import.meta.env.BASE_URL}${pdfPath.replace(/^\//, '')}`;

  return (
    <Modal
      id="modal-ayuda-pdf"
      open={open}
      setOpen={setOpen}
      title={titulo}
      size="wide"
      footer={
        <>
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Abrir en nueva pestaña
            </a>
          </Button>
          <Button onClick={() => setOpen(false)}>Cerrar</Button>
        </>
      }
    >
      <iframe
        src={url}
        title={titulo}
        className="h-[70vh] w-full rounded-md border border-border"
      />
    </Modal>
  );
}
