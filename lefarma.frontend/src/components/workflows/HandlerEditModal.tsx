import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const HANDLER_OPTIONS = [
  { value: 'Field',                 label: 'Campo (Field)' },
  { value: 'Document',              label: 'Documento requerido' },
  { value: 'Alerta',                label: 'Alerta informativa' },
  { value: 'ProviderAuthorization', label: 'Validacion de proveedor' },
];

export function HandlerEditModal({ workflow, accion, handler, open, setOpen, onSave }: HandlerEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAccionId, setSelectedAccionId] = useState<number | null>(accion?.idAccion ?? null);
  const [handlerKey, setHandlerKey] = useState('Field');
  const [ordenEjecucion, setOrdenEjecucion] = useState(1);
  const [activo, setActivo] = useState(true);
  const [selectedCampoId, setSelectedCampoId] = useState<number | null>(null);
  const [configuracionJson, setConfiguracionJson] = useState('');

  const availableCampos = (workflow.campos || [])
    .filter((c: WorkflowCampo) => c.activo)
    .filter((c: WorkflowCampo) => {
      if (handlerKey === 'Field') return ['Texto', 'Numero', 'Checkbox', 'Selector', 'Fecha'].includes(c.tipoControl);
      if (handlerKey === 'Document') return c.tipoControl === 'Archivo';
      if (handlerKey === 'Alerta') return c.tipoControl === 'Alerta';
      if (handlerKey === 'ProviderAuthorization') return c.tipoControl === 'Validacion';
      return true;
    });
  const allAcciones = workflow.pasos.flatMap((p: WorkflowPaso) => (p.acciones || []).map((a: WorkflowAccion) => ({ ...a, pasoNombre: p.nombrePaso, pasoOrden: p.orden })));

  const parseExistingJson = (json: string) => {
    try { return JSON.parse(json); } catch { return null; }
  };

  const initFromHandler = () => {
    if (handler) {
      setHandlerKey(handler.handlerKey || 'Field');
      setOrdenEjecucion(handler.ordenEjecucion || 1);
      setActivo(handler.activo ?? true);
      setSelectedCampoId(handler.idWorkflowCampo ?? null);
      setConfiguracionJson(handler.configuracionJson || '');
    } else {
      setHandlerKey('Field');
      setOrdenEjecucion(1);
      setActivo(true);
      setSelectedCampoId(null);
      setConfiguracionJson('');
    }
  };

  useEffect(() => {
    setSelectedAccionId(accion?.idAccion ?? null);
    initFromHandler();
  }, [handler, accion, open]);

  const handleHandlerKeyChange = (key: string) => {
    setHandlerKey(key);
    setSelectedCampoId(null);
    setConfiguracionJson('');
  };

  const selectedCampo = availableCampos.find(c => c.idWorkflowCampo === selectedCampoId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAccionId = accion?.idAccion ?? selectedAccionId;
    if (!targetAccionId) { toast.error('Selecciona una accion'); return; }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        handlerKey,
        ordenEjecucion: Number(ordenEjecucion || 1),
        activo,
        idWorkflowCampo: selectedCampoId
      };

      if (configuracionJson.trim()) {
        try { JSON.parse(configuracionJson); payload.configuracionJson = configuracionJson; }
        catch { payload.configuracionJson = null; }
      } else {
        payload.configuracionJson = null;
      }

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

  return (
    <Modal
      id="modal-handler"
      open={open}
      setOpen={setOpen}
      title={handler ? 'Editar handler' : 'Nuevo handler'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {handler ? 'Actualizar' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {accion ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            Accion: <span className="font-semibold">{accion.tipoAccionNombre}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Accion *</Label>
            <Select value={selectedAccionId?.toString() ?? ''} onValueChange={(v) => setSelectedAccionId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Selecciona una accion..." /></SelectTrigger>
              <SelectContent>
                {allAcciones.map((a: WorkflowAccion & { pasoNombre: string; pasoOrden: number }) => (
                  <SelectItem key={a.idAccion} value={a.idAccion.toString()}>
                    {a.pasoNombre} — {a.tipoAccionNombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de handler</Label>
            <Select value={handlerKey} onValueChange={handleHandlerKeyChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HANDLER_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Orden de ejecucion</Label>
            <Input type="number" min={0} value={ordenEjecucion}
              onChange={e => setOrdenEjecucion(Number(e.target.value || 0))} />
          </div>
        </div>

        {/* Campo vinculado */}
        <div className="space-y-2">
          <Label>Campo vinculado</Label>
          {availableCampos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay campos disponibles en este workflow.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableCampos.map((campo: WorkflowCampo) => (
                <button
                  key={campo.idWorkflowCampo}
                  type="button"
                  onClick={() => setSelectedCampoId(prev => prev === campo.idWorkflowCampo ? null : campo.idWorkflowCampo)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    selectedCampoId === campo.idWorkflowCampo
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  {campo.etiquetaUsuario}
                  <Badge variant="outline" className="text-[10px]">{campo.tipoControl}</Badge>
                </button>
              ))}
            </div>
          )}
          {selectedCampo && (
            <p className="text-xs text-muted-foreground">
              Vinculado a: <span className="font-mono font-medium">{selectedCampo.nombreTecnico}</span> ({selectedCampo.tipoControl})
            </p>
          )}
        </div>

        {/* configuracionJson */}
        <div className="space-y-2">
          <Label>Configuracion JSON (opcional)</Label>
          <Textarea
            value={configuracionJson}
            onChange={e => setConfiguracionJson(e.target.value)}
            placeholder={
              handlerKey === 'ProviderAuthorization'
                ? '{"mensaje":"El proveedor no esta autorizado."}'
                : handlerKey === 'Alerta'
                ? '{"mensaje":"Recuerda verificar el presupuesto antes de autorizar.","tipo":"warning"}'
                : handlerKey === 'Field'
                ? 'Opcional. Dejar vacio para usar el valor del usuario con la misma clave del campo.'
                : handlerKey === 'Document'
                ? '{"mensaje":"El XML debe ser CFDI 4.0 valido."}'
                : '{}'
            }
            className="font-mono text-xs min-h-[60px]"
            rows={3}
          />
          <div className="text-xs text-muted-foreground space-y-1 mt-1">
            {handlerKey === 'Field' && (
              <>
                <p><strong>Field — Campo de entrada</strong></p>
                <p>El usuario ingresa un valor en el modal de firma. El handler lo guarda en <code>OrdenCompra.{selectedCampo?.propiedadEntidad ?? '?'}</code> via reflexion.</p>
                <p className="mt-1"><strong>Opciones del JSON:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><code>{'{"mensaje":"Selecciona el centro de costo del area."}'}</code> — mensaje que se muestra en el modal (todos los handlers lo soportan)</li>
                  <li><code>{'{"source":"input","inputKey":"miClave"}'}</code> — el valor viene del usuario pero con otra clave</li>
                  <li><code>{'{"value":42}'}</code> — valor fijo (no pide input al usuario)</li>
                  <li><code>{'{"value":true}'}</code> o <code>false</code> — para Checkbox/Booleano</li>
                  <li><code>{'{"value":"texto fijo"}'}</code> — para Texto</li>
                </ul>
                <p className="mt-1 text-[11px]">Nota: si el campo es Checkbox/Booleano y no ponen <code>{'{"value":...}'}</code>, el valor del usuario via <code>datosAdicionales</code> se convierte a <code>bool</code>.</p>
              </>
            )}
            {handlerKey === 'Document' && (
              <>
                <p><strong>Document — Documento requerido</strong></p>
                <p>El usuario debe subir un comprobante (CFDI, SPEI, cheque, etc.). El handler valida que el comprobante exista y coincida con la orden.</p>
                <p className="mt-1"><strong>Opciones del JSON:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><code>{'{"mensaje":"El XML debe ser CFDI 4.0 valido ante el SAT."}'}</code> — mensaje en el modal</li>
                </ul>
              </>
            )}
            {handlerKey === 'Alerta' && (
              <>
                <p><strong>Alerta — Informativo (no bloquea)</strong></p>
                <p>Muestra un mensaje en el modal de firma sin bloquear la accion. Util para avisos y recordatorios.</p>
                <p className="mt-1"><strong>Opciones del JSON:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><code>{'{"mensaje":"Recuerda verificar el presupuesto antes de autorizar."}'}</code></li>
                  <li><code>{'{"tipo":"warning"}'}</code> — ambar (default). Tambien <code>"info"</code> (azul) o <code>"error"</code> (rojo)</li>
                </ul>
              </>
            )}
            {handlerKey === 'ProviderAuthorization' && (
              <>
                <p><strong>ProviderAuthorization — Bloquea si proveedor no autorizado</strong></p>
                <p>Se pre-evalua (muestra banner) y se ejecuta al firmar. Usa un campo tipo <code>Validacion</code>.</p>
                <p className="mt-1"><strong>Opciones del JSON:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><code>{'{"mensaje":"El proveedor no esta autorizado."}'}</code></li>
                </ul>
                <p className="mt-1 text-[11px] text-muted-foreground">Ejemplo de campo: "estatus_proveedor" (tipo Validacion, id=8)</p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="handler-activo" checked={activo} onCheckedChange={v => setActivo(Boolean(v))} />
          <Label htmlFor="handler-activo">Activo</Label>
        </div>
      </form>
    </Modal>
  );
}
