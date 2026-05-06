import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { API } from '@/services/api';
import { toast } from 'sonner';

export const CANAL_DEFAULTS: Record<string, { asunto: string; cuerpo: string }> = {
  email: {
    asunto: '',
    cuerpo: '<p>Hola <strong>{{NombreResponsable}}</strong>,</p>\n<p>Tienes <strong>{{CantidadPendientes}}</strong> orden(es) pendiente(s) de revisión. La más antigua lleva <strong>{{DiasEspera}}</strong> días esperando.</p>\n{{ListadoPendientes}}'
  },
  in_app: {
    asunto: '',
    cuerpo: 'Tienes {{CantidadPendientes}} OC pendiente(s): {{Folios}}'
  },
  whatsapp: {
    asunto: '',
    cuerpo: '⏰ *Recordatorio de órdenes*\nHola {{NombreResponsable}}, tienes {{CantidadPendientes}} orden(es) pendiente(s):\n{{Folios}}'
  },
  telegram: {
    asunto: '',
    cuerpo: '⏰ <b>Recordatorio</b>\nHola {{NombreResponsable}}, tienes <b>{{CantidadPendientes}}</b> orden(es) pendiente(s):\n{{Folios}}'
  }
};

interface PlantillasEditModalProps {
  canales: any[];
  enviarEmail: boolean;
  enviarWhatsapp: boolean;
  enviarTelegram: boolean;
  showListadoRowHtml?: boolean;
  listadoRowHtmlLabel?: string;
  listadoRowHtmlVars?: string[];
  listadoRowHtmlPlaceholder?: string;
  listadoRowHtmlExample?: string;
  bodyVars?: string[];
  /** Variable name (e.g. '{{Partidas}}') — when set, shows a per-canal toggle that inserts/removes the var from the body template */
  tablaVarName?: string;
  tipoNotificacion?: string;
  onChange: (canales: any[]) => void;
}

