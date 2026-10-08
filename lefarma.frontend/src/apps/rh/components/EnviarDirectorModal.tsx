import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Eye, Loader2, Paperclip, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '@/shared/api/apiClient';
import { archivoService } from '@/services/archivoService';
import { FileViewer } from '@/components/archivos/FileViewer';
import { cn } from '@/lib/utils';
import type { ArchivoListItem } from '@/types/archivo.types';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import type {
  AccionDisponibleResponse,
  FirmarRequest,
  HistorialWorkflowItemResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import { SolicitudPersonalPDF } from './PDF/SolicitudPersonalPDF';
import { generarPdfSolicitud } from './PDF/generarPdfSolicitud';
import { getCategoriaNombre } from '@/types/solicitudPersonal.types';

/** Comentario inicial del envío al director: menciona el tipo y quién solicita (editable). */
function comentarioDefault(solicitud: SolicitudPersonalResponse): string {
  const tipo = solicitud.tipoSolicitudNombre || getCategoriaNombre(solicitud.categoria);
  const solicitante = solicitud.solicitanteNombre ?? '—';
  return `${tipo}. Solicitante: ${solicitante}. Se envía para autorización de Dirección Corporativa.`;
}

interface EnviarDirectorModalProps {
  open: boolean;
  onClose: () => void;
  accion: AccionDisponibleResponse | null;
  solicitud: SolicitudPersonalResponse;
  historial?: HistorialWorkflowItemResponse[];
  pasosWorkflow?: WorkflowPasoFlowResponse[];
  onSubmit?: (
    request: FirmarRequest,
    pdfBlob: Blob,
    archivoSoporte?: File | null
  ) => Promise<boolean>;
  isSubmitting: boolean;
}

function esPdf(a: ArchivoListItem): boolean {
  return a.tipoMime === 'application/pdf' || a.extension?.toLowerCase() === '.pdf';
}

export function EnviarDirectorModal({
  open,
  onClose,
  accion,
  solicitud,
  historial = [],
  pasosWorkflow = [],
  onSubmit,
  isSubmitting,
}: EnviarDirectorModalProps) {
  const [comentario, setComentario] = useState(() => comentarioDefault(solicitud));
  const [archivoSoporte, setArchivoSoporte] = useState<File | null>(null);
  const [archivosPdf, setArchivosPdf] = useState<ArchivoListItem[]>([]);
  const [idArchivoSeleccionado, setIdArchivoSeleccionado] = useState<number | null>(null);
  const [cargandoArchivos, setCargandoArchivos] = useState(true);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [verSoporte, setVerSoporte] = useState(false);
  const soporteInputRef = useRef<HTMLInputElement>(null);

  const archivoExistente = useMemo(
    () => archivosPdf.find((a) => a.id === idArchivoSeleccionado) ?? null,
    [archivosPdf, idArchivoSeleccionado]
  );

  const haySoporte = !!(archivoSoporte || archivoExistente);

  // El modal se monta al abrir la acción (estado inicial limpio).
  // Carga los PDFs ya adjuntos a la solicitud, candidatos a documento soporte.
  useEffect(() => {
    if (!solicitud?.idSolicitud) return;
    let cancelado = false;
    archivoService
      .getAll({
        entidadTipo: 'SolicitudPersonal',
        entidadId: solicitud.idSolicitud,
        soloActivos: true,
      })
      .then((lista) => {
        if (cancelado) return;
        setArchivosPdf((Array.isArray(lista) ? lista : []).filter(esPdf));
      })
      .catch(() => {
        if (!cancelado) setArchivosPdf([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoArchivos(false);
      });
    return () => {
      cancelado = true;
    };
  }, [solicitud?.idSolicitud]);

  const quitarSoporte = () => {
    setArchivoSoporte(null);
    setIdArchivoSeleccionado(null);
    if (soporteInputRef.current) soporteInputRef.current.value = '';
  };

  const confirmar = async () => {
    if (!accion) return;
    if (!onSubmit) {
      toast.error('No está configurado el envío a director para esta acción');
      return;
    }
    if (accion.requiereComentario && !comentario.trim()) {
      toast.error('El comentario es obligatorio para esta acción');
      return;
    }

    setGenerandoPdf(true);
    try {
      const pdfBlob = await generarPdfSolicitud(solicitud, historial, pasosWorkflow);

      // Soporte: el archivo subido tiene prioridad; si no, se envía el PDF seleccionado de los adjuntos.
      let soporte: File | null = archivoSoporte;
      if (!soporte && archivoExistente) {
        const res = await API.get<Blob>(`/archivos/${archivoExistente.id}/download`, {
          responseType: 'blob',
        });
        soporte = new File([res.data], archivoExistente.nombreOriginal, {
          type: 'application/pdf',
        });
      }

      const ok = await onSubmit(
        { idAccion: accion.idAccion, comentario: comentario || null, datosAdicionales: null },
        pdfBlob,
        soporte
      );
      if (ok) onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al generar el PDF de la solicitud';
      toast.error('Error al enviar la solicitud', { description: message, duration: 8000 });
      console.error('Error al enviar la solicitud al director', err);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const enviando = isSubmitting || generandoPdf;

  return (
    <>
      <Modal
        id="modal-enviar-director"
        open={open}
        setOpen={(o) => {
          if (!o) onClose();
        }}
        title="Enviar solicitud al director"
        subtitle={`${solicitud.folio} · ${solicitud.solicitanteNombre ?? ''}`}
        size="wide"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {generandoPdf ? 'Generando PDF...' : 'Confirmar envío'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">

          {/* 1. Vista previa (arriba, como OC) */}
          <div className="space-y-2">
            <Label>Vista previa de la solicitud</Label>
            {/* Ancho fijo 820px (igual que el portal de captura): si se deja al ancho de
                la columna, el documento re-acomoda el texto y el PDF no coincide. */}
            <div className="solicitud-pdf-preview max-h-[55vh] overflow-auto rounded-lg border bg-white">
              <div style={{ width: 820, minWidth: 820, margin: '0 auto' }}>
                <SolicitudPersonalPDF
                  solicitud={solicitud}
                  historial={historial}
                  pasosWorkflow={pasosWorkflow}
                  firmaDirector
                  marcadorVisible
                />
              </div>
            </div>
          </div>

          {/* 2. Documento soporte (uno, PDF) */}
          <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="soporte-archivo">Documento soporte</Label>
                {haySoporte && (
                  <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">
                    PDF seleccionado
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">Opcional · uno, PDF</span>
              </div>

              {cargandoArchivos && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando PDFs adjuntos a la
                  solicitud…
                </p>
              )}

              {archivosPdf.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    PDFs ya adjuntos a la solicitud (elige uno como soporte):
                  </p>
                  {archivosPdf.map((a) => {
                    const seleccionado = idArchivoSeleccionado === a.id;
                    return (
                      <label
                        key={a.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
                          seleccionado
                            ? 'border-green-500 bg-green-50'
                            : 'border-border bg-muted/30'
                        )}
                      >
                        <input
                          type="radio"
                          name="archivo-soporte-existente"
                          className="accent-green-600"
                          checked={seleccionado}
                          onChange={() => {
                            setIdArchivoSeleccionado(a.id);
                            setArchivoSoporte(null);
                            if (soporteInputRef.current) soporteInputRef.current.value = '';
                          }}
                        />
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{a.nombreOriginal}</span>
                        {seleccionado && (
                          <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">
                            Seleccionado
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  id="soporte-archivo"
                  type="file"
                  accept=".pdf,application/pdf"
                  ref={soporteInputRef}
                  disabled={enviando}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setArchivoSoporte(file);
                    if (file) setIdArchivoSeleccionado(null);
                  }}
                  className={cn(
                    haySoporte &&
                      'border-green-500 bg-green-50 file:text-green-700 hover:border-green-600'
                  )}
                />
                {haySoporte && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    onClick={() => setVerSoporte(true)}
                    disabled={enviando}
                  >
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </Button>
                )}
                {haySoporte && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8 px-2"
                    onClick={quitarSoporte}
                    disabled={enviando}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {archivoSoporte && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3" /> {archivoSoporte.name}
                </p>
              )}
              {!archivoSoporte && archivoExistente && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="h-3 w-3" /> Se enviará como soporte:{' '}
                  {archivoExistente.nombreOriginal}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Este PDF se enviará como documento de soporte del envío. Solo se acepta uno y en
                formato PDF.
              </p>
          </div>

          {/* 3. Comentario (con valor por defecto: la solicitud y quién solicita) */}
          <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="comentario-enviar-director">
                  Comentario
                  {accion?.requiereComentario && <span className="ml-1 text-red-500">*</span>}
                </Label>
                {!accion?.requiereComentario && (
                  <span className="text-xs text-muted-foreground">Opcional</span>
                )}
              </div>
              <Textarea
                id="comentario-enviar-director"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escribe un comentario para el director"
                rows={3}
              />
          </div>

        </div>
      </Modal>

      {/* Vista previa del PDF de soporte */}
      <FileViewer
        archivoId={archivoSoporte ? null : (archivoExistente?.id ?? null)}
        localFile={archivoSoporte}
        open={verSoporte}
        onClose={() => setVerSoporte(false)}
      />
    </>
  );
}

export default EnviarDirectorModal;
