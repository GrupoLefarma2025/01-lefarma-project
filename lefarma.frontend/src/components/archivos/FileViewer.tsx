import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Download,
  FileText,
  AlertCircle,
  HardDrive,
  Calendar,
  FileSpreadsheet,
  Image,
  FileCode,
  Loader2,
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { archivoService } from '@/services/archivoService';
import { API } from '@/services/api';
import type { Archivo } from '@/types/archivo.types';
import { ExcelTable } from './ExcelTable';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// ─── tipos y helpers ───────────────────────────────────────────────────────────

type PreviewKind = 'image' | 'pdf' | 'excel' | 'text' | 'unsupported';

function resolveKind(ext: string, mime?: string | null): PreviewKind {
  const e = ext.toLowerCase();
  const m = (mime ?? '').toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(e) || m.startsWith('image/')) return 'image';
  if (e === '.pdf' || m === 'application/pdf') return 'pdf';
  if (['.xlsx', '.xls'].includes(e) || m.includes('spreadsheet') || m.includes('excel')) return 'excel';
  if (['.csv', '.txt', '.xml', '.json', '.log'].includes(e) || m.startsWith('text/') || m.includes('json') || m.includes('xml')) return 'text';
  return 'unsupported';
}

const EXT_COLORS: Record<string, string> = {
  '.pdf':  'bg-rose-100  text-rose-700  dark:bg-rose-900/30  dark:text-rose-300',
  '.xlsx': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  '.xls':  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  '.docx': 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-300',
  '.doc':  'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-300',
  '.pptx': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  '.png':  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  '.jpg':  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  '.jpeg': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  '.gif':  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  '.webp': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

function extColor(ext: string) {
  return EXT_COLORS[ext.toLowerCase()] ?? 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300';
}

function extIcon(kind: PreviewKind) {
  switch (kind) {
    case 'image':  return <Image className="w-5 h-5" />;
    case 'pdf':    return <FileText className="w-5 h-5" />;
    case 'excel':  return <FileSpreadsheet className="w-5 h-5" />;
    case 'text':   return <FileCode className="w-5 h-5" />;
    default:       return <FileText className="w-5 h-5" />;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── FileViewer ────────────────────────────────────────────────────────────────

/**
 * Visor de archivos con preview real para PDF, imágenes, Excel y texto.
 * Acepta un archivo remoto (`archivoId`) o un archivo local (`localFile`).
 * El preview remoto se carga autenticado vía API (JWT en headers).
 *
 * @lat: [[frontend#Archivos#Visualización de archivos]]
 */
interface FileViewerProps {
  /** ID del archivo ya guardado en backend */
  archivoId?: number | null;
  /** Archivo local (antes de subir) para preview inmediato */
  localFile?: File | null;
  titulo?: string;
  textoDescargar?: string;
  open: boolean;
  onClose: () => void;
}

export function FileViewer({
  archivoId,
  localFile,
  titulo,
  textoDescargar = 'Descargar',
  open,
  onClose,
}: FileViewerProps) {
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview data
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<{ sheets: { name: string; data: Record<string, unknown>[] }[] } | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const prevBlobRef = useRef<string | null>(null);

  // Cleanup blob URLs on close / unmount
  useEffect(() => {
    return () => {
      if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
    };
  }, []);

  const resetPreview = () => {
    if (prevBlobRef.current) {
      URL.revokeObjectURL(prevBlobRef.current);
      prevBlobRef.current = null;
    }
    setBlobUrl(null);
    setExcelData(null);
    setTextContent(null);
    setActiveSheet(0);
    setError(null);
  };

  // ── Cargar metadatos del archivo remoto ────────────────────────────────
  const loadRemoteMetadata = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await archivoService.getById(id);
      setArchivo(data);
    } catch {
      setError('No se pudo cargar la información del archivo.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Cargar preview del archivo remoto ─────────────────────────────────
  const loadRemotePreview = useCallback(async (arch: Archivo) => {
    const kind = resolveKind(arch.extension, arch.tipoMime);
    setPreviewLoading(true);

    try {
      if (kind === 'image' || kind === 'pdf') {
        const res = await API.get(`/archivos/${arch.id}/preview`, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data as Blob);
        prevBlobRef.current = url;
        setBlobUrl(url);
      } else if (kind === 'excel') {
        const res = await API.get(`/archivos/${arch.id}/preview`, { responseType: 'arraybuffer' });
        const wb = XLSX.read(res.data, { type: 'array' });
        const sheets = wb.SheetNames.map((name) => ({
          name,
          data: XLSX.utils.sheet_to_json(wb.Sheets[name]) as Record<string, unknown>[],
        }));
        setExcelData({ sheets });
      } else if (kind === 'text') {
        const res = await API.get(`/archivos/${arch.id}/preview`, { responseType: 'text' });
        setTextContent(res.data as string);
      }
    } catch {
      // preview no disponible — no bloqueamos, el usuario puede descargar
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // ── Cargar preview de archivo local (File) ─────────────────────────────
  const loadLocalPreview = useCallback(async (file: File) => {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    const kind = resolveKind(ext, file.type);
    setPreviewLoading(true);

    try {
      if (kind === 'image') {
        const url = URL.createObjectURL(file);
        prevBlobRef.current = url;
        setBlobUrl(url);
      } else if (kind === 'pdf') {
        const url = URL.createObjectURL(file);
        prevBlobRef.current = url;
        setBlobUrl(url);
      } else if (kind === 'excel') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheets = wb.SheetNames.map((name) => ({
          name,
          data: XLSX.utils.sheet_to_json(wb.Sheets[name]) as Record<string, unknown>[],
        }));
        setExcelData({ sheets });
      } else if (kind === 'text') {
        const text = await file.text();
        setTextContent(text);
      }
    } catch {
      // silencioso
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // ── Efectos principales ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    resetPreview();

    if (localFile) {
      // preview local
      const ext = '.' + (localFile.name.split('.').pop() ?? '').toLowerCase();
      const kind = resolveKind(ext, localFile.type);
      const pseudoArchivo: Archivo = {
        id: 0,
        entidadTipo: '',
        entidadId: 0,
        carpeta: '',
        nombreOriginal: localFile.name,
        nombreFisico: localFile.name,
        extension: ext,
        tipoMime: localFile.type || (kind === 'pdf' ? 'application/pdf' : ''),
        tamanoBytes: localFile.size,
        metadata: null,
        fechaCreacion: new Date().toISOString(),
        fechaEdicion: null,
        usuarioId: null,
        activo: true,
      };
      setArchivo(pseudoArchivo);
      loadLocalPreview(localFile);
    } else if (archivoId) {
      setArchivo(null);
      loadRemoteMetadata(archivoId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, archivoId, localFile]);

  useEffect(() => {
    if (archivo && !loading && archivoId && archivo.id > 0) {
      loadRemotePreview(archivo);
    }
  }, [archivo, loading, archivoId, loadRemotePreview]);

  // ── Escape handled by Radix Dialog ───────────────────────────────────

  const handleDownload= () => {
    if (archivo && archivo.id > 0) {
      window.open(archivoService.getDownloadUrl(archivo.id), '_blank');
    } else if (localFile) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(localFile);
      a.download = localFile.name;
      a.click();
    }
  };

  if (!open) return null;

  const ext = archivo?.extension ?? '';
  const kind = resolveKind(ext, archivo?.tipoMime);
  const isLocal = !!localFile;
  const canDownload = !isLocal && archivo && archivo.id > 0;

  // ── Área de preview ────────────────────────────────────────────────────
  const renderPreview = () => {
    if (previewLoading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (kind === 'image' && blobUrl) {
      return (
        <div className="flex flex-1 items-center justify-center bg-muted/30 rounded-lg overflow-hidden p-2">
          <img
            src={blobUrl}
            alt={archivo?.nombreOriginal}
            className="max-w-full max-h-full object-contain rounded"
            style={{ maxHeight: '60vh' }}
          />
        </div>
      );
    }

    if (kind === 'pdf' && blobUrl) {
      return (
        <div className="flex flex-1 rounded-lg overflow-hidden border border-border" style={{ minHeight: '60vh' }}>
          <iframe
            src={blobUrl}
            title={archivo?.nombreOriginal}
            className="w-full h-full"
            style={{ minHeight: '60vh' }}
          />
        </div>
      );
    }

    if (kind === 'excel' && excelData) {
      const sheets = excelData.sheets;
      return (
        <div className="flex flex-col flex-1 gap-2">
          {sheets.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {sheets.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSheet(i)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                    i === activeSheet
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <ExcelTable data={sheets[activeSheet]?.data ?? []} />
        </div>
      );
    }

    if (kind === 'text' && textContent !== null) {
      return (
        <div className="flex flex-1 overflow-auto rounded-lg border border-border bg-muted/30">
          <pre className="p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-words w-full" style={{ maxHeight: '60vh' }}>
            {textContent.length > 50_000 ? textContent.slice(0, 50_000) + '\n\n…(truncado)' : textContent}
          </pre>
        </div>
      );
    }

    // unsupported o sin datos aún
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
        <div className={`p-4 rounded-xl border ${extColor(ext)}`}>
          {extIcon(kind)}
        </div>
        <p className="text-sm">Vista previa no disponible para este formato</p>
        {canDownload && (
          <p className="text-xs">Descarga el archivo para abrirlo con la aplicación correspondiente</p>
        )}
      </div>
    );
  };

  // ── Layout ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="flex flex-col overflow-hidden p-0 gap-0 border-border bg-background"
        style={{
          maxWidth: kind === 'unsupported' ? '36rem' : '90vw',
          width: '90vw',
          maxHeight: '92vh',
        }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {titulo || archivo?.nombreOriginal || 'Vista previa'}
        </DialogTitle>

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          {archivo && (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border ${extColor(ext)}`}>
              {ext.replace('.', '') || '?'}
            </span>
          )}
          <h2 className="flex-1 text-sm font-semibold truncate text-foreground">
            {titulo || archivo?.nombreOriginal || 'Vista previa'}
          </h2>
          {canDownload && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
              title={textoDescargar}
            >
              <Download className="w-3.5 h-3.5" />
              {textoDescargar}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Preview area */}
          <div className="flex flex-1 flex-col p-4 overflow-auto gap-3">
            {loading && (
              <div className="flex flex-1 items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {error && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-destructive py-8">
                <AlertCircle className="w-10 h-10" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            {!loading && !error && archivo && renderPreview()}
          </div>

          {/* Sidebar de metadata — solo cuando hay espacio útil */}
          {archivo && kind !== 'unsupported' && (
            <div className="hidden lg:flex flex-col gap-3 w-52 shrink-0 border-l border-border p-4 bg-muted/20 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm truncate" title={archivo.nombreOriginal}>
                {archivo.nombreOriginal}
              </p>
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 shrink-0" />
                <span>{formatSize(archivo.tamanoBytes)}</span>
              </div>
              {!isLocal && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{formatDate(archivo.fechaCreacion)}</span>
                </div>
              )}
              {archivo.tipoMime && (
                <p className="break-all font-mono text-[10px] text-muted-foreground/70">{archivo.tipoMime}</p>
              )}
              {isLocal && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] font-semibold w-fit">
                  Sin guardar
                </span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
