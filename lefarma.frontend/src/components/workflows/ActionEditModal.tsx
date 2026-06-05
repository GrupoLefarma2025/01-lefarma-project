import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { API } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { ACTION_COLORS } from './constants';
import type { Workflow, WorkflowPaso, WorkflowAccion, WorkflowTipoAccion } from '@/types/workflow.types';

interface WorkflowWithDetails extends Workflow {
  pasos: WorkflowPaso[];
}

interface ActionEditModalProps {
  workflow: WorkflowWithDetails;
  accion: WorkflowAccion | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

export function ActionEditModal({ workflow, accion, open, setOpen, onSave }: ActionEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    idTipoAccion: 1,
    idPasoOrigen: 0,
    idPasoDestino: 0,
    enviaConcentrado: false,
    activo: true
  });
  const [tiposAccionList, setTiposAccionList] = useState<WorkflowTipoAccion[]>([]);

  useEffect(() => {
    if (accion) {
      // Encontrar el paso origen de esta acción
      const pasoOrigen = workflow.pasos.find((p: WorkflowPaso) => 
        p.acciones?.some((a: WorkflowAccion) => a.idAccion === accion.idAccion)
      );
      
      setFormData({
        idTipoAccion: accion.idTipoAccion,
        idPasoOrigen: pasoOrigen?.idPaso || 0,
        idPasoDestino: accion.idPasoDestino || 0,
        enviaConcentrado: accion.enviaConcentrado ?? false,
        activo: accion.activo ?? true
      });
    } else {
      setFormData({
        idTipoAccion: 1,
        idPasoOrigen: workflow.pasos[0]?.idPaso || 0,
        idPasoDestino: 0,
        enviaConcentrado: false,
        activo: true
      });
    }
  }, [accion, workflow.pasos, open]);

  useEffect(() => {
    const loadTipos = async () => {
      try {
        const res = await API.get<ApiResponse<WorkflowTipoAccion[]>>('/config/workflows/tipos-accion');
        if (res.data?.success) {
          setTiposAccionList(res.data.data || []);
        }
      } catch {
        // silent fail
      }
    };
    loadTipos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        idTipoAccion: formData.idTipoAccion,
        idPasoDestino: formData.idPasoDestino || null,
        enviaConcentrado: formData.enviaConcentrado,
        activo: formData.activo
      };
      if (accion) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPasoOrigen}/acciones/${accion.idAccion}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPasoOrigen}/acciones`, payload);
      }
      await onSave();
      toast.success(accion ? 'Acción actualizada' : 'Acción creada');
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar la acción');
    } finally {
      setIsSaving(false);
    }
  };

  const tiposAccion = tiposAccionList;

  return (
    <Modal
      id="modal-action"
      open={open}
      setOpen={setOpen}
      title={accion ? 'Editar Acción' : 'Nueva Acción'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {accion ? 'Actualizar' : 'Crear'} Acción
          </Button>

        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Acción */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de Acción *
          </Label>
          <Select
            value={String(formData.idTipoAccion)}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idTipoAccion: Number(value) }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tiposAccion.map((tipo: WorkflowTipoAccion) => (
                <SelectItem key={tipo.idTipoAccion} value={String(tipo.idTipoAccion)}>
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-6" style={{ backgroundColor: ACTION_COLORS[tipo.codigo || ''] || '#6b7280' }} />
                    <span>{tipo.codigo} - {tipo.nombre}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Define el comportamiento semántico de la acción
          </p>
        </div>

        {/* Paso Origen */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso Origen *
          </Label>
          <Select
            value={formData.idPasoOrigen.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPasoOrigen: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el paso de origen" />
            </SelectTrigger>
            <SelectContent>
              {workflow.pasos.map((paso: WorkflowPaso) => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                      {paso.orden}
                    </span>
                    <span>{paso.nombrePaso}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            El paso desde donde se puede ejecutar esta acción
          </p>
        </div>

        {/* Paso Destino */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso Destino *
          </Label>
          <Select
            value={formData.idPasoDestino.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPasoDestino: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el paso destino" />
            </SelectTrigger>
            <SelectContent>
              {workflow.pasos.map((paso: WorkflowPaso) => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-blue-500/10 text-blue-600 text-xs font-bold">
                      {paso.orden}
                    </span>
                    <span>{paso.nombrePaso}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            El paso al que se moverá la orden al ejecutar esta acción
          </p>
        </div>

        {/* Envia Concentrado */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="envia-concentrado"
            checked={formData.enviaConcentrado}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviaConcentrado: Boolean(checked) }))}
          />
          <div className="space-y-0.5">
            <Label htmlFor="envia-concentrado" className="text-sm font-medium cursor-pointer">
              Enviar a concentrado
            </Label>
            <p className="text-xs text-muted-foreground">
              Al ejecutar esta acción, se comunicará con el sistema externo de envío concentrado
            </p>
          </div>
        </div>

        {/* Activo */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="accion-activa"
            checked={formData.activo}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, activo: Boolean(checked) }))}
          />
          <div className="space-y-0.5">
            <Label htmlFor="accion-activa" className="text-sm font-medium cursor-pointer">
              Acción activa
            </Label>
            <p className="text-xs text-muted-foreground">
              Si está inactiva, no estará disponible en el paso del workflow
            </p>
          </div>
        </div>

        {/* Preview */}
        {formData.idPasoOrigen > 0 && formData.idPasoDestino > 0 && (
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2">VISTA PREVIA</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                {workflow.pasos.find((p: WorkflowPaso) => p.idPaso === formData.idPasoOrigen)?.nombrePaso}
              </span>
              <div 
                className="h-0.5 flex-1" 
                style={{ backgroundColor: tiposAccion.find((t: WorkflowTipoAccion) => t.idTipoAccion === formData.idTipoAccion)?.codigo ? ACTION_COLORS[tiposAccion.find((t: WorkflowTipoAccion) => t.idTipoAccion === formData.idTipoAccion)!.codigo!] : '#6b7280' }}
              />
              <span className="font-mono text-xs px-2 py-1 rounded bg-background">
                {tiposAccion.find((t: WorkflowTipoAccion) => t.idTipoAccion === formData.idTipoAccion)?.nombre}
              </span>
              <div 
                className="h-0.5 flex-1" 
                style={{ backgroundColor: tiposAccion.find((t: WorkflowTipoAccion) => t.idTipoAccion === formData.idTipoAccion)?.codigo ? ACTION_COLORS[tiposAccion.find((t: WorkflowTipoAccion) => t.idTipoAccion === formData.idTipoAccion)!.codigo!] : '#6b7280' }}
              />
              <span className="font-medium">
                {workflow.pasos.find((p: WorkflowPaso) => p.idPaso === formData.idPasoDestino)?.nombrePaso}
              </span>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
