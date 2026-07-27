import { useEffect, useMemo, useState } from 'react';
import { Info, Loader2, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import HtmlViewer from '@/components/help/HtmlViewer';
import { EmailTemplateEditor } from '@/components/email/EmailTemplateEditor';
import { normalizarVariables } from '@/components/email/emailTemplateVariables';
import { notificarIncidenciaChecadoApi } from '../services/rh.api';
import { toApiError } from '@/utils/errors';
import { toast } from 'sonner';
import type {
  IncidenciasChecadoResumenEmpleadoResponse,
  PlantillaIncidenciaChecado,
} from '@/types/solicitudPersonal.types';

interface IncidenciasChecadoResumenNotificacionModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  empleados: IncidenciasChecadoResumenEmpleadoResponse[];
  periodo?: string;
  fechaInicio?: string;
  fechaFin?: string;
  onEnviado?: () => void;
}

const VARIABLES = [
  'Nombre',
  'Nomina',
  'Empresa',
  'Departamento',
  'Puesto',
  'FechaInicio',
  'FechaFin',
  'TotalIncidencias',
  'TablaIncidencias',
];

const ASUNTO_DEFAULT = 'Notificación de incidencias de checado';
const MENSAJE_DEFAULT = `<p>Hola {{Nombre}},</p>\n<p>Se registraron <strong>{{TotalIncidencias}}</strong> incidencias de checado en el período del <strong>{{FechaInicio}}</strong> al <strong>{{FechaFin}}</strong>.</p>\n<p>Detalle de incidencias:</p>\n{{TablaIncidencias}}\n<p>Por favor, revisa el portal de RH para atender cada una.</p>`;

const TABLA_EJEMPLO_HTML = `<table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">\n  <thead>\n    <tr style="background-color: #f5f5f5;">\n      <th style="padding: 4px 8px; border: 1px solid #ccc; text-align: left;">Fecha</th>\n      <th style="padding: 4px 8px; border: 1px solid #ccc; text-align: left;">Día</th>\n      <th style="padding: 4px 8px; border: 1px solid #ccc; text-align: left;">Entrada</th>\n      <th style="padding: 4px 8px; border: 1px solid #ccc; text-align: left;">Salida</th>\n      <th style="padding: 4px 8px; border: 1px solid #ccc; text-align: left;">Descripción</th>\n      <th style="padding: 4px 8px; border: 1px solid #ccc; text-align: left;">Justificada</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td style="padding: 4px 8px; border: 1px solid #ccc;">01/01/2024</td>\n      <td style="padding: 4px 8px; border: 1px solid #ccc;">Lunes</td>\n      <td style="padding: 4px 8px; border: 1px solid #ccc;">09:00</td>\n      <td style="padding: 4px 8px; border: 1px solid #ccc;">18:00</td>\n      <td style="padding: 4px 8px; border: 1px solid #ccc;">Retardo</td>\n      <td style="padding: 4px 8px; border: 1px solid #ccc;">No</td>\n    </tr>\n  </tbody>\n</table>`;

const VALORES_EJEMPLO: Record<string, string> = {
  '{{Nombre}}': 'Juan Pérez',
  '{{Nomina}}': '12345',
  '{{Empresa}}': 'Lefarma',
  '{{Departamento}}': 'Operaciones',
  '{{Puesto}}': 'Auxiliar',
  '{{FechaInicio}}': '01/01/2024',
  '{{FechaFin}}': '15/01/2024',
  '{{TotalIncidencias}}': '3',
  '{{TablaIncidencias}}': TABLA_EJEMPLO_HTML,
};

function aplicarVariables(plantilla: string): string {
  return Object.keys(VALORES_EJEMPLO).reduce((result, variable) => {
    const valor = VALORES_EJEMPLO[variable] ?? '';
    return result.replaceAll(variable, valor);
  }, plantilla);
}

function agruparPlantillasPorCodigo(plantillas: PlantillaIncidenciaChecado[]) {
  const map = new Map<string, PlantillaIncidenciaChecado[]>();
  plantillas.forEach((p) => {
    if (!map.has(p.codigo)) {
      map.set(p.codigo, []);
    }
    map.get(p.codigo)!.push(p);
  });
  return map;
}

