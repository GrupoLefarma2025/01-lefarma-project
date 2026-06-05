import { useState, useEffect } from 'react';
import { Loader2, GitBranch, Play, CheckCircle2, AlertTriangle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import type { WorkflowPaso, WorkflowEstado } from '@/types/workflow.types';

interface StepEditFormProps {
  paso: WorkflowPaso;
  open: boolean;
  onClose: () => void;
  onSave: (paso: WorkflowPaso) => Promise<void>;
  workflowEstados: WorkflowEstado[];
}

export function StepEditForm({ paso, open, onClose, onSave, workflowEstados }: StepEditFormProps) {
  const [formData, setFormData] = useState<WorkflowPaso>(paso);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      ...paso,
      activo: paso.activo ?? true
    });
  }, [paso]);

  const handleChange = (field: keyof WorkflowPaso, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar el paso');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-2 ring-1 ring-blue-500/20">
              <Pencil className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <span>Editar Paso</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                Orden: {formData.orden}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          {/* Basic Information */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Información Básica
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ordenPaso" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Orden del Paso *
                </Label>
                <Input
                  id="ordenPaso"
                  type="number"
                  value={formData.orden}
                  onChange={(e) => handleChange('orden', Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombrePaso" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nombre del Paso *
                </Label>
                <Input
                  id="nombrePaso"
                  value={formData.nombrePaso}
                  onChange={(e) => handleChange('nombrePaso', e.target.value)}
                  placeholder="ej. Revisión Gerencia General"
                  required
                  className="font-medium"
                />
              </div>

              <div className="space-y-2 col-span-2">
                <Label htmlFor="idEstado" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estado del Workflow
                </Label>
                <Select
                  value={formData.idEstado ? String(formData.idEstado) : ''}
                  onValueChange={(val) => handleChange('idEstado', val ? Number(val) : undefined)}
                >
                  <SelectTrigger id="idEstado">
                    <SelectValue placeholder="Selecciona un estado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowEstados.map(est => (
                      <SelectItem key={est.idEstado} value={String(est.idEstado)}>
                        {est.nombre ?? est.codigo} (ID: {est.idEstado})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Estado que se asignará a las órdenes cuando estén en este paso
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcionAyuda" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Descripción de Ayuda
              </Label>
              <Textarea
                id="descripcionAyuda"
                value={formData.descripcionAyuda || ''}
                onChange={(e) => handleChange('descripcionAyuda', e.target.value)}
                placeholder="Texto que guiará al usuario durante este paso..."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Este texto aparecerá como ayuda contextual para el usuario
              </p>
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Requisitos
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="requiereFirma"
                  checked={formData.requiereFirma}
                  onCheckedChange={(checked) => handleChange('requiereFirma', checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="requiereFirma" className="cursor-pointer font-medium">
                    Requiere Firma Digital
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El usuario debe proporcionar una firma electrónica
                  </p>
                </div>
                {formData.requiereFirma && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                    Activo
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="requiereComentario"
                  checked={formData.requiereComentario}
                  onCheckedChange={(checked) => handleChange('requiereComentario', checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="requiereComentario" className="cursor-pointer font-medium">
                    Requiere Comentario
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El usuario debe agregar un comentario obligatorio
                  </p>
                </div>
                {formData.requiereComentario && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                    Activo
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="requiereAdjunto"
                  checked={formData.requiereAdjunto}
                  onCheckedChange={(checked) => handleChange('requiereAdjunto', checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="requiereAdjunto" className="cursor-pointer font-medium">
                    Requiere Adjunto
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El usuario debe subir archivos de respaldo
                  </p>
                </div>
                {formData.requiereAdjunto && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    Activo
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Flow Control */}
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Play className="h-4 w-4" />
              Control de Flujo
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="activoPaso"
                  checked={formData.activo}
                  onCheckedChange={(checked) => handleChange('activo', !!checked)}
                />
                <div>
                  <Label htmlFor="activoPaso" className="cursor-pointer font-medium">
                    Paso Activo
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Si está inactivo no se usará en ejecución del workflow
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="esInicio"
                  checked={formData.esInicio}
                  onCheckedChange={(checked) => handleChange('esInicio', checked)}
                />
                <div>
                  <Label htmlFor="esInicio" className="cursor-pointer font-medium">
                    Paso Inicial
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Primer paso del workflow
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
                <Checkbox
                  id="esFinal"
                  checked={formData.esFinal}
                  onCheckedChange={(checked) => handleChange('esFinal', checked)}
                />
                <div>
                  <Label htmlFor="esFinal" className="cursor-pointer font-medium">
                    Paso Final
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Último paso del workflow
                  </p>
                </div>
              </div>
            </div>

            {(formData.esInicio || formData.esFinal) && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-xs">
                  {formData.esInicio && formData.esFinal
                    ? 'Este paso es tanto inicio como final (workflow de un solo paso)'
                    : formData.esInicio
                    ? 'Las órdenes comenzarán en este paso automáticamente'
                    : 'Las órdenes finalizarán al llegar a este paso'}
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar Paso
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