export function PlantillasEditModal({
  canales,
  enviarEmail,
  enviarWhatsapp,
  enviarTelegram,
  showListadoRowHtml = false,
  listadoRowHtmlLabel,
  listadoRowHtmlVars,
  listadoRowHtmlPlaceholder,
  listadoRowHtmlExample,
  bodyVars,
  tablaVarName,
  tipoNotificacion,
  onChange
}: PlantillasEditModalProps) {
  const canalesActivos = [
    { codigo: 'in_app', label: '🔔 In-App' },
    enviarEmail && { codigo: 'email', label: '✉️ Email' },
    enviarWhatsapp && { codigo: 'whatsapp', label: '💬 WhatsApp' },
    enviarTelegram && { codigo: 'telegram', label: '📨 Telegram' },
  ].filter(Boolean) as { codigo: string; label: string }[];

  const [tabActivo, setTabActivo] = useState(canalesActivos[0]?.codigo ?? 'in_app');
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [showPlantillaMenu, setShowPlantillaMenu] = useState<string | null>(null);

  const getCanalData = (codigo: string) =>
    canales.find((c: any) => c.codigoCanal === codigo) ?? {
      codigoCanal: codigo,
      asuntoTemplate: CANAL_DEFAULTS[codigo]?.asunto ?? '',
      cuerpoTemplate: CANAL_DEFAULTS[codigo]?.cuerpo ?? '',
      listadoRowHtml: '',
      activo: true
    };

  const updateCanal = (codigo: string, field: string, value: any) => {
    const existing = canales.find((c: any) => c.codigoCanal === codigo);
    if (existing) {
      onChange(canales.map((c: any) => c.codigoCanal === codigo ? { ...c, [field]: value } : c));
    } else {
      const defaults = getCanalData(codigo);
      onChange([...canales, { ...defaults, [field]: value }]);
    }
  };

  const cargarPlantillas = async (canal: string) => {
    setLoadingPlantillas(true);
    try {
      const params = new URLSearchParams({ canal });
      if (tipoNotificacion) params.append('tipoNotificacion', tipoNotificacion);
      const res = await API.get<any>(`/config/workflows/plantillas-base?${params}`);
      setPlantillas(res.data?.data ?? []);
      setShowPlantillaMenu(canal);
    } catch {
      toast.error('No se pudieron cargar las plantillas');
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const aplicarPlantilla = (canal: string, plantilla: any) => {
    const existing = canales.find((c: any) => c.codigoCanal === canal);
    const base = existing ?? getCanalData(canal);
    const updated = {
      ...base,
      asuntoTemplate: plantilla.asuntoTemplate ?? base.asuntoTemplate,
      cuerpoTemplate: plantilla.cuerpoTemplate ?? base.cuerpoTemplate,
      listadoRowHtml: plantilla.listadoRowHtml ?? base.listadoRowHtml ?? '',
    };
    if (existing) {
      onChange(canales.map((c: any) => c.codigoCanal === canal ? updated : c));
    } else {
      onChange([...canales, updated]);
    }
    setShowPlantillaMenu(null);
  };

  useEffect(() => {
    if (!canalesActivos.find(c => c.codigo === tabActivo)) {
      setTabActivo(canalesActivos[0]?.codigo ?? 'in_app');
    }
  }, [enviarEmail, enviarWhatsapp, enviarTelegram]);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plantillas por canal</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {canalesActivos.map(c => (
          <button
            key={c.codigo}
            type="button"
            onClick={() => setTabActivo(c.codigo)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors -mb-px border ${
              tabActivo === c.codigo
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {canalesActivos.map(c => {
        const data = getCanalData(c.codigo);
        return (
          <div key={c.codigo} className={tabActivo === c.codigo ? 'space-y-2' : 'hidden'}>
            {/* Botón cargar plantilla */}
            <div className="relative">
              <button
                type="button"
                onClick={() => showPlantillaMenu === c.codigo ? setShowPlantillaMenu(null) : cargarPlantillas(c.codigo)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                📋 {loadingPlantillas && showPlantillaMenu !== c.codigo ? 'Cargando...' : 'Cargar plantilla base'}
              </button>
              {showPlantillaMenu === c.codigo && (
                <div className="absolute z-10 top-6 left-0 bg-background border border-border rounded-lg shadow-lg p-2 min-w-[280px] space-y-1">
                  {plantillas.length === 0
                    ? <p className="text-xs text-muted-foreground px-2 py-1">Sin plantillas disponibles para este canal</p>
                    : plantillas.map((p: any) => (
                        <button
                          key={p.idPlantilla}
                          type="button"
                          onClick={() => aplicarPlantilla(c.codigo, p)}
                          className="w-full text-left text-xs px-3 py-1.5 rounded hover:bg-muted"
                        >
                          <span className="font-medium">{p.nombre}</span>
                        </button>
                      ))
                  }
                  <button type="button" onClick={() => setShowPlantillaMenu(null)} className="w-full text-xs text-muted-foreground pt-1 border-t border-border mt-1 hover:text-foreground">
                    Cerrar
                  </button>
                </div>
              )}
            </div>

            {(c.codigo === 'email' || c.codigo === 'in_app') && (
              <div>
                <Label className="text-xs">{c.codigo === 'email' ? 'Asunto (opcional)' : 'Título / asunto (opcional)'}</Label>
                <Input
                  value={data.asuntoTemplate ?? ''}
                  onChange={e => updateCanal(c.codigo, 'asuntoTemplate', e.target.value)}
                  placeholder={c.codigo === 'email' ? 'Asunto del email...' : 'Título de la notificación...'}
                  className="text-xs"
                />
              </div>
            )}
            {tablaVarName && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30">
                <Checkbox
                  id={`tabla-${c.codigo}`}
                  checked={(data.cuerpoTemplate ?? '').includes(tablaVarName)}
                  onCheckedChange={(checked) => {
                    const current = data.cuerpoTemplate ?? '';
                    const updated = checked
                      ? current.trimEnd() + (current ? '\n\n' : '') + tablaVarName
                      : current.replace(new RegExp(`\\n*${tablaVarName.replace(/[{}]/g, '\\$&')}\\n*`, 'g'), '\n').trimEnd();
                    updateCanal(c.codigo, 'cuerpoTemplate', updated);
                  }}
                />
                <Label htmlFor={`tabla-${c.codigo}`} className="cursor-pointer text-xs">
                  Incluir tabla en este canal — inserta <code className="bg-background border border-border px-1 rounded text-[10px]">{tablaVarName}</code> al final del cuerpo
                </Label>
              </div>
            )}
            <div>
              <Label className="text-xs mb-1 block">Cuerpo</Label>
              {bodyVars && bodyVars.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1 p-2 rounded-md bg-muted/50 border border-border/60">
                  <span className="text-[10px] text-muted-foreground self-center mr-0.5 shrink-0">Variables:</span>
                  {bodyVars.map(v => (
                    <code key={v} className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] text-foreground/80">{v}</code>
                  ))}
                </div>
              )}
              <Textarea
                value={data.cuerpoTemplate}
                onChange={e => updateCanal(c.codigo, 'cuerpoTemplate', e.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder={`Plantilla para ${c.label}...`}
              />
            </div>
            {showListadoRowHtml && (
              <details className="border border-border rounded p-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground select-none">
                  {listadoRowHtmlLabel ?? 'Avanzado: fila HTML del listado'}
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1 p-1.5 rounded bg-muted/50 border border-border/60">
                    <span className="text-[10px] text-muted-foreground self-center mr-0.5 shrink-0">Vars:</span>
                    {(listadoRowHtmlVars ?? ['{{Folio}}', '{{Proveedor}}', '{{Total}}', '{{DiasEspera}}']).map(v => (
                      <code key={v} className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] text-foreground/80">{v}</code>
                    ))}
                  </div>
                  <Textarea
                    value={data.listadoRowHtml ?? ''}
                    onChange={e => updateCanal(c.codigo, 'listadoRowHtml', e.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                    placeholder={listadoRowHtmlPlaceholder ?? 'Dejar vacío para usar la fila por defecto'}
                  />
                  {listadoRowHtmlExample && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-1">
                      <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <span>💡</span> Ejemplo de fila
                      </p>
                      <pre className="text-[10px] text-foreground/70 whitespace-pre-wrap break-all font-mono leading-relaxed select-all bg-background/80 rounded p-2 border border-border/60">{listadoRowHtmlExample}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
