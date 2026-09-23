import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SignatureAlert } from '@/components/common/SignatureAlert';
import { FileUploader } from '@/components/archivos/FileUploader';
import { archivoService } from '@/services/archivoService';
import type { Archivo, ArchivoListItem } from '@/types/archivo.types';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import { AlertCircle, CheckCircle2, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import type { AccionWorkflow, WorkflowCampoMetadata } from './workflowAccion';

interface CampoFormItem {
  campo: WorkflowCampoMetadata;
  requerido: boolean;
  inputKey: string;
  handlerKey: string;
  requiereRevision: boolean;
  validacionExito?: boolean | null;
  validacionMensaje?: string | null;
}

function parseRequiereRevision(configuracionJson?: string | null): boolean {
  if (!configuracionJson) return false;
  try {
    const cfg = JSON.parse(configuracionJson) as { requiereRevision?: boolean } | null;
    return cfg?.requiereRevision === true;
  } catch {
    return false;
  }
}

function metadataTieneRevision(metadata: unknown, clavePaso: string): boolean {
  if (!metadata || !clavePaso) return false;
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    const revisiones = (parsed as { revisiones?: Record<string, { revisado?: boolean }> } | null)
      ?.revisiones;
    return revisiones?.[clavePaso]?.revisado === true;
  } catch {
    return false;
  }
}

/**
 * Campos a capturar según los handlers Field/Document de la acción, más las
 * Alertas pre-evaluadas por el backend (mismo criterio que SolicitudFirmaModal de RH).
 */
function parseMetadataTipo(metadata: unknown): string | null {
  if (!metadata) return null;
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    if (parsed && typeof parsed === 'object' && 'tipo' in parsed) {
      return String((parsed as Record<string, unknown>).tipo);
    }
  } catch {
    return null;
  }
  return null;
}

function getCamposParaAccion(accion: AccionWorkflow | null): CampoFormItem[] {
  if (!accion) return [];
  const result: CampoFormItem[] = [];
  const seen = new Set<string>();
  const handlers = [...(accion.handlers ?? [])].sort((a, b) => a.ordenEjecucion - b.ordenEjecucion);
  for (const handler of handlers) {
    try {
      if (
        (handler.handlerKey === 'Field' ||
          handler.handlerKey === 'Document' ||
          handler.handlerKey === 'Archivo') &&
        handler.campo
      ) {
        const inputKey = handler.campo.nombreTecnico;
        if (!seen.has(inputKey)) {
          seen.add(inputKey);
          result.push({
            campo: handler.campo,
            requerido: handler.requerido,
            inputKey,
            handlerKey: handler.handlerKey,
            requiereRevision:
              handler.handlerKey === 'Archivo' && parseRequiereRevision(handler.configuracionJson),
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
            handlerKey: handler.handlerKey,
            requiereRevision: false,
            validacionExito: handler.validacionExito,
            validacionMensaje: handler.validacionMensaje,
          });
        }
      }
    } catch {
      /* handler mal configurado: no bloquea el modal */
    }
  }
  return result;
}

interface WorkflowAccionModalProps {
  open: boolean;
  onClose: () => void;
  accion: AccionWorkflow | null;
  /** Referencia del documento para el usuario, p. ej. "Selección mensual 09/2026" o "Rutas v2". */
  tituloEntidad?: string | null;
  hasFirma?: boolean;
  guardando?: boolean;
  /**
   * Contexto de adjuntos. Necesarios solo si la acción permite/requiere adjuntos
   * o tiene campos tipo Archivo; sin ellos esas secciones no se muestran.
   */
  entidadTipo?: string;
  entidadId?: number;
  carpetaAdjuntos?: string;
  idPasoActual?: number | null;
  /** Valores actuales de la entidad para prellenar campos dinámicos (opcional). */
  entidadValores?: Record<string, unknown> | null;
  onConfirmar: (
    comentario: string | undefined,
    datosAdicionales: Record<string, unknown> | null
  ) => void | Promise<void>;
}

