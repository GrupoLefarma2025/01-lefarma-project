import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { API } from '@/services/api';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import type { Workflow, WorkflowPaso } from '@/types/workflow.types';

interface WorkflowWithDetails extends Workflow {
  pasos: WorkflowPaso[];
}

interface CondicionEditModalProps {
  workflow: WorkflowWithDetails;
  condicion: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

export function CondicionEditModal({ workflow, condicion, open, setOpen, onSave }: CondicionEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    idPaso: 0,
    campoEvaluacion: '',
    operador: '>',
    valorComparacion: '',
    idPasoSiCumple: 0,
    activo: true
  });

  useEffect(() => {
    if (condicion) {
      setFormData({ ...condicion, activo: condicion.activo ?? true });
    } else {
      setFormData({
        idPaso: workflow.pasos[0]?.idPaso || 0,
        campoEvaluacion: '',
        operador: '>',
        valorComparacion: '',
        idPasoSiCumple: 0,
        activo: true
      });
    }
  }, [condicion, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        campoEvaluacion: formData.campoEvaluacion,
        operador: formData.operador,
        valorComparacion: formData.valorComparacion,
        idPasoSiCumple: formData.idPasoSiCumple,
        activo: formData.activo
      };
      if (condicion) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/condiciones/${condicion.idCondicion}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/condiciones`, payload);
      }
      await onSave();
      toast.success(condicion ? 'Condición actualizada' : 'Condición creada');
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar la condición');
    } finally {
      setIsSaving(false);
    }
  };

  const operadores = [
    { value: '>', label: 'Mayor que (>)' },
    { value: '<', label: 'Menor que (<)' },
    { value: '=', label: 'Igual a (=)' },
    { value: '>=', label: 'Mayor o igual (>=)' },
    { value: '<=', label: 'Menor o igual (<=)' },
    { value: '!=', label: 'Diferente (!=)' },
    { value: 'IN', label: 'Está en (IN)' }
  ];

  return (
    <Modal
      id="modal-condicion"
      open={open}
      setOpen={setOpen}
      title={condicion ? 'Editar Condición' : 'Nueva Condición'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {condicion ? 'Actualizar' : 'Crear'} Condición
          </Button>

        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Paso donde aplica */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso donde aplica la condición *
          </Label>
          <Select
            value={formData.idPaso.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPaso: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona el paso" />
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
        </div>

        {/* Campo a Evaluar */}
        <div className="space-y-2">
          <Label htmlFor="campoEvaluacion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Campo a Evaluar *
          </Label>
          <Input
            id="campoEvaluacion"
            value={formData.campoEvaluacion}
            onChange={(e) => setFormData(prev => ({ ...prev, campoEvaluacion: e.target.value }))}
            placeholder="ej. Total, IdEmpresa, TipoGasto"
            required
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Nombre del campo del modelo de datos a evaluar
          </p>
        </div>

        {/* Grid: Operador y Valor */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Operador *
            </Label>
            <Select
              value={formData.operador}
              onValueChange={(value) => setFormData(prev => ({ ...prev, operador: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operadores.map(op => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valorComparacion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Valor *
            </Label>
            <Input
              id="valorComparacion"
              value={formData.valorComparacion}
              onChange={(e) => setFormData(prev => ({ ...prev, valorComparacion: e.target.value }))}
              placeholder="ej. 100000, 5, 'VIATICOS'"
              required
              className="font-mono"
            />
          </div>
        </div>

        {/* Paso Destino si cumple */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ir a paso (si cumple) *
          </Label>
          <Select
            value={formData.idPasoSiCumple.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPasoSiCumple: parseInt(value) }))}
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
        </div>

        {/* Preview */}
        {formData.idPaso > 0 && formData.campoEvaluacion && formData.idPasoSiCumple > 0 && (
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2">REGLA</p>
            <p className="text-sm font-mono">
              Si <span className="text-blue-600 font-semibold">{formData.campoEvaluacion}</span>
              {' '}<span className="text-amber-600 font-semibold">{formData.operador}</span>{' '}
              <span className="text-green-600 font-semibold">{formData.valorComparacion}</span>
              {' '}→ ir a{' '}
              <span className="text-purple-600 font-semibold">
                {workflow.pasos.find(p => p.idPaso === formData.idPasoSiCumple)?.nombrePaso}
              </span>
            </p>
          </div>
        )}

        {/* Activo */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="condicion-activa"
            checked={formData.activo}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, activo: Boolean(checked) }))}
          />
          <div className="space-y-0.5">
            <Label htmlFor="condicion-activa" className="text-sm font-medium cursor-pointer">
              Condición activa
            </Label>
            <p className="text-xs text-muted-foreground">
              Si está inactiva, no se evaluará en el flujo del workflow
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
