import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type { AjustePostCierre } from '@/apps/educacion-medica/types/educacionMedica.types';

const ETIQUETAS_ACCION: Record<string, string> = {
  MOVER_VISITA: 'Mover visita',
  EDITAR_HORAS: 'Editar horas',
  ALTA_VISITA: 'Alta de visita',
  BAJA_VISITA: 'Baja de visita',
  EDITAR_TALLER: 'Editar taller',
  CANCELAR_VERSION: 'Cancelar versión (Solicitar cambio)',
};

interface AjustesRutasModalProps {
  open: boolean;
  onClose: () => void;
  idRutaVersion: number | null;
  version: number | null;
}

/** Historial de ajustes post-cierre de la versión de rutas (ADR-00010). */
export function AjustesRutasModal({ open, onClose, idRutaVersion, version }: AjustesRutasModalProps) {
  const [ajustes, setAjustes] = useState<AjustePostCierre[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    if (idRutaVersion == null) return;
    setLoading(true);
    try {
      const res = await educacionMedicaApi.ajustes.listar('RUTA_VERSION', idRutaVersion);
      if (res.data.success) {
        setAjustes(res.data.data ?? []);
      } else {
        toast.error(res.data.message ?? 'No se pudo cargar el historial de ajustes');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo cargar el historial de ajustes');
    } finally {
      setLoading(false);
    }
  }, [idRutaVersion]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al abrir el modal; los setState ocurren tras el await
    if (open) void cargar();
  }, [open, cargar]);

  return (
    <Modal
      id="modal-ajustes-rutas"
      open={open}
      setOpen={(o) => {
        if (!o) onClose();
      }}
      title={`Ajustes post-cierre${version != null ? ` — Rutas v${version}` : ''}`}
      size="wide"
      footer={
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : ajustes.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          <History className="h-4 w-4" />
          Sin ajustes registrados para esta versión.
        </p>
      ) : (
        <ul className="space-y-2">
          {ajustes.map((ajuste) => (
            <li key={ajuste.idAjuste} className="space-y-1 rounded-md border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ETIQUETAS_ACCION[ajuste.accion] ?? ajuste.accion}</Badge>
                <span className="text-xs text-muted-foreground">
                  {ajuste.nombreUsuario ?? `Usuario ${ajuste.idUsuario}`} ·{' '}
                  {new Date(ajuste.fechaAjuste).toLocaleString('es-MX')}
                </span>
              </div>
              <p className="text-sm italic">“{ajuste.motivo}”</p>
              {(ajuste.valoresAntes || ajuste.valoresDespues) && (
                <p className="break-all text-[11px] text-muted-foreground">
                  {ajuste.valoresAntes ? `Antes: ${ajuste.valoresAntes}` : ''}
                  {ajuste.valoresAntes && ajuste.valoresDespues ? ' · ' : ''}
                  {ajuste.valoresDespues ? `Después: ${ajuste.valoresDespues}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
