import { useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Paperclip,
} from 'lucide-react';
import { FileUploader } from '@/components/archivos/FileUploader';
import type { Archivo } from '@/types/archivo.types';
import { archivoService } from '@/services/archivoService';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  FirmarRequest,
  AccionDisponibleResponse,
  WorkflowCampoMetadataResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';

interface SolicitudFirmaModalProps {
  open: boolean;
  onClose: () => void;
  accion: AccionDisponibleResponse | null;
  solicitud: SolicitudPersonalResponse;
  getEstadoInfo: (solicitud: Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'> | null | undefined) => { nombre: string; color: string };
  onSubmit: (request: FirmarRequest) => Promise<boolean>;
  isSubmitting: boolean;
}

interface CampoFormItem {
  campo: WorkflowCampoMetadataResponse;
  requerido: boolean;
  inputKey: string;
  validacionExito?: boolean | null;
  validacionMensaje?: string | null;
}

function getCamposParaAccion(accion: AccionDisponibleResponse | null): CampoFormItem[] {
  if (!accion) return [];
  const result: CampoFormItem[] = [];
  const seen = new Set<string>();
  const handlers = [...(accion.handlers || [])].sort((a, b) => a.ordenEjecucion - b.ordenEjecucion);
  for (const handler of handlers) {
    try {
      if ((handler.handlerKey === 'Field' || handler.handlerKey === 'Document') && handler.campo) {
        const inputKey = handler.campo.nombreTecnico;
        if (!seen.has(inputKey)) {
          seen.add(inputKey);
          result.push({
            campo: handler.campo,
            requerido: handler.requerido,
            inputKey,
          });
        }
      }
      if (handler.campo?.tipoControl === 'Alerta') {
        const inputKey = handler.campo.nombreTecnico;
        if (!seen.has(inputKey)) {
          seen.add(inputKey);
          result.push({
            campo: { ...handler.campo, tipoControl: 'Alerta' },
            requerido: false,
            inputKey,
            validacionExito: handler.validacionExito,
            validacionMensaje: handler.validacionMensaje,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }
  return result;
}

export function SolicitudFirmaModal({
  open,
  onClose,
  accion,
  solicitud,
  getEstadoInfo,
  onSubmit,
  isSubmitting,
}: SolicitudFirmaModalProps) {
  const [comentario, setComentario] = useState('');
  const [camposValues, setCamposValues] = useState<Record<string, unknown>>({});
  const [catalogos, setCatalogos] = useState<Record<string, { value: string; label: string }[]>>({});
  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  const [archivoSubidos, setArchivoSubidos] = useState<Record<string, Archivo[]>>({});
  const [adjuntosLibres, setAdjuntosLibres] = useState<Archivo[]>([]);

  const camposParaAccion = useMemo(() => getCamposParaAccion(accion), [accion]);

  const esRechazo = accion?.tipoAccionCodigo === 'RECHAZAR' || accion?.tipoAccionCodigo === 'CANCELAR';
  const esRetorno = accion?.tipoAccionCodigo === 'DEVOLVER';

  const cerrar = useCallback(() => {
    const archivosParaBorrar = Object.values(archivoSubidos).flat();
    archivosParaBorrar.forEach((a) => {
      archivoService.delete(a.id).catch(() => undefined);
    });
    setComentario('');
    setCamposValues({});
    setArchivoSubidos({});
    setAdjuntosLibres([]);
    onClose();
  }, [archivoSubidos, onClose]);

  useEffect(() => {
    if (!open || !accion) return;
    const initial: Record<string, unknown> = {};
    const sol = solicitud as unknown as Record<string, unknown>;
    const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    for (const { campo, inputKey } of camposParaAccion) {
      const existing = sol[campo.nombreTecnico] ?? sol[snakeToCamel(campo.nombreTecnico)];
      if (existing !== undefined && existing !== null) {
        initial[inputKey] = existing;
      } else if (campo.tipoControl === 'Booleano' || campo.tipoControl === 'Checkbox') {
        initial[inputKey] = false;
      }
    }
    setCamposValues(initial);
    setArchivoSubidos({});
    setAdjuntosLibres([]);

    const selectorCampos = camposParaAccion.filter(
      (c) => c.campo.tipoControl === 'Selector' && c.campo.sourceCatalog
    );
    if (selectorCampos.length > 0) {
      setLoadingCatalogos(true);
      const fetches = selectorCampos
        .filter((c) => !catalogos[c.campo.sourceCatalog!])
        .map(async ({ campo }) => {
          try {
            const res = await API.get<ApiResponse<Record<string, unknown>[]>>(campo.sourceCatalog!);
            const items = res.data.data || [];
            const LABEL_KEYS = ['nombre', 'name', 'etiqueta', 'label', 'titulo'];
            const normalized = items
              .map((item) => {
                const idKey = Object.keys(item).find(
                  (k) => /^id/i.test(k) && typeof item[k] === 'number'
                );
                const labelKey =
                  Object.keys(item).find((k) => LABEL_KEYS.includes(k.toLowerCase())) ??
                  Object.keys(item).find((k) => k.toLowerCase() === 'descripcion');
                return {
                  value: idKey ? String(item[idKey]) : '',
                  label: labelKey ? String(item[labelKey]) : '',
                };
              })
              .filter((i) => i.value && i.label);
            setCatalogos((prev) => ({ ...prev, [campo.sourceCatalog!]: normalized }));
          } catch {
            /* silent */
          }
        });
      Promise.all(fetches).finally(() => setLoadingCatalogos(false));
    }
  }, [open, accion, solicitud, camposParaAccion, catalogos]);

  const enviar = async () => {
    if (!accion) return;
    const datosAdicionales: Record<string, unknown> = {};
    for (const { campo, requerido, inputKey } of camposParaAccion) {
      if (campo.tipoControl === 'Archivo') {
        if (requerido) {
          const tiene = !!archivoSubidos[inputKey]?.length;
          if (!tiene) {
            return;
          }
        }
        continue;
      }
      if (campo.tipoControl === 'Alerta') continue;
      const val = camposValues[inputKey];
      const isEmpty = val === undefined || val === null || val === '';
      if (requerido && isEmpty) {
        return;
      }
      if (!isEmpty) datosAdicionales[inputKey] = val;
    }
    if ((esRechazo || esRetorno) && !comentario.trim()) {
      return;
    }
    if (accion.requiereAdjunto && adjuntosLibres.length === 0) {
      return;
    }
    const ok = await onSubmit({
      idAccion: accion.idAccion,
      comentario: comentario || null,
      datosAdicionales: Object.keys(datosAdicionales).length > 0 ? datosAdicionales : null,
    });
    if (ok) {
      cerrar();
    }
  };

  const estadoInfo = getEstadoInfo(solicitud);

  return (
    <Modal
      id="modal-firma-solicitud"
      open={open}
      setOpen={(o) => { if (!o) cerrar(); }}
      title={accion ? `${accion.tipoAccionNombre} solicitud` : 'Procesar acción'}
      size="lg"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={cerrar} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={isSubmitting} variant={esRechazo ? 'destructive' : 'default'}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar {accion?.tipoAccionNombre?.toLowerCase() ?? 'acción'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-sm font-semibold">{solicitud.folio}</p>
          <p className="text-xs text-muted-foreground">
            Estado actual: {estadoInfo.nombre}
            {accion ? ` · Acción: ${accion.tipoAccionNombre}` : ''}
          </p>
          {(esRechazo || esRetorno) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Esta acción impacta el flujo y requiere justificación.
            </p>
          )}
        </div>

        {camposParaAccion.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              Información requerida
              {loadingCatalogos && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </h4>

            {camposParaAccion.some((c) => c.validacionMensaje) && (
              <div className="space-y-1.5">
                {camposParaAccion
                  .filter((c) => c.validacionMensaje)
                  .map(({ campo, validacionExito, validacionMensaje }) => (
                    <div
                      key={campo.nombreTecnico}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        validacionExito === false
                          ? 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-400'
                          : 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-semibold">{campo.etiquetaUsuario}</p>
                          <p className="mt-0.5 text-xs opacity-90">{validacionMensaje}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {camposParaAccion
              .filter((c) => c.campo.tipoControl !== 'Alerta')
              .map(({ campo, requerido, inputKey }) => {
                const fieldId = `campo-${inputKey}`;
                const value = camposValues[inputKey];
                if (campo.tipoControl === 'Booleano' || campo.tipoControl === 'Checkbox') {
                  return (
                    <div key={inputKey} className="flex items-center gap-2">
                      <Checkbox
                        id={fieldId}
                        checked={Boolean(value)}
                        onCheckedChange={(v) =>
                          setCamposValues((prev) => ({ ...prev, [inputKey]: Boolean(v) }))
                        }
                      />
                      <Label htmlFor={fieldId}>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                    </div>
                  );
                }
                if (campo.tipoControl === 'Selector' && campo.sourceCatalog) {
                  const options = catalogos[campo.sourceCatalog] || [];
                  return (
                    <div key={inputKey} className="space-y-1.5">
                      <Label htmlFor={fieldId}>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                      <Select
                        value={value != null ? String(value) : ''}
                        onValueChange={(v) => setCamposValues((prev) => ({ ...prev, [inputKey]: v }))}
                        disabled={loadingCatalogos}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingCatalogos ? 'Cargando...' : 'Seleccionar'} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                if (campo.tipoControl === 'Numero') {
                  return (
                    <div key={inputKey} className="space-y-1.5">
                      <Label htmlFor={fieldId}>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                      <Input
                        id={fieldId}
                        type="number"
                        value={String(value ?? '')}
                        onChange={(e) =>
                          setCamposValues((prev) => ({
                            ...prev,
                            [inputKey]: e.target.value === '' ? '' : Number(e.target.value.replace(',', '.')),
                          }))
                        }
                      />
                    </div>
                  );
                }
                if (campo.tipoControl === 'Fecha') {
                  return (
                    <div key={inputKey} className="space-y-1.5">
                      <Label htmlFor={fieldId}>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                      <Input
                        id={fieldId}
                        type="date"
                        value={String(value ?? '')}
                        onChange={(e) => setCamposValues((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                      />
                    </div>
                  );
                }
                if (campo.tipoControl === 'Archivo') {
                  return (
                    <div key={inputKey} className="space-y-1.5">
                      <Label>
                        {campo.etiquetaUsuario}
                        {requerido && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                      <FileUploader
                        inline
                        open
                        multiple
                        cantidadMaxima={3}
                        entidadTipo="SolicitudPersonal"
                        entidadId={solicitud.idSolicitud}
                        carpeta="solicitudes-personal"
                        metadata={{
                          modulo: 'solicitudes_personal',
                          origen: 'workflow',
                          tipo: inputKey,
                          paso: solicitud.idPasoActual ?? undefined,
                          nombreAccion: accion?.tipoAccionNombre ?? undefined,
                        }}
                        onUploadComplete={(nuevos) => {
                          if (nuevos.length > 0) {
                            setArchivoSubidos((prev) => ({
                              ...prev,
                              [inputKey]: [...(prev[inputKey] ?? []), ...nuevos],
                            }));
                          }
                        }}
                        onClose={() => undefined}
                      />
                    </div>
                  );
                }
                return (
                  <div key={inputKey} className="space-y-1.5">
                    <Label htmlFor={fieldId}>
                      {campo.etiquetaUsuario}
                      {requerido && <span className="ml-1 text-red-500">*</span>}
                    </Label>
                    <Input
                      id={fieldId}
                      value={String(value ?? '')}
                      onChange={(e) => setCamposValues((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                    />
                  </div>
                );
              })}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="comentario-firma">
              Comentario
              {(esRechazo || esRetorno || accion?.requiereComentario) && (
                <span className="ml-1 text-red-500">*</span>
              )}
            </Label>
            {!esRechazo && !esRetorno && !accion?.requiereComentario && (
              <span className="text-xs text-muted-foreground">Opcional</span>
            )}
          </div>
          <Textarea
            id="comentario-firma"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={
              esRechazo
                ? 'Explica el motivo del rechazo'
                : esRetorno
                  ? 'Explica el motivo de la devolución'
                  : 'Escribe un comentario'
            }
            rows={4}
          />
        </div>

        {accion?.permiteAdjunto && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Documentos adjuntos
                {accion.requiereAdjunto && <span className="ml-1 text-red-500">*</span>}
                {adjuntosLibres.length > 0 && (
                  <span className="ml-1.5 font-normal text-muted-foreground">({adjuntosLibres.length}/5)</span>
                )}
              </Label>
              {!accion.requiereAdjunto && <span className="text-xs text-muted-foreground">Opcional</span>}
            </div>
            {adjuntosLibres.length > 0 && (
              <div className="space-y-1.5">
                {adjuntosLibres.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    <span className="flex-1 truncate text-green-800">{a.nombreOriginal}</span>
                  </div>
                ))}
              </div>
            )}
            {adjuntosLibres.length < 5 && (
              <FileUploader
                inline
                open
                multiple
                cantidadMaxima={5 - adjuntosLibres.length}
                entidadTipo="SolicitudPersonal"
                entidadId={solicitud.idSolicitud}
                carpeta="solicitudes-personal"
                metadata={{
                  modulo: 'solicitudes_personal',
                  origen: 'workflow',
                  tipo: 'adjunto_libre',
                  paso: solicitud.idPasoActual ?? undefined,
                  nombreAccion: accion.tipoAccionNombre ?? undefined,
                  observaciones: comentario || undefined,
                }}
                tiposPermitidos={['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']}
                descripcion="Arrastra o selecciona documentos de soporte"
                onUploadComplete={(nuevos) => {
                  if (nuevos.length > 0) {
                    setAdjuntosLibres((prev) => [...prev, ...nuevos].slice(0, 5));
                  }
                }}
                onClose={() => undefined}
              />
            )}
            {adjuntosLibres.length >= 5 && (
              <p className="text-xs text-amber-600">Límite de 5 documentos alcanzado.</p>
            )}
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Paperclip className="h-3 w-3" /> Los archivos quedan asociados a la solicitud
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}