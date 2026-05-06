import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import { API } from '@/services/api';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { PlantillasEditModal } from './PlantillasEditModal';
import type { Workflow, WorkflowPaso } from '@/types/workflow.types';

interface WorkflowWithDetails extends Workflow {
  pasos: WorkflowPaso[];
}

interface RecordatorioEditModalProps {
  workflow: WorkflowWithDetails;
  recordatorio: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: (saved: any, isNew: boolean) => Promise<void>;
}

const REC_VARS = ['{{NombreResponsable}}', '{{CantidadPendientes}}', '{{DiasEspera}}', '{{ListadoPendientes}}', '{{Folios}}', '{{Folio}}', '{{Total}}'];

const EMPTY_REC = {
  nombre: '',
  activo: true,
  idPaso: '',
  tipoTrigger: 'horario',
  horaEnvio: '09:00',
  diasSemana: '1,2,3,4,5',
  intervaloHoras: 24,
  fechaEspecifica: '',
  minOrdenesPendientes: '',
  minDiasEnPaso: '',
  montoMinimo: '',
  montoMaximo: '',
  escalarAJerarquia: false,
  diasParaEscalar: '',
  enviarAlResponsable: true,
  enviarEmail: true,
  enviarWhatsapp: false,
  enviarTelegram: false,
  canales: [] as any[]
};

