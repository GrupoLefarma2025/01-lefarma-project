import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { API } from '@/shared/api/apiClient';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import type { ApiResponse } from '@/types/api.types';
import type { WorkflowCampo } from '@/types/workflow.types';

export type CampoWorkflowEditable = Pick<
  WorkflowCampo,
  | 'idWorkflowCampo'
  | 'nombreTecnico'
  | 'etiquetaUsuario'
  | 'tipoControl'
  | 'sourceCatalog'
  | 'propiedadEntidad'
  | 'validarFiscal'
  | 'usarEnCondiciones'
  | 'codigoProceso'
  | 'activo'
>;

const TIPOS_CONTROL = [
  { value: 'Texto', label: 'Texto' },
  { value: 'Numero', label: 'Número' },
  { value: 'Checkbox', label: 'Checkbox' },
  { value: 'Selector', label: 'Selector (catálogo)' },
  { value: 'Fecha', label: 'Fecha' },
  { value: 'Archivo', label: 'Archivo (documento)' },
  { value: 'Alerta', label: 'Alerta' },
  { value: 'Validacion', label: 'Validación' },
];

const PROCESO_GLOBAL = 'TODOS';

const CODIGOS_PROCESO = [
  { value: PROCESO_GLOBAL, label: 'Todos (global)' },
  { value: 'ORDEN_COMPRA', label: 'Orden de Compra' },
  { value: 'SOLICITUD_PERSONAL', label: 'Solicitud de Personal' },
  { value: 'EDUCACION_MEDICA_SELECCION', label: 'Educación Médica · Selección mensual' },
  { value: 'EDUCACION_MEDICA_RUTAS', label: 'Educación Médica · Planificación de rutas' },
];

interface CampoEditModalProps {
  campo: CampoWorkflowEditable | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}

export function CampoEditModal({ campo, open, setOpen, onSaved }: CampoEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [nombreTecnico, setNombreTecnico] = useState('');
  const [etiquetaUsuario, setEtiquetaUsuario] = useState('');
  const [tipoControl, setTipoControl] = useState('Texto');
  const [sourceCatalog, setSourceCatalog] = useState('');
  const [propiedadEntidad, setPropiedadEntidad] = useState('');
  const [validarFiscal, setValidarFiscal] = useState(false);
  const [usarEnCondiciones, setUsarEnCondiciones] = useState(false);
  const [codigoProceso, setCodigoProceso] = useState(PROCESO_GLOBAL);
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (campo) {
      setNombreTecnico(campo.nombreTecnico);
      setEtiquetaUsuario(campo.etiquetaUsuario);
      setTipoControl(campo.tipoControl);
      setSourceCatalog(campo.sourceCatalog ?? '');
      setPropiedadEntidad(campo.propiedadEntidad ?? '');
      setValidarFiscal(campo.validarFiscal ?? false);
      setUsarEnCondiciones(campo.usarEnCondiciones ?? false);
      setCodigoProceso(campo.codigoProceso ?? PROCESO_GLOBAL);
      setActivo(campo.activo);
    } else {
      setNombreTecnico('');
      setEtiquetaUsuario('');
      setTipoControl('Texto');
      setSourceCatalog('');
      setPropiedadEntidad('');
      setValidarFiscal(false);
      setUsarEnCondiciones(false);
      setCodigoProceso(PROCESO_GLOBAL);
      setActivo(true);
    }
  }, [open, campo]);

  const handleGuardar = async () => {
    if (!nombreTecnico.trim() || !etiquetaUsuario.trim()) {
      toast.error('Nombre técnico y etiqueta son obligatorios');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nombreTecnico: nombreTecnico.trim(),
        etiquetaUsuario: etiquetaUsuario.trim(),
        tipoControl,
        sourceCatalog: tipoControl === 'Selector' ? sourceCatalog.trim() || null : null,
        propiedadEntidad: propiedadEntidad.trim() || null,
        validarFiscal,
        usarEnCondiciones,
        codigoProceso: codigoProceso === PROCESO_GLOBAL ? null : codigoProceso,
        activo,
      };

      const response = campo
        ? await API.put<ApiResponse<WorkflowCampo>>(
            `/config/workflows/campos/${campo.idWorkflowCampo}`,
            payload
          )
        : await API.post<ApiResponse<WorkflowCampo>>('/config/workflows/campos', payload);

      if (response.data.success) {
        toast.success(campo ? 'Campo actualizado' : 'Campo creado');
        await onSaved();
        setOpen(false);
      } else {
        toast.error(response.data.message ?? 'Error al guardar el campo');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al guardar el campo');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      id="modal-workflow-campo"
      open={open}
      setOpen={setOpen}
      title={campo ? 'Editar campo' : 'Nuevo campo'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleGuardar} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {campo ? 'Actualizar' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre técnico *</Label>
            <Input
              value={nombreTecnico}
              onChange={(e) => setNombreTecnico(e.target.value)}
              placeholder="ej: acta_matrimonio"
              className="font-mono text-xs"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Clave única con la que se etiquetan los archivos y se vinculan los handlers.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Etiqueta para el usuario *</Label>
            <Input
              value={etiquetaUsuario}
              onChange={(e) => setEtiquetaUsuario(e.target.value)}
              placeholder="ej: Acta de matrimonio"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de control *</Label>
            <Select value={tipoControl} onValueChange={setTipoControl}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CONTROL.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tipoControl === 'Selector' && (
            <div className="space-y-2">
              <Label>Catálogo fuente</Label>
              <Input
                value={sourceCatalog}
                onChange={(e) => setSourceCatalog(e.target.value)}
                placeholder="ej: /catalogos/Empresas"
                className="font-mono text-xs"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Propiedad de la entidad (opcional)</Label>
            <Input
              value={propiedadEntidad}
              onChange={(e) => setPropiedadEntidad(e.target.value)}
              placeholder="ej: Motivo"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Solo para campos de entrada (Field): propiedad donde se guarda el valor.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Proceso</Label>
            <Select value={codigoProceso} onValueChange={setCodigoProceso}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CODIGOS_PROCESO.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Limita el campo a un proceso (aparecerá solo en sus condiciones y workflows).
              "Todos" lo deja global.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="campo-validar-fiscal"
              checked={validarFiscal}
              onCheckedChange={(v) => setValidarFiscal(Boolean(v))}
            />
            <Label htmlFor="campo-validar-fiscal">Validar fiscal</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="campo-usar-en-condiciones"
              checked={usarEnCondiciones}
              onCheckedChange={(v) => setUsarEnCondiciones(Boolean(v))}
            />
            <Label htmlFor="campo-usar-en-condiciones">Usar en condiciones</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="campo-activo"
              checked={activo}
              onCheckedChange={(v) => setActivo(Boolean(v))}
            />
            <Label htmlFor="campo-activo">Activo</Label>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default CampoEditModal;
