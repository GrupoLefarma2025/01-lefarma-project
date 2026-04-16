import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, FileText, AlertCircle, Eye, FileSpreadsheet, Image as ImageIcon, FileCode } from 'lucide-react';
import { archivoService } from '@/services/archivoService';
import type { Archivo, SubirArchivoParams } from '@/types/archivo.types';
import { toast } from 'sonner';
import { FileViewer } from './FileViewer';


interface FileUploaderProps {
  entidadTipo: string;
  entidadId: number;
  carpeta: string;
  metadata?: unknown;
  tiposPermitidos?: string[];
  tamanoMaximoMB?: number;
  cantidadMaxima?: number;
  multiple?: boolean;
  titulo?: string;
  descripcion?: string;
  textoErrorTipo?: string;
  textoErrorTamano?: string;
  textoErrorCantidad?: string;
  open: boolean;
  /** Render inline (no overlay, no title bar) — for embedding inside an existing modal */
  inline?: boolean;
  onUploadComplete: (archivos: Archivo[]) => void;
  onError?: (error: string) => void;
  onClose: () => void;
}

const DEFAULT_TIPOS_PERMITIDOS = ['.pdf', '.xlsx', '.docx', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
const DEFAULT_TAMANO_MAXIMO_MB = 10;
const DEFAULT_CANTIDAD_MAXIMA = 1;

export function FileUploader({
  entidadTipo,
  entidadId,
  carpeta,
  metadata,
  tiposPermitidos = DEFAULT_TIPOS_PERMITIDOS,
  tamanoMaximoMB = DEFAULT_TAMANO_MAXIMO_MB,
  cantidadMaxima = DEFAULT_CANTIDAD_MAXIMA,
  multiple = false,
  titulo = 'Subir archivo',
  descripcion = 'Arrastrá o hacé clic para seleccionar',
  textoErrorTipo = 'Tipo de archivo no permitido',
  textoErrorTamano = 'El archivo excede el tamaño máximo',
  textoErrorCantidad = 'Máximo excedido',
  open,
  inline = false,
  onUploadComplete,
  onError,
  onClose
}: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [viewerFile, setViewerFile] = useState<File | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Record<number, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Generar/revocar objectURLs para thumbnails de imágenes
  useEffect(() => {
    const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
    const urls: Record<number, string> = {};
    files.forEach((f, i) => {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
      if (IMAGE_EXTS.includes(ext)) {
        urls[i] = URL.createObjectURL(f);
      }
    });
    setImagePreviews(urls);
    return () => { Object.values(urls).forEach(URL.revokeObjectURL); };
  }, [files]);

  const validateFile = useCallback((file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!tiposPermitidos.includes(extension)) {
      return textoErrorTipo;
    }

    if (file.size > tamanoMaximoMB * 1024 * 1024) {
      return textoErrorTamano;
    }

    return null;
  }, [tiposPermitidos, tamanoMaximoMB, textoErrorTipo, textoErrorTamano]);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles = Array.from(fileList);
    const newErrors: string[] = [];
    const validFiles: File[] = [];

    if (files.length + newFiles.length > cantidadMaxima) {
      newErrors.push(`${textoErrorCantidad}: ${cantidadMaxima}`);
      setErrors(newErrors);
      return;
    }

    newFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    setErrors(newErrors);
    setFiles(prev => [...prev, ...validFiles].slice(0, cantidadMaxima));
  }, [files.length, cantidadMaxima, validateFile, textoErrorCantidad]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const uploadedArchivos: Archivo[] = [];
    const uploadErrors: string[] = [];

    const params: SubirArchivoParams = {
      entidadTipo,
      entidadId,
      carpeta,
      metadata
    };

    for (const file of files) {
      try {
        const archivo = await archivoService.upload(file, params);
        uploadedArchivos.push(archivo);
      } catch (error) {
        uploadErrors.push(`${file.name}: Error al subir`);
      }
    }

    setUploading(false);

    if (uploadErrors.length > 0) {
      uploadErrors.forEach(err => toast.error(err));
      onError?.(uploadErrors.join(', '));
    }

    if (uploadedArchivos.length > 0) {
      toast.success(`${uploadedArchivos.length} archivo(s) subido(s)`);
      onUploadComplete(uploadedArchivos);
      setFiles([]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!open) return null;

  /** Contenido reutilizable en ambos modos */
  const content = (
    <>
      {/* Drop zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-300 dark:border-zinc-600 hover:border-gray-400 dark:hover:border-zinc-500'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 dark:text-zinc-300">{descripcion}</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          {tiposPermitidos.join(', ')} · Máx {tamanoMaximoMB}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={tiposPermitidos.join(',')}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
          {errors.map((error, i) => (
            <div key={i} className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          ))}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => {
            const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
            const isImage = imagePreviews[i] != null;
            const isPdf = ext === '.pdf';
            const isExcel = ['.xlsx', '.xls'].includes(ext);
            const isText = ['.txt', '.csv', '.xml', '.json', '.log'].includes(ext);
            return (
              <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 border border-border rounded-lg">
                {/* Thumbnail / badge */}
                {isImage ? (
                  <img
                    src={imagePreviews[i]}
                    alt={file.name}
                    className="w-10 h-10 rounded object-cover shrink-0 border border-border"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 text-xs font-semibold
                    ${isPdf ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' :
                      isExcel ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                      isText ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' :
                      'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300'}`}>
                    {isPdf ? <FileText className="w-5 h-5" /> :
                     isExcel ? <FileSpreadsheet className="w-5 h-5" /> :
                     isText ? <FileCode className="w-5 h-5" /> :
                     <ImageIcon className="w-5 h-5" />}
                  </div>
                )}
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                </div>
                {/* Actions */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setViewerFile(file); }}
                  className="p-1.5 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground shrink-0"
                  title="Vista previa"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="p-1.5 hover:bg-destructive/10 rounded transition-colors text-muted-foreground hover:text-destructive shrink-0"
                  title="Quitar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* FileViewer para preview local */}
      <FileViewer
        localFile={viewerFile}
        open={viewerFile !== null}
        onClose={() => setViewerFile(null)}
      />

      {/* Footer actions */}
      <div className={`flex justify-end gap-2 ${inline ? 'mt-3' : 'mt-4 pt-4 border-t'}`}>
        {!inline && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm"
            disabled={uploading}
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {uploading ? 'Subiendo...' : 'Subir'}
        </button>
      </div>
    </>
  );

  // Inline mode: render content directly (inside existing modal)
  if (inline) {
    return <div className="space-y-1">{content}</div>;
  }

  // Dialog mode: render with its own overlay
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {content}
        </div>
      </div>
    </div>
  );
}