export function RecordatorioEditModal({ workflow, recordatorio, open, setOpen, onSave }: RecordatorioEditModalProps) {
  const isNew = !recordatorio;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(EMPTY_REC);

  const pasos = workflow.pasos;

  useEffect(() => {
    if (recordatorio) {
      setFormData({
        ...EMPTY_REC,
        ...recordatorio,
        idPaso: recordatorio.idPaso ?? '',
        horaEnvio: recordatorio.horaEnvio ?? '09:00',
        diasSemana: recordatorio.diasSemana ?? '1,2,3,4,5',
        intervaloHoras: recordatorio.intervaloHoras ?? 24,
        fechaEspecifica: recordatorio.fechaEspecifica ?? '',
        minOrdenesPendientes: recordatorio.minOrdenesPendientes ?? '',
        minDiasEnPaso: recordatorio.minDiasEnPaso ?? '',
        montoMinimo: recordatorio.montoMinimo ?? '',
        montoMaximo: recordatorio.montoMaximo ?? '',
        diasParaEscalar: recordatorio.diasParaEscalar ?? '',
        canales: recordatorio.canales ?? [],
      });
    } else {
      setFormData(EMPTY_REC);
    }
  }, [recordatorio, open]);

  const set = (field: string, value: any) => setFormData((p: any) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        idPaso: formData.idPaso ? Number(formData.idPaso) : null,
        minOrdenesPendientes: formData.minOrdenesPendientes !== '' ? Number(formData.minOrdenesPendientes) : null,
        minDiasEnPaso: formData.minDiasEnPaso !== '' ? Number(formData.minDiasEnPaso) : null,
        montoMinimo: formData.montoMinimo !== '' ? Number(formData.montoMinimo) : null,
        montoMaximo: formData.montoMaximo !== '' ? Number(formData.montoMaximo) : null,
        diasParaEscalar: formData.diasParaEscalar !== '' ? Number(formData.diasParaEscalar) : null,
        intervaloHoras: formData.tipoTrigger === 'recurrente' ? Number(formData.intervaloHoras) : null,
        horaEnvio: formData.tipoTrigger === 'horario' ? formData.horaEnvio : null,
        diasSemana: formData.tipoTrigger === 'horario' ? formData.diasSemana : null,
        fechaEspecifica: formData.tipoTrigger === 'fecha_especifica' ? formData.fechaEspecifica || null : null,
      };

      if (isNew) {
        const res = await API.post<any>(`/config/workflows/${workflow.idWorkflow}/recordatorios`, payload);
        toast.success('Recordatorio creado');
        await onSave(res.data?.data ?? payload, true);
      } else {
        const res = await API.put<any>(`/config/workflows/${workflow.idWorkflow}/recordatorios/${recordatorio.idRecordatorio}`, payload);
        toast.success('Recordatorio guardado');
        await onSave(res.data?.data ?? { ...recordatorio, ...payload }, false);
      }
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      toast.error(apiErr.message ?? 'Error al guardar el recordatorio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      id="modal-recordatorio"
      open={open}
      setOpen={setOpen}
      title={isNew ? 'Nuevo Recordatorio' : 'Editar Recordatorio'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="form-recordatorio" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isNew ? 'Crear' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-recordatorio" onSubmit={handleSubmit} className="space-y-5">

        {/* Identificación */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="rec-nombre">Nombre *</Label>
            <Input id="rec-nombre" value={formData.nombre} onChange={e => set('nombre', e.target.value)} required placeholder="Ej. Recordatorio diario pendientes" />
          </div>
          <div>
            <Label htmlFor="rec-paso">Paso específico</Label>
            <select
              id="rec-paso"
              value={formData.idPaso ?? ''}
              onChange={e => set('idPaso', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los pasos</option>
              {pasos.map((p: WorkflowPaso) => (
                <option key={p.idPaso} value={p.idPaso}>{p.nombrePaso}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Checkbox id="rec-activo" checked={formData.activo} onCheckedChange={v => set('activo', Boolean(v))} />
            <Label htmlFor="rec-activo">Activo</Label>
          </div>
        </div>

        {/* Trigger */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger de tiempo</p>
          <div>
            <Label>Tipo</Label>
            <select
              value={formData.tipoTrigger}
              onChange={e => set('tipoTrigger', e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="horario">Horario (hora del día)</option>
              <option value="recurrente">Recurrente (cada N horas)</option>
              <option value="fecha_especifica">Fecha específica</option>
            </select>
          </div>
          {formData.tipoTrigger === 'horario' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rec-hora">Hora de envío</Label>
                <Input id="rec-hora" type="time" value={formData.horaEnvio} onChange={e => set('horaEnvio', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rec-dias">Días de la semana</Label>
                <Input id="rec-dias" value={formData.diasSemana} onChange={e => set('diasSemana', e.target.value)} placeholder="1,2,3,4,5 (lun-vie)" />
                <p className="text-xs text-muted-foreground mt-1">1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom</p>
              </div>
            </div>
          )}
          {formData.tipoTrigger === 'recurrente' && (
            <div>
              <Label htmlFor="rec-intervalo">Intervalo (horas)</Label>
              <Input id="rec-intervalo" type="number" min={1} value={formData.intervaloHoras} onChange={e => set('intervaloHoras', e.target.value)} />
            </div>
          )}
          {formData.tipoTrigger === 'fecha_especifica' && (
            <div>
              <Label htmlFor="rec-fecha">Fecha</Label>
              <Input id="rec-fecha" type="date" value={formData.fechaEspecifica} onChange={e => set('fechaEspecifica', e.target.value)} />
            </div>
          )}
        </div>

        {/* Condiciones */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Condiciones de activación</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rec-minord">Mín. órdenes pendientes</Label>
              <Input id="rec-minord" type="number" min={1} value={formData.minOrdenesPendientes} onChange={e => set('minOrdenesPendientes', e.target.value)} placeholder="Sin mínimo" />
            </div>
            <div>
              <Label htmlFor="rec-mindias">Mín. días en paso</Label>
              <Input id="rec-mindias" type="number" min={1} value={formData.minDiasEnPaso} onChange={e => set('minDiasEnPaso', e.target.value)} placeholder="Sin mínimo" />
            </div>
            <div>
              <Label htmlFor="rec-montmin">Monto mínimo</Label>
              <Input id="rec-montmin" type="number" min={0} value={formData.montoMinimo} onChange={e => set('montoMinimo', e.target.value)} placeholder="Sin límite" />
            </div>
            <div>
              <Label htmlFor="rec-montmax">Monto máximo</Label>
              <Input id="rec-montmax" type="number" min={0} value={formData.montoMaximo} onChange={e => set('montoMaximo', e.target.value)} placeholder="Sin límite" />
            </div>
          </div>
        </div>

        {/* Destinatarios y canales */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destinatarios y canales</p>
          <div className="flex items-center gap-2">
            <Checkbox id="rec-resp" checked={formData.enviarAlResponsable} onCheckedChange={v => set('enviarAlResponsable', Boolean(v))} />
            <Label htmlFor="rec-resp" className="cursor-pointer">Al responsable del paso</Label>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox id="rec-email" checked={formData.enviarEmail} onCheckedChange={v => set('enviarEmail', Boolean(v))} />
              <Label htmlFor="rec-email" className="cursor-pointer font-medium">📧 Email</Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox id="rec-wa" checked={formData.enviarWhatsapp} onCheckedChange={v => set('enviarWhatsapp', Boolean(v))} />
              <Label htmlFor="rec-wa" className="cursor-pointer font-medium">💬 WhatsApp</Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox id="rec-tg" checked={formData.enviarTelegram} onCheckedChange={v => set('enviarTelegram', Boolean(v))} />
              <Label htmlFor="rec-tg" className="cursor-pointer font-medium">✈️ Telegram</Label>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-4 pt-1 border-t border-border/50">
            <div className="flex items-center gap-2 pt-2">
              <Checkbox id="rec-escalar" checked={formData.escalarAJerarquia} onCheckedChange={v => set('escalarAJerarquia', Boolean(v))} />
              <Label htmlFor="rec-escalar" className="cursor-pointer">Escalar a jerarquía si supera</Label>
            </div>
            {formData.escalarAJerarquia && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={1}
                  value={formData.diasParaEscalar}
                  onChange={e => set('diasParaEscalar', e.target.value)}
                  className="w-20"
                  placeholder="días"
                />
                <span className="text-sm text-muted-foreground">días sin acción</span>
              </div>
            )}
          </div>
        </div>

        {/* Templates por canal */}
        <PlantillasEditModal
          canales={formData.canales ?? []}
          enviarEmail={formData.enviarEmail}
          enviarWhatsapp={formData.enviarWhatsapp}
          enviarTelegram={formData.enviarTelegram}
          bodyVars={REC_VARS}
          tablaVarName="{{ListadoPendientes}}"
          showListadoRowHtml={true}
          listadoRowHtmlExample={`<tr>\n  <td>{{Folio}}</td>\n  <td>{{Proveedor}}</td>\n  <td style="text-align:right">{{Total}}</td>\n  <td style="color:#6b7280">{{DiasEspera}} días</td>\n</tr>`}
          onChange={(canales: any[]) => set('canales', canales)}
        />

      </form>
    </Modal>
  );
}
