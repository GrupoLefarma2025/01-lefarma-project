import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Eye, Download, Trash2, Loader2 } from 'lucide-react';
import { FileUploader } from '@/components/archivos/FileUploader';
import { FileViewer } from '@/components/archivos/FileViewer';
import { archivoService } from '@/services/archivoService';
import type { ArchivoListItem } from '@/types/archivo.types';
import { toast } from 'sonner';

const fmtFecha = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const EXT_BADGE: Record<string, string> = {
  pdf: 'bg-rose-100 text-rose-700',
  xlsx: 'bg-emerald-100 text-emerald-700',
  xls: 'bg-emerald-100 text-emerald-700',
  docx: 'bg-blue-100 text-blue-700',
  doc: 'bg-blue-100 text-blue-700',
  png: 'bg-violet-100 text-violet-700',
  jpg: 'bg-violet-100 text-violet-700',
  jpeg: 'bg-violet-100 text-violet-700',
  webp: 'bg-violet-100 text-violet-700',
  gif: 'bg-violet-100 text-violet-700',
};

const parseMeta = (meta: unknown): { tipo?: string; observaciones?: string; nombrePaso?: string; nombreAccion?: string } => {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try { return JSON.parse(meta); } catch { return { observaciones: meta }; }
  }
  if (typeof meta === 'object') return meta as ReturnType<typeof parseMeta>;
  return {};
};

interface SolicitudArchivosTabProps {
  idSolicitud: number;
}

export function SolicitudArchivosTab({ idSolicitud }: SolicitudArchivosTabProps) {
  const [archivos, setArchivos] = useState<ArchivoListItem[]>([]);
  const archivosList = Array.isArray(archivos) ? archivos : [];
  const [loading, setLoading] = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [viewerId, setViewerId] = useState<number | null>(null);

  const fetchArchivos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await archivoService.getAll({
        entidadTipo: 'SolicitudPersonal',
        entidadId: idSolicitud,
        soloActivos: true,
      });
      setArchivos(Array.isArray(data) ? data : []);
    } catch {
      setArchivos([]);
    } finally {
      setLoading(false);
    }
  }, [idSolicitud]);

  useEffect(() => {
    fetchArchivos();
  }, [fetchArchivos]);

  const handleEliminar = async (idArchivo: number) => {
    if (!window.confirm('¿Deseas borrar este archivo?')) return;
    try {
      await archivoService.delete(idArchivo);
      toast.success('Archivo borrado');
      fetchArchivos();
    } catch {
      toast.error('Error al borrar el archivo');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Documentos adjuntos
          {archivosList.length > 0 && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] normal-case font-medium">
              {archivosList.length}
            </span>
          )}
        </p>
        <Button size="sm" variant="outline" onClick={() => setUploaderOpen((v) => !v)}>
          <Paperclip className="mr-1 h-3.5 w-3.5" />
          Subir
        </Button>
      </div>

      {uploaderOpen && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Justificante médico, documento de soporte..."
              rows={2}
              className="text-xs"
            />
          </div>
          <FileUploader
            inline
            open
            multiple
            cantidadMaxima={5}
            entidadTipo="SolicitudPersonal"
            entidadId={idSolicitud}
            carpeta="solicitudes-personal"
            metadata={{
              modulo: 'solicitudes_personal',
              origen: 'bandeja',
              tipo: 'adjunto_libre',
              observaciones: observaciones || undefined,
            }}
            tiposPermitidos={['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']}
            descripcion="Arrastra o selecciona documentos de soporte"
            onUploadComplete={() => {
              fetchArchivos();
              setUploaderOpen(false);
              setObservaciones('');
            }}
            onClose={() => {
              setUploaderOpen(false);
              setObservaciones('');
            }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando archivos...</span>
        </div>
      ) : archivosList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-muted-foreground">
          <Paperclip className="mb-2 h-8 w-8 opacity-30" />
          <p className="text-sm">Sin archivos adjuntos</p>
        </div>
      ) : (
        <div className="space-y-1">
          {archivosList.map((archivo) => {
            const meta = parseMeta(archivo.metadata);
            const ext = archivo.extension?.toLowerCase().replace('.', '') ?? '';
            return (
              <div
                key={archivo.id}
                className="group flex items-start gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${EXT_BADGE[ext] ?? 'bg-muted text-muted-foreground'}`}>
                  {ext || '?'}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate font-medium leading-tight" title={archivo.nombreOriginal}>
                    {archivo.nombreOriginal}
                  </p>
                  {meta.observaciones && (
                    <p className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                      {meta.observaciones}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {archivo.usuarioSubioNombre && (
                      <span className="text-[10px] text-muted-foreground/60">{archivo.usuarioSubioNombre}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/40">{fmtFecha(archivo.fechaCreacion)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Ver"
                    onClick={() => setViewerId(archivo.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <a href={archivoService.getDownloadUrl(archivo.id)} target="_blank" rel="noopener noreferrer" title="Descargar">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:text-destructive"
                    title="Borrar"
                    onClick={() => handleEliminar(archivo.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewerId !== null && (
        <FileViewer archivoId={viewerId} open={viewerId !== null} onClose={() => setViewerId(null)} />
      )}
    </div>
  );
}