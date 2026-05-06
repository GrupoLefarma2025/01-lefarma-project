import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { API } from '@/services/api';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';

interface TemplateEditModalProps {
  template: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: (saved: any, isNew: boolean) => Promise<void>;
}

const CANAL_VARS: Record<string, string[]> = {
  email:    ['{{Contenido}}', '{{Folio}}', '{{Asunto}}', '{{UrlOrden}}', '{{Proveedor}}', '{{Total}}'],
  in_app:   ['{{Contenido}}'],
  telegram: ['{{Contenido}}', '{{Folio}}', '{{UrlOrden}}'],
  whatsapp: ['{{Contenido}}', '{{Folio}}'],
};

export function TemplateEditModal({ template, open, setOpen, onSave }: TemplateEditModalProps) {
  const isNew = !template;
  const [formData, setFormData] = useState({ codigoCanal: '', nombre: '', layoutHtml: '', activo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setFormData({ codigoCanal: template.codigoCanal, nombre: template.nombre, layoutHtml: template.layoutHtml, activo: template.activo ?? true });
      } else {
        setFormData({ codigoCanal: '', nombre: '', layoutHtml: '{{Contenido}}', activo: true });
      }
    }
  }, [template, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const res = await API.post<any>(
          `/config/workflows/canal-templates`,
          { codigoCanal: formData.codigoCanal, nombre: formData.nombre, layoutHtml: formData.layoutHtml, activo: formData.activo }
        );
        toast.success('Plantilla de canal creada');
        await onSave(res.data?.data ?? formData, true);
      } else {
        const res = await API.put<any>(
          `/config/workflows/canal-templates/${template.codigoCanal}`,
          { nombre: formData.nombre, layoutHtml: formData.layoutHtml, activo: formData.activo }
        );
        toast.success('Plantilla de canal guardada');
        await onSave(res.data?.data ?? { ...template, ...formData }, false);
      }
    } catch (error: unknown) {
      const apiErr = toApiError(error);
      const msg = apiErr.message ?? (isNew ? 'Error al crear la plantilla' : 'Error al guardar la plantilla');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const vars = CANAL_VARS[formData.codigoCanal] ?? ['{{Contenido}}'];

  return (
    <Modal
      id="modal-canal-template"
      open={open}
      setOpen={setOpen}
      title={isNew ? 'Nueva Plantilla de Canal' : `Plantilla de Canal — ${template?.codigoCanal?.toUpperCase() ?? ''}`}
      size="xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" form="form-canal-template" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isNew ? 'Crear' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form id="form-canal-template" onSubmit={handleSubmit} className="space-y-4">
        {isNew && (
          <div>
            <Label htmlFor="ct-canal">Canal</Label>
            <select
              id="ct-canal"
              value={formData.codigoCanal}
              onChange={e => setFormData(p => ({ ...p, codigoCanal: e.target.value }))}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="" disabled>Selecciona un canal…</option>
              <option value="email">Email</option>
              <option value="in_app">In-App</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="ct-nombre">Nombre</Label>
          <Input
            id="ct-nombre"
            value={formData.nombre}
            onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="ct-layout">Layout HTML</Label>
            {vars.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Variables: {vars.map(v => <code key={v} className="mx-0.5 px-1 py-0.5 rounded bg-muted text-xs">{v}</code>)}
              </span>
            )}
          </div>
          <Textarea
            id="ct-layout"
            value={formData.layoutHtml}
            onChange={e => setFormData(p => ({ ...p, layoutHtml: e.target.value }))}
            rows={18}
            className="font-mono text-xs"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            <code className="bg-muted px-1 rounded">{'{{Contenido}}'}</code> será reemplazado por el cuerpo de la notificación ya interpolado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="ct-activo"
            checked={formData.activo}
            onCheckedChange={v => setFormData(p => ({ ...p, activo: Boolean(v) }))}
          />
          <Label htmlFor="ct-activo">Activo</Label>
        </div>
      </form>
    </Modal>
  );
}