function determinarCodigoDefault(plantillas: PlantillaIncidenciaChecado[]): string | null {
  if (plantillas.length === 0) return null;
  const grupos = Array.from(agruparPlantillasPorCodigo(plantillas).values());
  const gruposConEmail = grupos.filter((g) =>
    g.some((p) => p.codigoCanal.toLowerCase() === 'email')
  );
  const resumen = gruposConEmail.find((g) => g.some((p) => p.codigo === 'incidencia_resumen'));
  const defecto = gruposConEmail.find((g) => g.some((p) => p.esDefecto));
  const seleccion = resumen ?? defecto ?? gruposConEmail[0] ?? grupos[0];
  return seleccion[0]?.codigo ?? null;
}

export function IncidenciasChecadoResumenNotificacionModal({
  open,
  setOpen,
  empleados,
  periodo,
  fechaInicio,
  fechaFin,
  onEnviado,
}: IncidenciasChecadoResumenNotificacionModalProps) {
  const [plantillas, setPlantillas] = useState<PlantillaIncidenciaChecado[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [codigoSeleccionado, setCodigoSeleccionado] = useState('');
  const [asunto, setAsunto] = useState(ASUNTO_DEFAULT);
  const [mensaje, setMensaje] = useState(MENSAJE_DEFAULT);
  const [enviando, setEnviando] = useState(false);

  const gruposPorCodigo = useMemo(() => agruparPlantillasPorCodigo(plantillas), [plantillas]);

  const aplicarPlantilla = (codigo: string, lista = plantillas) => {
    const canales = lista.filter((p) => p.codigo === codigo);
    const email = canales.find((p) => p.codigoCanal.toLowerCase() === 'email');
    const plantilla = email ?? canales[0];
    if (!plantilla) return;
    setAsunto(plantilla.asunto ?? ASUNTO_DEFAULT);
    setMensaje(plantilla.cuerpo || MENSAJE_DEFAULT);
  };

  const handleSeleccionarPlantilla = (codigo: string) => {
    setCodigoSeleccionado(codigo);
    aplicarPlantilla(codigo);
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingPlantillas(true);
    notificarIncidenciaChecadoApi
      .getPlantillas()
      .then((res) => {
        if (cancelled) return;
        const data = res.data.success ? (res.data.data ?? []) : [];
        setPlantillas(data);
        const codigoDefault = determinarCodigoDefault(data);
        if (codigoDefault) {
          setCodigoSeleccionado(codigoDefault);
          aplicarPlantilla(codigoDefault, data);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('No se pudieron cargar las plantillas.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPlantillas(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mensajeNormalizado = useMemo(() => normalizarVariables(mensaje), [mensaje]);
  const asuntoPreview = useMemo(() => aplicarVariables(asunto), [asunto]);
  const mensajePreview = useMemo(() => aplicarVariables(mensajeNormalizado), [mensajeNormalizado]);

  const handleEnviar = async () => {
    if (!fechaInicio || !fechaFin) {
      toast.error('El período no tiene fechas válidas.');
      return;
    }
    if (empleados.length === 0) {
      toast.error('No hay empleados seleccionados.');
      return;
    }
    if (!asunto.trim()) {
      toast.error('El asunto es obligatorio.');
      return;
    }
    const textoMensaje = mensajeNormalizado.replace(/<[^\u003e]*>/g, '').trim();
    if (!textoMensaje) {
      toast.error('El mensaje es obligatorio.');
      return;
    }

    try {
      setEnviando(true);
      const res = await notificarIncidenciaChecadoApi.sendResumen({
        nominas: empleados.map((e) => e.nomina),
        periodo,
        fechaInicio,
        fechaFin,
        asunto: asunto.trim(),
        mensaje: mensajeNormalizado,
      });

      if (res.data.success) {
        const resultados = res.data.data?.resultados ?? [];
        const exitosos = resultados.filter((r) => r.exitoso).length;
        const fallidos = resultados.length - exitosos;
        if (fallidos > 0) {
          toast.success(`Notificaciones enviadas a ${exitosos} empleados. ${fallidos} no pudieron enviarse.`);
        } else {
          toast.success(`Notificaciones enviadas a ${exitosos} empleados.`);
        }
        onEnviado?.();
        setOpen(false);
      } else {
        toast.error(res.data.message ?? 'No se pudieron enviar las notificaciones.');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'No se pudieron enviar las notificaciones.');
    } finally {
      setEnviando(false);
    }
  };

  const totalIncidencias = useMemo(
    () => empleados.reduce((sum, e) => sum + e.totalIncidencias, 0),
    [empleados]
  );

  return (
    <Modal
      id="modal-notificar-resumen-incidencias"
      open={open}
      setOpen={setOpen}
      title="Notificar incidencias seleccionadas"
      size="wide"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleEnviar} disabled={enviando} className="gap-2">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar notificaciones
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1 text-xs">
              <p>
                Se enviará <strong>una notificación por empleado</strong> con sus incidencias del período.
              </p>
              <p>
                {empleados.length} empleados seleccionados · {totalIncidencias} incidencias totales
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Empleados seleccionados
          </Label>
          <div className="max-h-40 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Nómina</th>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Departamento</th>
                  <th className="px-3 py-2 font-medium text-right">Incidencias</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((empleado) => (
                  <tr key={empleado.nomina} className="border-t">
                    <td className="px-3 py-2">{empleado.nomina}</td>
                    <td className="px-3 py-2">{empleado.nombre}</td>
                    <td className="px-3 py-2">{empleado.empresa ?? '-'}</td>
                    <td className="px-3 py-2">{empleado.departamento ?? '-'}</td>
                    <td className="px-3 py-2 text-right">{empleado.totalIncidencias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Plantilla
              </Label>
              {loadingPlantillas ? (
                <div className="flex h-9 items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando plantillas...
                </div>
              ) : gruposPorCodigo.size === 0 ? (
                <p className="text-xs text-muted-foreground">No hay plantillas disponibles.</p>
              ) : (
                <Select value={codigoSeleccionado} onValueChange={handleSeleccionarPlantilla}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una plantilla" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(gruposPorCodigo.entries()).map(([codigo, canales]) => (
                      <SelectItem key={codigo} value={codigo}>
                        {canales[0].nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Asunto
              </Label>
              <Input
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Asunto del correo"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mensaje
              </Label>
              <EmailTemplateEditor
                key={codigoSeleccionado}
                value={mensaje}
                onChange={(content) => setMensaje(normalizarVariables(content))}
                variables={VARIABLES}
                height={320}
              />
            </div>

            <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-800 dark:text-blue-300">
                <Info className="h-4 w-4" />
                <span>¿Qué significa cada variable?</span>
              </div>
              <ul className="space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                <li><strong>Nombre</strong>: nombre completo del empleado.</li>
                <li><strong>Nomina</strong>: número de nómina del empleado.</li>
                <li><strong>Empresa</strong>: empresa a la que pertenece.</li>
                <li><strong>Departamento</strong>: departamento asignado.</li>
                <li><strong>Puesto</strong>: puesto del empleado.</li>
                <li><strong>FechaInicio</strong>: fecha inicial del período seleccionado.</li>
                <li><strong>FechaFin</strong>: fecha final del período seleccionado.</li>
                <li><strong>TotalIncidencias</strong>: cantidad total de incidencias del período.</li>
                <li><strong>TablaIncidencias</strong>: tabla con el detalle de incidencias (fecha, día, entrada, salida, descripción y justificación).</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vista previa
            </Label>
            <div className="space-y-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">
                La tabla que se muestra a continuación es de ejemplo. En el correo real se incluirán las incidencias reales de cada empleado.
              </p>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Asunto</span>
                <div className="rounded-md border border-dashed border-muted-foreground/30 bg-background p-2 text-sm">
                  {asuntoPreview}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Mensaje</span>
                <div className="max-h-[420px] overflow-auto rounded-md border border-dashed border-muted-foreground/30 bg-background p-3 text-sm">
                  <HtmlViewer contenido={mensajePreview} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
