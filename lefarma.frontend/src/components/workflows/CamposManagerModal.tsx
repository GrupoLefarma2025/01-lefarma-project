import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { API } from '@/shared/api/apiClient';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import type { ApiResponse } from '@/types/api.types';
import { CampoEditModal, type CampoWorkflowEditable } from './CampoEditModal';

const TIPOS_CAPTURA = ['Texto', 'Numero', 'Checkbox', 'Selector', 'Fecha'];

const GRUPOS_CAMPOS: Array<{
  key: string;
  titulo: string;
  match: (campo: CampoWorkflowEditable) => boolean;
}> = [
  {
    key: 'documentos',
    titulo: 'Documentos (tipo Archivo)',
    match: (campo) => campo.tipoControl === 'Archivo',
  },
  {
    key: 'captura',
    titulo: 'Campos de captura',
    match: (campo) => TIPOS_CAPTURA.includes(campo.tipoControl),
  },
  { key: 'otros', titulo: 'Otros', match: () => true },
];

interface CamposManagerModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Se llama cuando se crea/edita un campo, para refrescar el workflow. */
  onChanged: () => void | Promise<void>;
}

export function CamposManagerModal({ open, setOpen, onChanged }: CamposManagerModalProps) {
  const [campos, setCampos] = useState<CampoWorkflowEditable[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [campoEnEdicion, setCampoEnEdicion] = useState<CampoWorkflowEditable | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get<ApiResponse<CampoWorkflowEditable[]>>('/config/workflows/campos');
      setCampos(res.data.success ? res.data.data ?? [] : []);
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'No se pudieron cargar los campos');
      setCampos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void cargar();
    }
  }, [open, cargar]);

  const handleNuevo = () => {
    setCampoEnEdicion(null);
    setEditOpen(true);
  };

  const handleEditar = (campo: CampoWorkflowEditable) => {
    setCampoEnEdicion(campo);
    setEditOpen(true);
  };

  return (
    <>
      <Modal
        id="modal-workflow-campos"
        open={open}
        setOpen={setOpen}
        title="Campos del workflow"
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={cargar} disabled={loading}>
              <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refrescar
            </Button>
            <Button type="button" size="sm" className="gap-2" onClick={handleNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo campo
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Los campos son globales: se reutilizan en todos los workflows. Los de tipo{' '}
            <span className="font-semibold">Archivo</span> se usan como documentos requeridos; los
            campos <span className="font-mono">comprobante_gasto</span> y{' '}
            <span className="font-mono">comprobante_pago</span> son exclusivos del comprobante de OC.
            Para desactivar un campo, edítalo y desmarca <span className="font-semibold">Activo</span>.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="text-sm">Cargando campos...</span>
            </div>
          ) : campos.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              No hay campos configurados
            </div>
          ) : (
            <div className="space-y-4">
              {GRUPOS_CAMPOS.map((grupo) => {
                const items = campos.filter(grupo.match);
                if (items.length === 0) return null;

                return (
                  <div key={grupo.key} className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {grupo.titulo}
                      <span className="ml-1.5 font-normal normal-case">({items.length})</span>
                    </p>
                    {items.map((campo) => (
                      <div
                        key={campo.idWorkflowCampo}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                          campo.activo
                            ? 'border-border bg-card'
                            : 'border-border/60 bg-muted/40 opacity-70'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium">{campo.etiquetaUsuario}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {campo.tipoControl}
                            </Badge>
                            <Badge
                              variant={campo.activo ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {campo.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {campo.nombreTecnico}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Editar"
                            onClick={() => handleEditar(campo)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <CampoEditModal
        key={campoEnEdicion ? `campo-${campoEnEdicion.idWorkflowCampo}` : 'campo-nuevo'}
        campo={campoEnEdicion}
        open={editOpen}
        setOpen={setEditOpen}
        onSaved={async () => {
          await Promise.all([cargar(), Promise.resolve(onChanged())]);
        }}
      />
    </>
  );
}

export default CamposManagerModal;
