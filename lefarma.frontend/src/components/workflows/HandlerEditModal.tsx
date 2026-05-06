import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { API } from '@/services/api';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import type { Workflow, WorkflowPaso, WorkflowAccion, WorkflowAccionHandler, WorkflowCampo } from '@/types/workflow.types';

interface WorkflowWithDetails extends Workflow {
  pasos: WorkflowPaso[];
  campos?: WorkflowCampo[];
}

interface HandlerEditModalProps {
  workflow: WorkflowWithDetails;
  accion: WorkflowAccion | null;
  handler: WorkflowAccionHandler | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

export function HandlerEditModal({ workflow, accion, handler, open, setOpen, onSave }: HandlerEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAccionId, setSelectedAccionId] = useState<number | null>(accion?.idAccion ?? null);
  const [handlerKey, setHandlerKey] = useState('RequiredFields');
  const [ordenEjecucion, setOrdenEjecucion] = useState(1);
  const [activo, setActivo] = useState(true);

  // Smart UI state per handler type
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fuField, setFuField] = useState('');
  const [fuSource, setFuSource] = useState<'value' | 'input'>('value');
  const [fuValue, setFuValue] = useState('');
  const [fuInputKey, setFuInputKey] = useState('');
  const [documentLabel, setDocumentLabel] = useState('');

  const availableCampos = (workflow.campos || []).filter((c: WorkflowCampo) => c.activo);
  const allAcciones = workflow.pasos.flatMap((p: WorkflowPaso) => (p.acciones || []).map((a: WorkflowAccion) => ({ ...a, pasoNombre: p.nombrePaso, pasoOrden: p.orden })));

  const handlerOptions = [
    { value: 'RequiredFields',   label: 'Campos requeridos' },
    { value: 'FieldUpdater',     label: 'Actualizar campo' },
    { value: 'DocumentRequired', label: 'Documento requerido' },
  ];

  const resetSmartState = () => {
    setSelectedFields([]);
    setFuField(''); setFuSource('value'); setFuValue(''); setFuInputKey('');
    setDocumentLabel('');
  };

  const parseExistingJson = (key: string, json: string) => {
    try {
      const p = JSON.parse(json);
      if (key === 'RequiredFields' && Array.isArray(p.fields)) setSelectedFields(p.fields);
      if (key === 'FieldUpdater' && p.field) {
        setFuField(p.field);
        setFuSource(p.source === 'input' ? 'input' : 'value');
        setFuValue(p.value !== undefined ? String(p.value) : '');
        setFuInputKey(p.inputKey || '');
      }
      if (key === 'DocumentRequired' && p.etiqueta) setDocumentLabel(p.etiqueta);
    } catch { /* json inválido, dejar defaults */ }
  };

  useEffect(() => {
    setSelectedAccionId(accion?.idAccion ?? null);
    resetSmartState();
    if (handler) {
      setHandlerKey(handler.handlerKey);
      setOrdenEjecucion(handler.ordenEjecucion || 1);
      setActivo(handler.activo ?? true);
      if (handler.configuracionJson) parseExistingJson(handler.handlerKey, handler.configuracionJson);
    } else {
      setHandlerKey('RequiredFields');
      setOrdenEjecucion(1);
      setActivo(true);
    }
  }, [handler, accion, open]);

  const handleTypeChange = (value: string) => {
    setHandlerKey(value);
    resetSmartState();
  };

  const computeJson = (key: string): string | null => {
    if (key === 'RequiredFields') {
      return selectedFields.length > 0 ? JSON.stringify({ fields: selectedFields }) : null;
    }
    if (key === 'FieldUpdater') {
      if (!fuField) return null;
      if (fuSource === 'input') {
        const obj: Record<string, string> = { field: fuField, source: 'input' };
        if (fuInputKey) obj.inputKey = fuInputKey;
        return JSON.stringify(obj);
      }
      let val: unknown = fuValue;
      if (fuValue === 'true') val = true;
      else if (fuValue === 'false') val = false;
      else if (fuValue !== '' && !isNaN(Number(fuValue))) val = Number(fuValue);
      return JSON.stringify({ field: fuField, value: val });
    }
    if (key === 'DocumentRequired') {
      return documentLabel ? JSON.stringify({ etiqueta: documentLabel }) : null;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAccionId = accion?.idAccion ?? selectedAccionId;
    if (!targetAccionId) { toast.error('Selecciona una acción para configurar reglas'); return; }

    setIsSaving(true);
    try {
      const payload = {
        handlerKey,
        configuracionJson: computeJson(handlerKey),
        ordenEjecucion: Number(ordenEjecucion || 1),
        activo
      };
      if (handler) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/acciones/${targetAccionId}/handlers/${handler.idHandler}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/acciones/${targetAccionId}/handlers`, payload);
      }
      toast.success(handler ? 'Regla actualizada' : 'Regla creada');
      setOpen(false);
      await onSave();
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al guardar la regla');
    } finally {
      setIsSaving(false);
    }
  };

  const jsonPreview = computeJson(handlerKey);

  const renderConfig = () => {
    if (handlerKey === 'RequiredFields') {
      return (
        <div className="space-y-2">
          <Label>Campos obligatorios</Label>
          {availableCampos.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No hay campos configurados en este workflow.
              <br />
              <span className="text-xs">Agrega campos en el tab "Campos" primero.</span>
            </div>
          ) : (
            <div className="rounded-md border divide-y">
              {availableCampos.map((campo: WorkflowCampo) => (
                <label
                  key={campo.idWorkflowCampo}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedFields.includes(campo.nombreTecnico)}
                    onCheckedChange={() =>
                      setSelectedFields(prev =>
                        prev.includes(campo.nombreTecnico)
                          ? prev.filter(f => f !== campo.nombreTecnico)
                          : [...prev, campo.nombreTecnico]
                      )
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{campo.etiquetaUsuario}</p>
                    <p className="text-xs text-muted-foreground font-mono">{campo.nombreTecnico}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{campo.tipoControl}</Badge>
                </label>
              ))}
            </div>
          )}
          {selectedFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedFields.length} campo{selectedFields.length !== 1 ? 's' : ''} seleccionado{selectedFields.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      );
    }

    if (handlerKey === 'FieldUpdater') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Campo a actualizar</Label>
            {availableCampos.length > 0 ? (
              <Select value={fuField} onValueChange={setFuField}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un campo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCampos.map((campo: WorkflowCampo) => (
                    <SelectItem key={campo.idWorkflowCampo} value={campo.nombreTecnico}>
                      {campo.etiquetaUsuario}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={fuField}
                onChange={e => setFuField(e.target.value)}
                placeholder="ej. requiereComprobacionPago"
                className="font-mono text-sm"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Origen del valor</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['value', 'input'] as const).map(src => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setFuSource(src)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors text-left ${
                    fuSource === src
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  {src === 'value' ? '📌 Valor fijo' : '✏️ Dato del usuario'}
                </button>
              ))}
            </div>
          </div>

          {fuSource === 'value' ? (
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                value={fuValue}
                onChange={e => setFuValue(e.target.value)}
                placeholder="true / false / 42 / texto"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Usa true/false para booleanos, número o texto libre</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>
                Clave en el payload del usuario{' '}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                value={fuInputKey}
                onChange={e => setFuInputKey(e.target.value)}
                placeholder={fuField || 'misma clave que el campo'}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Deja vacío si la clave en el payload del usuario coincide con el nombre del campo
              </p>
            </div>
          )}
        </div>
      );
    }

    if (handlerKey === 'DocumentRequired') {
      return (
        <div className="space-y-2">
          <Label>Etiqueta del documento</Label>
          <Input
            value={documentLabel}
            onChange={e => setDocumentLabel(e.target.value)}
            placeholder="ej. Comprobante de Pago, Factura, Cotización..."
          />
          <p className="text-xs text-muted-foreground">
            El usuario verá este nombre al adjuntar el documento requerido
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      id="modal-handler"
      open={open}
      setOpen={setOpen}
      title={handler ? 'Editar regla' : 'Nueva regla'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {handler ? 'Actualizar' : 'Guardar'} regla
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {accion ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            Acción: <span className="font-semibold">{accion.tipoAccionNombre}</span> · {accion.tipoAccionCodigo}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Acción *</Label>
            <Select
              value={selectedAccionId?.toString() ?? ''}
              onValueChange={(v) => setSelectedAccionId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una acción..." />
              </SelectTrigger>
              <SelectContent>
                {allAcciones.map((a: WorkflowAccion & { pasoNombre: string; pasoOrden: number }) => (
                  <SelectItem key={a.idAccion} value={a.idAccion.toString()}>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600">{a.pasoOrden}</span>
                      <span>{a.pasoNombre} — {a.tipoAccionNombre}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de regla</Label>
            <Select value={handlerKey} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {handlerOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Orden de ejecución</Label>
            <Input
              type="number"
              min={1}
              value={ordenEjecucion}
              onChange={e => setOrdenEjecucion(Number(e.target.value || 1))}
            />
          </div>
        </div>

        {/* Smart config per type */}
        {renderConfig()}

        {/* JSON preview */}
        {jsonPreview && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vista previa JSON
            </p>
            <pre className="rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(JSON.parse(jsonPreview), null, 2)}
            </pre>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="handler-activo"
            checked={activo}
            onCheckedChange={v => setActivo(Boolean(v))}
          />
          <Label htmlFor="handler-activo">Activa</Label>
        </div>
      </form>
    </Modal>
  );
}
