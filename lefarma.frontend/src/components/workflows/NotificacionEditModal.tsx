import { useState, useEffect } from 'react';
import { Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { API } from '@/services/api';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { PlantillasEditModal } from './PlantillasEditModal';
import type { Workflow, WorkflowPaso } from '@/types/workflow.types';

interface WorkflowWithDetails extends Workflow {
  pasos: WorkflowPaso[];
}

interface NotificacionEditModalProps {
  workflow: WorkflowWithDetails;
  notificacion: any | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSave: () => Promise<void>;
}

export function NotificacionEditModal({ workflow, notificacion, open, setOpen, onSave }: NotificacionEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [tiposNotificacion, setTiposNotificacion] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    idAccion: 0,
    idPasoDestino: 0,
    idTipoNotificacion: 0,
    enviarEmail: true,
    enviarWhatsapp: false,
    enviarTelegram: false,
    avisarAlCreador: true,
    avisarAlSiguiente: true,
    avisarAlAnterior: false,
    avisarAAutorizadoresPrevios: false,
    incluirPartidas: false,
    activo: true,
    canales: [] as any[]
  });

  // Cargar tipos de notificación la primera vez
  useEffect(() => {
    API.get<any>('/config/workflows/tipos-notificacion')
      .then(res => setTiposNotificacion(res.data?.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (notificacion) {
      // Cargar canales de la notificación
      const canales = notificacion.canales ?? [];
      setFormData({
        ...notificacion,
        idPasoDestino: notificacion.idPasoDestino || 0,
        idTipoNotificacion: notificacion.idTipoNotificacion || 0,
        activo: notificacion.activo ?? true,
        canales
      });
    } else {
      // Encontrar la primera acción disponible
      const primeraAccion = workflow.pasos.flatMap((p: WorkflowPaso) => p.acciones || [])[0];
      setFormData({
        idAccion: primeraAccion?.idAccion || 0,
        idPasoDestino: 0,
        idTipoNotificacion: 0,
        enviarEmail: true,
        enviarWhatsapp: false,
        enviarTelegram: false,
        avisarAlCreador: true,
        avisarAlSiguiente: true,
        avisarAlAnterior: false,
        avisarAAutorizadoresPrevios: false,
        incluirPartidas: false,
        activo: true,
        canales: [] as any[]
      });
    }
  }, [notificacion, workflow.pasos, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        idPasoDestino: formData.idPasoDestino || null,
        idTipoNotificacion: formData.idTipoNotificacion || null,
        enviarEmail: formData.enviarEmail,
        enviarWhatsapp: formData.enviarWhatsapp,
        enviarTelegram: formData.enviarTelegram,
        avisarAlCreador: formData.avisarAlCreador,
        avisarAlSiguiente: formData.avisarAlSiguiente,
        avisarAlAnterior: formData.avisarAlAnterior,
        avisarAAutorizadoresPrevios: formData.avisarAAutorizadoresPrevios,
        incluirPartidas: formData.incluirPartidas,
        activo: formData.activo,
        canales: formData.canales ?? []
      };
      if (notificacion) {
        await API.put(`/config/workflows/${workflow.idWorkflow}/acciones/${formData.idAccion}/notificaciones/${notificacion.idNotificacion}`, payload);
      } else {
        await API.post(`/config/workflows/${workflow.idWorkflow}/acciones/${formData.idAccion}/notificaciones`, payload);
      }
      await onSave();
      toast.success(notificacion ? 'Notificación actualizada' : 'Notificación creada');
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.errors?.[0]?.description ?? err.message ?? 'Error al guardar la notificación');
    } finally {
      setIsSaving(false);
    }
  };

  const todasLasAcciones = workflow.pasos.flatMap((p: WorkflowPaso) => {
    const paso = p;
    return (p.acciones || []).map((a: any) => ({ ...a, paso }));
  });

  return (
    <Modal
      id="modal-notificacion"
      open={open}
      setOpen={setOpen}
      title={notificacion ? 'Editar Notificación' : 'Nueva Notificación'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} onClick={handleSubmit} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {notificacion ? 'Actualizar' : 'Crear'} Notificación
          </Button>

        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Acción asociada */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Acción que Dispara la Notificación *
          </Label>
          <Select
            value={formData.idAccion.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idAccion: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una acción" />
            </SelectTrigger>
            <SelectContent>
              {todasLasAcciones.map(({ idAccion, tipoAccionNombre, tipoAccionCodigo, paso }) => (
                <SelectItem key={idAccion} value={idAccion.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{paso.nombrePaso}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{tipoAccionNombre}</span>
                    <Badge variant="outline" className="text-xs">
                      {tipoAccionCodigo}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            La notificación se enviará cuando se ejecute esta acción
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paso destino (opcional)
          </Label>
          <Select
            value={formData.idPasoDestino.toString()}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idPasoDestino: parseInt(value, 10) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un paso destino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Genérica (cualquier destino)</SelectItem>
              {workflow.pasos.map((paso: WorkflowPaso) => (
                <SelectItem key={paso.idPaso} value={paso.idPaso.toString()}>
                  [{paso.orden}] {paso.nombrePaso}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de Notificación */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de Notificación
          </Label>
          <Select
            value={formData.idTipoNotificacion?.toString() || '0'}
            onValueChange={(value) => setFormData(prev => ({ ...prev, idTipoNotificacion: parseInt(value, 10) }))}
          >
            <SelectTrigger>
              <SelectValue>
                {formData.idTipoNotificacion && formData.idTipoNotificacion > 0 ? (
                  (() => {
                    const tipo = tiposNotificacion.find((t: any) => t.idTipo === formData.idTipoNotificacion);
                    return tipo ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tipo.colorTema }}
                        />
                        <span>{tipo.icono} {tipo.nombre}</span>
                      </span>
                    ) : 'Sin tipo';
                  })()
                ) : (
                  <span className="text-muted-foreground">Sin tipo asignado</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">
                <span className="text-muted-foreground">Sin tipo asignado</span>
              </SelectItem>
              {tiposNotificacion.map((tipo: any) => (
                <SelectItem key={tipo.idTipo} value={tipo.idTipo.toString()}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tipo.colorTema }}
                    />
                    <span>{tipo.icono} {tipo.nombre}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Determina el color del encabezado y acento en el email
          </p>
        </div>

        {/* Canales */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Canales de Notificación
          </Label>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox
                id="enviarEmail"
                checked={formData.enviarEmail}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviarEmail: !!checked }))}
              />
              <div className="flex-1">
                <Label htmlFor="enviarEmail" className="cursor-pointer font-medium">
                  📧 Email
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox
                id="enviarWhatsapp"
                checked={formData.enviarWhatsapp}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviarWhatsapp: !!checked }))}
              />
              <div className="flex-1">
                <Label htmlFor="enviarWhatsapp" className="cursor-pointer font-medium">
                  💬 WhatsApp
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
              <Checkbox
                id="enviarTelegram"
                checked={formData.enviarTelegram}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enviarTelegram: !!checked }))}
              />
              <div className="flex-1">
                <Label htmlFor="enviarTelegram" className="cursor-pointer font-medium">
                  ✈️ Telegram
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Destinatarios */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Destinatarios
          </Label>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
              <Checkbox
                id="avisarAlCreador"
                checked={formData.avisarAlCreador}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avisarAlCreador: !!checked }))}
              />
              <Label htmlFor="avisarAlCreador" className="cursor-pointer text-xs">
                Creador
              </Label>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
              <Checkbox
                id="avisarAlSiguiente"
                checked={formData.avisarAlSiguiente}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avisarAlSiguiente: !!checked }))}
              />
              <Label htmlFor="avisarAlSiguiente" className="cursor-pointer text-xs">
                Siguiente
              </Label>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border">
              <Checkbox
                id="avisarAlAnterior"
                checked={formData.avisarAlAnterior}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avisarAlAnterior: !!checked }))}
              />
              <Label htmlFor="avisarAlAnterior" className="cursor-pointer text-xs">
                Anterior
              </Label>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-md bg-card border border-border col-span-3">
              <Checkbox
                id="avisarAAutorizadoresPrevios"
                checked={formData.avisarAAutorizadoresPrevios}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, avisarAAutorizadoresPrevios: !!checked }))}
              />
              <Label htmlFor="avisarAAutorizadoresPrevios" className="cursor-pointer text-xs">
                Autorizadores previos
              </Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Creador: quien inició la orden • Siguiente: quien recibirá la orden • Anterior: quien tenía la orden • Autorizadores previos: todos los que autorizaron pasos anteriores de esta orden
          </p>
        </div>

        {/* Templates por canal */}
        <PlantillasEditModal
          canales={formData.canales ?? []}
          enviarEmail={formData.enviarEmail}
          enviarWhatsapp={formData.enviarWhatsapp}
          enviarTelegram={formData.enviarTelegram}
          tipoNotificacion={tiposNotificacion.find((t: any) => t.idTipoNotificacion === formData.idTipoNotificacion)?.codigoTipo}
          bodyVars={['{{Folio}}', '{{Total}}', '{{Proveedor}}', '{{Comentario}}', '{{Accion}}', '{{NombreAnterior}}', '{{NombreSiguiente}}', '{{Solicitante}}', '{{Partidas}}']}
          tablaVarName={formData.incluirPartidas ? '{{Partidas}}' : undefined}
          showListadoRowHtml={!!formData.incluirPartidas}
          listadoRowHtmlLabel="Avanzado: fila HTML de partidas"
          listadoRowHtmlVars={['{{NumeroPartida}}', '{{Descripcion}}', '{{Cantidad}}', '{{PrecioUnitario}}', '{{Total}}']}
          listadoRowHtmlPlaceholder="Dejar vacío para usar la tabla por defecto"
          listadoRowHtmlExample={`<tr>\n  <td>{{NumeroPartida}}</td>\n  <td>{{Descripcion}}</td>\n  <td style="text-align:right">{{Cantidad}}</td>\n  <td style="text-align:right">{{PrecioUnitario}}</td>\n  <td style="text-align:right;font-weight:600">{{Total}}</td>\n</tr>`}
          onChange={(canales) => setFormData((prev: any) => ({ ...prev, canales }))}
        />

        {/* Opciones adicionales */}
        <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            <div className="flex items-center gap-2">
              <Checkbox
                id="incluirPartidas"
                checked={formData.incluirPartidas}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, incluirPartidas: !!checked }))}
              />
              <Label htmlFor="incluirPartidas" className="cursor-pointer text-xs font-medium">
                Incluir tabla de partidas de la orden en la notificación — activa <code className="bg-blue-500/10 px-1 rounded">{'{{Partidas}}'}</code> y la sección de fila HTML
              </Label>
            </div>
          </div>
        </div>

        {/* Activo */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="notificacion-activa"
            checked={formData.activo}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, activo: !!checked }))}
          />
          <div className="space-y-0.5">
            <Label htmlFor="notificacion-activa" className="text-sm font-medium cursor-pointer">
              Notificación activa
            </Label>
            <p className="text-xs text-muted-foreground">
              Si está inactiva, no se enviará al ejecutar la acción
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}