/**
 * Modal compartido para ejecutar una acción del workflow (firmar, devolver, cancelar).
 * Formulario dinámico: si la acción configura handlers (campos), requiere_comentario
 * o permite/requiere_adjunto en el paso, el modal los renderiza; sin configuración
 * se comporta como "comentario + confirmar".
 * Los adjuntos quedan ligados al documento (entidadTipo/entidadId); al cancelar se
 * eliminan los subidos en esta sesión para no dejar huérfanos.
 */
export function WorkflowAccionModal({
  open,
  onClose,
  accion,
  tituloEntidad,
  hasFirma = true,
  guardando = false,
  entidadTipo,
  entidadId,
  carpetaAdjuntos = 'educacion-medica',
  idPasoActual,
  entidadValores,
  onConfirmar,
}: WorkflowAccionModalProps) {
  const [comentario, setComentario] = useState('');
  const [camposValues, setCamposValues] = useState<Record<string, unknown>>({});
  const [catalogos, setCatalogos] = useState<Record<string, { value: string; label: string }[]>>(
    {}
  );
  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  const [archivoSubidos, setArchivoSubidos] = useState<Record<string, Archivo[]>>({});
  const [adjuntosLibres, setAdjuntosLibres] = useState<Archivo[]>([]);
  const [archivosExistentes, setArchivosExistentes] = useState<ArchivoListItem[]>([]);
  const [revisiones, setRevisiones] = useState<Record<string, boolean>>({});

  const camposParaAccion = useMemo(() => getCamposParaAccion(accion), [accion]);

  const existentesPorTipo = useMemo(() => {
    const map: Record<string, ArchivoListItem[]> = {};
    for (const a of archivosExistentes) {
      const tipo = parseMetadataTipo(a.metadata);
      if (!tipo) continue;
      if (!map[tipo]) map[tipo] = [];
      map[tipo].push(a);
    }
    return map;
  }, [archivosExistentes]);

  const clavePasoActual = String(idPasoActual ?? '');
  const estaRevisado = (inputKey: string) =>
    (existentesPorTipo[inputKey] ?? []).some((a) =>
      metadataTieneRevision(a.metadata, clavePasoActual)
    );

  useEffect(() => {
    if (!open || !entidadTipo || entidadId === undefined) return;
    let cancelado = false;
    archivoService
      .getAll({ entidadTipo, entidadId, soloActivos: true })
      .then((lista) => {
        if (!cancelado) setArchivosExistentes(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (!cancelado) setArchivosExistentes([]);
      });
    return () => {
      cancelado = true;
    };
  }, [open, entidadTipo, entidadId]);

  const esDevolucion = accion?.tipoAccionCodigo === 'DEVOLVER';
  const esRechazo =
    accion?.tipoAccionCodigo === 'RECHAZAR' || accion?.tipoAccionCodigo === 'CANCELAR';
  const comentarioObligatorio = esDevolucion || esRechazo || accion?.requiereComentario === true;
  const adjuntosDisponibles =
    accion?.permiteAdjunto === true && entidadTipo !== undefined && entidadId !== undefined;

  // Reinicio del formulario en cada apertura: ajuste de estado durante el render
  // (patrón React recomendado) en lugar de un efecto que resetea.
  const aperturaKey = `${open}-${accion?.idAccion ?? 'none'}`;
  const [aperturaAnterior, setAperturaAnterior] = useState('');
  if (aperturaKey !== aperturaAnterior) {
    setAperturaAnterior(aperturaKey);
    setComentario('');
    setArchivoSubidos({});
    setAdjuntosLibres([]);
    setArchivosExistentes([]);
    setRevisiones({});

    const initial: Record<string, unknown> = {};
    const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    for (const { campo, inputKey } of camposParaAccion) {
      const existing =
        entidadValores?.[campo.nombreTecnico] ?? entidadValores?.[snakeToCamel(campo.nombreTecnico)];
      if (existing !== undefined && existing !== null) {
        initial[inputKey] = existing;
      } else if (campo.tipoControl === 'Booleano' || campo.tipoControl === 'Checkbox') {
        initial[inputKey] = false;
      }
    }
    setCamposValues(initial);
    setLoadingCatalogos(
      camposParaAccion.some(
        (c) => c.campo.tipoControl === 'Selector' && c.campo.sourceCatalog && !catalogos[c.campo.sourceCatalog]
      )
    );
  }

  // Precarga de catálogos de campos Selector (solo los que falten en caché).
  useEffect(() => {
    if (!open) return;
    const selectorCampos = camposParaAccion.filter(
      (c) =>
        c.campo.tipoControl === 'Selector' &&
        c.campo.sourceCatalog &&
        !catalogos[c.campo.sourceCatalog]
    );
    if (selectorCampos.length === 0) return;

    const fetches = selectorCampos.map(async ({ campo }) => {
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
        /* catálogo no disponible: el selector queda vacío */
      }
    });
    void Promise.all(fetches).finally(() => setLoadingCatalogos(false));
  }, [open, camposParaAccion, catalogos]);

  const cerrar = (eliminarSubidos: boolean) => {
    if (eliminarSubidos) {
      [...Object.values(archivoSubidos).flat(), ...adjuntosLibres].forEach((a) => {
        archivoService.delete(a.id).catch(() => undefined);
      });
    }
    onClose();
  };

  const handleConfirmar = () => {
    if (!accion) return;

    const errores: string[] = [];
    const datosAdicionales: Record<string, unknown> = {};
    for (const { campo, requerido, inputKey, handlerKey, requiereRevision } of camposParaAccion) {
      if (campo.tipoControl === 'Archivo') {
        const revisadoAntes = estaRevisado(inputKey);
        if (requerido) {
          const tieneNuevos = !!archivoSubidos[inputKey]?.length;
          const tieneExistentes =
            handlerKey === 'Archivo' && (existentesPorTipo[inputKey]?.length ?? 0) > 0;
          if (!tieneNuevos && !tieneExistentes) {
            errores.push(`Falta adjuntar: ${campo.etiquetaUsuario}`);
          }
        }
        if (requiereRevision && !revisadoAntes) {
          if (!revisiones[inputKey]) {
            errores.push(`Falta marcar como revisado: ${campo.etiquetaUsuario}`);
          } else {
            datosAdicionales[`revision_${inputKey}`] = true;
          }
        }
        continue;
      }
      if (campo.tipoControl === 'Alerta') continue;
      const val = camposValues[inputKey];
      const isEmpty = val === undefined || val === null || val === '';
      if (requerido && isEmpty) {
        errores.push(`Falta completar: ${campo.etiquetaUsuario}`);
      }
      if (!isEmpty) datosAdicionales[inputKey] = val;
    }

    if (comentarioObligatorio && comentario.trim().length < 5) {
      errores.push('El comentario es obligatorio para esta acción (mínimo 5 caracteres)');
    }

    if (
      accion.requiereAdjunto === true &&
      !esRechazo &&
      !esDevolucion &&
      adjuntosLibres.length === 0 &&
      archivosExistentes.length === 0
    ) {
      errores.push('Debes adjuntar al menos un documento de soporte');
    }

    if (errores.length > 0) {
      toast.error('Campos incompletos', { description: errores.join(' · '), duration: 8000 });
      return;
    }

    void onConfirmar(
      comentario.trim() || undefined,
      Object.keys(datosAdicionales).length > 0 ? datosAdicionales : null
    );
  };

  return (
    <Modal
      id="modal-accion-workflow"
      open={open}
      setOpen={(value) => {
        if (!value) cerrar(true);
      }}
      title={
        esDevolucion || esRechazo
          ? `${accion?.tipoAccionNombre ?? 'Devolver documento'}`
          : (accion?.tipoAccionNombre ?? 'Ejecutar acción')
      }
      subtitle={accion?.tipoAccionDescripcion || undefined}
      size="lg"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => cerrar(true)} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={guardando || hasFirma === false}
            variant={esRechazo ? 'destructive' : 'default'}
          >
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {esDevolucion ? 'Devolver' : `Confirmar ${accion?.tipoAccionNombre?.toLowerCase() ?? ''}`.trim()}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {hasFirma === false && <SignatureAlert />}
        {tituloEntidad && (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tituloEntidad}
          </p>
        )}
        {(esDevolucion || esRechazo) && (
          <p className="text-sm text-muted-foreground">
            Esta acción regresa el documento en el flujo y requiere justificación.
          </p>
        )}

        {camposParaAccion.length > 0 && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              Información requerida
              {loadingCatalogos && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
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
              .map(({ campo, requerido, inputKey, handlerKey, requiereRevision }) => {
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
                        onValueChange={(v) =>
                          setCamposValues((prev) => ({ ...prev, [inputKey]: v }))
                        }
                        disabled={loadingCatalogos}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={loadingCatalogos ? 'Cargando...' : 'Seleccionar'}
                          />
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
                            [inputKey]:
                              e.target.value === '' ? '' : Number(e.target.value.replace(',', '.')),
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
                        onChange={(e) =>
                          setCamposValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
                        }
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
                      {adjuntosDisponibles ? (
                        <FileUploader
                          inline
                          open
                          multiple
                          cantidadMaxima={3}
                          entidadTipo={entidadTipo!}
                          entidadId={entidadId!}
                          carpeta={carpetaAdjuntos}
                          metadata={{
                            modulo: 'educacion_medica',
                            origen: 'workflow',
                            tipo: inputKey,
                            paso: idPasoActual ?? undefined,
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
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          El documento no admite adjuntos desde este modal.
                        </p>
                      )}
                      {handlerKey === 'Archivo' &&
                        (existentesPorTipo[inputKey]?.length ?? 0) > 0 && (
                          <div className="space-y-1">
                            {existentesPorTipo[inputKey].map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                <span className="flex-1 truncate text-green-800">
                                  Ya adjunto: {a.nombreOriginal}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      {requiereRevision && (
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={estaRevisado(inputKey) || !!revisiones[inputKey]}
                            disabled={estaRevisado(inputKey)}
                            onCheckedChange={(v) =>
                              setRevisiones((prev) => ({ ...prev, [inputKey]: Boolean(v) }))
                            }
                          />
                          <span>
                            Revisado
                            {estaRevisado(inputKey) && ' (registrado)'}
                          </span>
                        </label>
                      )}
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
                      onChange={(e) =>
                        setCamposValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
                      }
                    />
                  </div>
                );
              })}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="comentario-accion-workflow">
              Comentario
              {comentarioObligatorio && <span className="ml-1 text-red-500">*</span>}
            </Label>
            {!comentarioObligatorio && (
              <span className="text-xs text-muted-foreground">Opcional</span>
            )}
          </div>
          <Textarea
            id="comentario-accion-workflow"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={
              esDevolucion
                ? 'Explica el motivo de la devolución'
                : esRechazo
                  ? 'Explica el motivo'
                  : 'Escribe un comentario'
            }
            rows={3}
          />
        </div>

        {adjuntosDisponibles && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Documentos adjuntos
                {accion?.requiereAdjunto === true && <span className="ml-1 text-red-500">*</span>}
                {adjuntosLibres.length > 0 && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ({adjuntosLibres.length}/5)
                  </span>
                )}
              </Label>
              {accion?.requiereAdjunto !== true && (
                <span className="text-xs text-muted-foreground">Opcional</span>
              )}
            </div>
            {accion?.requiereAdjunto === true && archivosExistentes.length > 0 && (
              <div className="space-y-1.5">
                {archivosExistentes.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-muted-foreground">{a.nombreOriginal}</span>
                  </div>
                ))}
              </div>
            )}
            {adjuntosLibres.length > 0 && (
              <div className="space-y-1.5">
                {adjuntosLibres.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm"
                  >
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
                entidadTipo={entidadTipo!}
                entidadId={entidadId!}
                carpeta={carpetaAdjuntos}
                metadata={{
                  modulo: 'educacion_medica',
                  origen: 'workflow',
                  tipo: 'adjunto_libre',
                  paso: idPasoActual ?? undefined,
                  nombreAccion: accion?.tipoAccionNombre ?? undefined,
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
              <Paperclip className="h-3 w-3" /> Los archivos quedan asociados al documento
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
