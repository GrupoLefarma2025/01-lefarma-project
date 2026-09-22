import { useState, useEffect, useRef } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { API } from '@/shared/api/apiClient';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { CATEGORIAS_SOLICITUD } from '@/types/solicitudPersonal.types';
import { tipoSolicitudApi } from '@/apps/rh/services/rh.api';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
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
  { value: 'Document',              label: 'Comprobante OC (gasto/pago)' },
  { value: 'Archivo',               label: 'Documento adjunto (solicitudes / OC)' },
  { value: 'Alerta',                label: 'Alerta informativa' },
  { value: 'ProviderAuthorization', label: 'Validacion de proveedor' },
];

const CAMPOS_COMPROBANTE_OC = ['comprobante_gasto', 'comprobante_pago'];

interface OpcionAplica {
  id: number;
  label: string;
}

interface CampoAplicaDef {
  clave: string;
  label: string;
}

interface AplicaFila {
  id: number;
  clave: string;
  valor: number | null;
}

const CAMPOS_APLICA: Record<string, CampoAplicaDef[]> = {
  SOLICITUD_PERSONAL: [
    { clave: 'tipoSolicitud', label: 'Tipo de solicitud' },
    { clave: 'categoria', label: 'Categoría' },
    { clave: 'empresa', label: 'Empresa' },
    { clave: 'sucursal', label: 'Sucursal' },
    { clave: 'area', label: 'Área' },
  ],
  ORDEN_COMPRA: [
    { clave: 'tipoGasto', label: 'Tipo de gasto' },
    { clave: 'proveedor', label: 'Proveedor' },
    { clave: 'empresa', label: 'Empresa' },
    { clave: 'sucursal', label: 'Sucursal' },
    { clave: 'area', label: 'Área' },
  ],
  EDUCACION_MEDICA_SELECCION: [{ clave: 'tipoGerencia', label: 'Tipo de gerencia' }],
  EDUCACION_MEDICA_RUTAS: [{ clave: 'tipoGerencia', label: 'Tipo de gerencia' }],
};

function normalizarOpcionesAplica(items: unknown[]): OpcionAplica[] {
  const LABEL_KEYS = ['nombre', 'name', 'razonsocial', 'descripcion', 'etiqueta', 'label'];

  return items
    .map((item) => {
      const obj = item as Record<string, unknown>;
      const idKey = Object.keys(obj).find((k) => /^id/i.test(k) && typeof obj[k] === 'number');
      const labelKey = Object.keys(obj).find((k) =>
        LABEL_KEYS.includes(k.toLowerCase().replace(/_/g, ''))
      );
      if (!idKey || !labelKey) return null;

      const id = Number(obj[idKey]);
      const label = String(obj[labelKey] ?? '');
      return id > 0 && label ? { id, label } : null;
    })
    .filter((o): o is OpcionAplica => o !== null);
}

async function fetchCatalogoAplica(endpoint: string): Promise<OpcionAplica[]> {
  const res = await API.get<{ data?: unknown[] }>(endpoint);
  return normalizarOpcionesAplica(res.data.data ?? []);
}

async function cargarOpcionesAplica(clave: string): Promise<OpcionAplica[]> {
  switch (clave) {
    case 'categoria':
      return Object.entries(CATEGORIAS_SOLICITUD)
        .filter(([key]) => /^\d+$/.test(key))
        .map(([key, label]) => ({ id: Number(key), label: String(label) }))
        .sort((a, b) => a.id - b.id);
    case 'tipoSolicitud': {
      const res = await tipoSolicitudApi.getActivos();
      return normalizarOpcionesAplica(res.data.data ?? []);
    }
    case 'tipoGerencia': {
      const res = await educacionMedicaApi.tipoGerencia.getAll();
      return normalizarOpcionesAplica(res.data.data ?? []);
    }
    case 'tipoGasto':
      return fetchCatalogoAplica('/catalogos/TiposGasto');
    case 'proveedor':
      return fetchCatalogoAplica('/catalogos/proveedores');
    case 'empresa':
      return fetchCatalogoAplica('/catalogos/Empresas');
    case 'sucursal':
      return fetchCatalogoAplica('/catalogos/Sucursales');
    case 'area':
      return fetchCatalogoAplica('/catalogos/Areas');
    default:
      return [];
  }
}

