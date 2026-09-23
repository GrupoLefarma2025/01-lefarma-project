import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { InlineLoader } from '@/components/ui/inline-loader';
import { incidenciasChecadoApi } from '../services/rh.api';
import { ReglasDescuentoContenido } from './ReglasDescuentoContenido';
import type { ReglasDescuentoResponse } from '@/types/solicitudPersonal.types';

interface ReglasDescuentoModalProps {
  className?: string;
  triggerSize?: 'sm' | 'default';
}

/** Botón "¿Cómo se generan los descuentos?" + modal explicativo. */
export function ReglasDescuentoModal({
  className,
  triggerSize = 'sm',
}: ReglasDescuentoModalProps) {
  const [open, setOpen] = useState(false);
  const [reglas, setReglas] = useState<ReglasDescuentoResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    setLoading(true);
    incidenciasChecadoApi
      .getReglas()
      .then((res) => {
        setReglas(res.data.success ? res.data.data ?? null : null);
      })
      .catch(() => {
        setReglas(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <>
      <Button
        variant="outline"
        size={triggerSize}
        className={className}
        onClick={handleOpen}
      >
        <Info className="mr-1.5 h-4 w-4" />
        ¿Cómo se generan los descuentos?
      </Button>

      <Modal
        id="modal-reglas-descuento"
        open={open}
        setOpen={setOpen}
        title="¿Cómo se generan los descuentos?"
        size="lg"
      >
        {loading ? (
          <InlineLoader message="Cargando reglas..." />
        ) : (
          <ReglasDescuentoContenido reglas={reglas} />
        )}
      </Modal>
    </>
  );
}

export default ReglasDescuentoModal;
