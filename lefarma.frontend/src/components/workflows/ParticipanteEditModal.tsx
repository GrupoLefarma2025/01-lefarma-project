import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface ParticipanteEditModalProps {
  workflow: WorkflowWithDetails;
  participante: any | null;
  roles: any[];
  usuarios: any[];
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

export function ParticipanteEditModal({ workflow, participante, roles, usuarios, open, setOpen, onSave }: ParticipanteEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [tipoAsignacionUI, setTipoAsignacionUI] = useState<'rol' | 'usuario'>('rol');
  const [formData, setFormData] = useState({
    idPaso: 0,
    idRol: 0,
    idUsuario: 0,
    activo: true
  });

  useEffect(() => {
    if (participante) {
      setFormData({
        idPaso: participante.idPaso,
        idRol: participante.idRol || 0,
        idUsuario: participante.idUsuario || 0,
        activo: participante.activo ?? true
      });
      setTipoAsignacionUI(participante.idRol ? 'rol' : 'usuario');
    } else {
      setFormData({
        idPaso: workflow.pasos[0]?.idPaso || 0,
        idRol: 0,
        idUsuario: 0,
        activo: true
      });
      setTipoAsignacionUI('rol');
    }
  }, [participante, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        idRol: tipoAsignacionUI === 'rol' ? (formData.idRol || null) : null,
        idUsuario: tipoAsignacionUI === 'usuario' ? (formData.idUsuario || null) : null,
        activo: formData.activo
      };
      if (participante) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/participantes/${participante.idParticipante}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/pasos/${formData.idPaso}/participantes`, payload);
      }
      await onSave();
      toast.success(participante ? 'Participante actualizado' : 'Participante agregado');
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar el participante');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      id="modal-participante"
      open={open}
      setOpen={setOpen}
      title={participante ? 'Editar Participante' : 'Nuevo Participante'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {participante ? 'Actualizar' : 'Crear'} Participante
          </Button>

        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Paso */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso del Workflow *
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
          <p className="text-xs text-muted-foreground">
            El paso donde actuará este participante
          </p>
        </div>

        {/* Tipo de Asignación */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de Asignación *
          </Label>
          <Select
            value={tipoAsignacionUI}
            onValueChange={(value: 'rol' | 'usuario') => {
              setTipoAsignacionUI(value);
              setFormData(prev => ({
                ...prev,
                idRol: value === 'rol' ? prev.idRol : 0,
                idUsuario: value === 'usuario' ? prev.idUsuario : 0
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rol">Por Rol</SelectItem>
              <SelectItem value="usuario">Por Usuario Específico</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {tipoAsignacionUI === 'rol' 
              ? 'Cualquier usuario con este rol podrá actuar'
              : 'Solo el usuario específico podrá actuar'}
          </p>
        </div>

        {/* Asignación según tipo */}
        {tipoAsignacionUI === 'rol' ? (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rol *
            </Label>
            <Select
              value={formData.idRol.toString()}
              onValueChange={(value) => setFormData(prev => ({ ...prev, idRol: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r: any) => (
                  <SelectItem key={r.idRol} value={String(r.idRol)}>{r.nombreRol}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Usuario *
            </Label>
            <Select
              value={formData.idUsuario.toString()}
              onValueChange={(value) => setFormData(prev => ({ ...prev, idUsuario: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u: any) => (
                  <SelectItem key={u.idUsuario} value={String(u.idUsuario)}>{u.nombreCompleto}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Activo */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="participante-activo"
            checked={formData.activo}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, activo: Boolean(checked) }))}
          />
          <div className="space-y-0.5">
            <Label htmlFor="participante-activo" className="text-sm font-medium cursor-pointer">
              Participante activo
            </Label>
            <p className="text-xs text-muted-foreground">
              Si está inactivo, no se considerará como asignado al paso
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-xs">
              Los participantes definen quién puede ver y actuar en cada paso del workflow. 
              Si no hay participantes asignados, cualquier usuario podrá actuar.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