export function HandlerEditModal({ workflow, accion, handler, open, setOpen, onSave }: HandlerEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAccionId, setSelectedAccionId] = useState<number | null>(accion?.idAccion ?? null);
  const [handlerKey, setHandlerKey] = useState('Field');
  const [ordenEjecucion, setOrdenEjecucion] = useState(1);
  const [activo, setActivo] = useState(true);
  const [selectedCampoId, setSelectedCampoId] = useState<number | null>(null);
  const [configuracionJson, setConfiguracionJson] = useState('');
  const [aplicaFilas, setAplicaFilas] = useState<AplicaFila[]>([]);
  const [opcionesAplica, setOpcionesAplica] = useState<Record<string, OpcionAplica[]>>({});
  const [loadingOpciones, setLoadingOpciones] = useState<Record<string, boolean>>({});
  const filaSeq = useRef(1);

  const camposAplica = workflow.codigoProceso
    ? CAMPOS_APLICA[workflow.codigoProceso] ?? []
    : [];

  const cargarOpciones = async (clave: string) => {
    if (opcionesAplica[clave]) return;
    setLoadingOpciones((prev) => ({ ...prev, [clave]: true }));
    try {
      const opciones = await cargarOpcionesAplica(clave);
      setOpcionesAplica((prev) => ({ ...prev, [clave]: opciones }));
    } catch {
      setOpcionesAplica((prev) => ({ ...prev, [clave]: [] }));
    } finally {
      setLoadingOpciones((prev) => ({ ...prev, [clave]: false }));
    }
  };

  const availableCampos = (workflow.campos || [])
    .filter((c: WorkflowCampo) => c.activo)
    .filter((c: WorkflowCampo) => {
      if (handlerKey === 'Field') return ['Texto', 'Numero', 'Checkbox', 'Selector', 'Fecha'].includes(c.tipoControl);
      if (handlerKey === 'Document')
        return c.tipoControl === 'Archivo' && CAMPOS_COMPROBANTE_OC.includes(c.nombreTecnico);
      if (handlerKey === 'Archivo')
        return c.tipoControl === 'Archivo' && !CAMPOS_COMPROBANTE_OC.includes(c.nombreTecnico);
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

      const filas: AplicaFila[] = [];
      const cfg = parseExistingJson(handler.configuracionJson || '') as {
        aplica?: Record<string, unknown>;
      } | null;
      for (const [clave, ids] of Object.entries(cfg?.aplica ?? {})) {
        if (!Array.isArray(ids)) continue;
        for (const id of ids) {
          if (typeof id === 'number') filas.push({ id: filaSeq.current++, clave, valor: id });
        }
      }
      setAplicaFilas(filas);
      setOpcionesAplica({});
      for (const clave of new Set(filas.map((f) => f.clave))) void cargarOpciones(clave);
    } else {
      setHandlerKey('Field');
      setOrdenEjecucion(1);
      setActivo(true);
      setSelectedCampoId(null);
      setConfiguracionJson('');
      setAplicaFilas([]);
      setOpcionesAplica({});
    }
  };

  useEffect(() => {
    setSelectedAccionId(accion?.idAccion ?? null);
    initFromHandler();
  }, [handler, accion, open]);

  const agregarFila = () => {
    const clave = camposAplica[0]?.clave;
    if (!clave) return;
    setAplicaFilas((prev) => [...prev, { id: filaSeq.current++, clave, valor: null }]);
    void cargarOpciones(clave);
  };

  const cambiarClaveFila = (filaId: number, clave: string) => {
    setAplicaFilas((prev) =>
      prev.map((f) => (f.id === filaId ? { ...f, clave, valor: null } : f))
    );
    void cargarOpciones(clave);
  };

  const cambiarValorFila = (filaId: number, valor: number) => {
    setAplicaFilas((prev) => prev.map((f) => (f.id === filaId ? { ...f, valor } : f)));
  };

  const quitarFila = (filaId: number) => {
    setAplicaFilas((prev) => prev.filter((f) => f.id !== filaId));
  };

  const construirConfiguracion = (): string | null | undefined => {
    const aplica: Record<string, number[]> = {};
    for (const fila of aplicaFilas) {
      if (fila.valor == null) continue;
      (aplica[fila.clave] ??= []).push(fila.valor);
    }
    const tieneAplica = Object.keys(aplica).length > 0;
    const raw = configuracionJson.trim();

    let base: Record<string, unknown> = {};
    if (raw) {
      const parsed = parseExistingJson(raw) as Record<string, unknown> | null;
      if (parsed === null) {
        if (!tieneAplica) return raw;
        toast.error('El JSON de configuración no es válido; corrígelo antes de asignar condiciones');
        return undefined;
      }
      base = parsed;
    }

    if (tieneAplica) {
      base.aplica = aplica;
    } else {
      delete base.aplica;
    }

    return Object.keys(base).length > 0 ? JSON.stringify(base) : null;
  };

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

      const configuracion = construirConfiguracion();
      if (configuracion === undefined) {
        setIsSaving(false);
        return;
      }
      payload.configuracionJson = configuracion;

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
            <p className="text-xs text-muted-foreground">
              {(handlerKey === 'Document' || handlerKey === 'Archivo')
                ? handlerKey === 'Document'
                  ? 'No hay campos de comprobante OC. Deben existir comprobante_gasto o comprobante_pago.'
                  : 'No hay campos tipo Archivo. Créalos con el botón "Campos" antes de configurar este handler.'
                : 'No hay campos disponibles en este workflow.'}
            </p>
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

        {camposAplica.length > 0 && (
          <div className="space-y-3 rounded-md border border-border bg-muted/20 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Aplica solo a
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Sin condiciones aplica siempre. Repetir un campo suma valores (OR); entre campos
                  distintos deben coincidir todos (AND).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={agregarFila}
              >
                <Plus className="h-3.5 w-3.5" />
                Condición
              </Button>
            </div>

            {aplicaFilas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin condiciones: el handler aplica a todos.
              </p>
            ) : (
              <div className="space-y-2">
                {aplicaFilas.map((fila) => {
                  const opciones = opcionesAplica[fila.clave] ?? [];
                  const cargando = loadingOpciones[fila.clave] === true;

                  return (
                    <div key={fila.id} className="flex items-center gap-2">
                      <Select
                        value={fila.clave}
                        onValueChange={(v) => cambiarClaveFila(fila.id, v)}
                      >
                        <SelectTrigger className="h-8 w-44 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {camposAplica.map((c) => (
                            <SelectItem key={c.clave} value={c.clave} className="text-xs">
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={fila.valor != null ? String(fila.valor) : ''}
                        onValueChange={(v) => cambiarValorFila(fila.id, Number(v))}
                        disabled={cargando}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs">
                          <SelectValue
                            placeholder={cargando ? 'Cargando...' : 'Selecciona un valor'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {opciones.map((o) => (
                            <SelectItem key={o.id} value={String(o.id)} className="text-xs">
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => quitarFila(fila.id)}
                        title="Quitar condición"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
                : handlerKey === 'Archivo'
                ? '{"mensaje":"Sube el documento solicitado para continuar."}'
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
                <p><strong>Comprobante OC — Documento requerido (gasto/pago)</strong></p>
                <p>
                  Solo para órdenes de compra y solo con los campos <code>comprobante_gasto</code> o{' '}
                  <code>comprobante_pago</code>. Valida que exista un comprobante real registrado y
                  asignado a partidas (validación adicional del sistema, no de un archivo adjunto).
                </p>
                <p className="mt-1"><strong>Opciones del JSON:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><code>{'{"mensaje":"El XML debe ser CFDI 4.0 valido ante el SAT."}'}</code> — mensaje en el modal</li>
                </ul>
              </>
            )}
            {handlerKey === 'Archivo' && (
              <>
                <p><strong>Documento adjunto — Documento requerido (solicitudes / OC)</strong></p>
                <p>
                  El usuario debe subir un archivo adjunto etiquetado con la clave del campo (por
                  ejemplo <code>acta_matrimonio</code>). Aplica a solicitudes de personal y órdenes de
                  compra; los archivos ya adjuntos cuentan. No admite los campos de comprobante de OC.
                </p>
                <p className="mt-1"><strong>Opciones del JSON:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li><code>{'{"mensaje":"Sube el acta de matrimonio para continuar."}'}</code> — mensaje en el modal</li>
                  <li><code>{'{"requiereRevision":true}'}</code> — exige marcar &quot;Revisado&quot; el documento al firmar</li>
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
