import { useState, useCallback, useRef } from 'react';
import { Upload, X, FileIcon, AlertCircle } from 'lucide-react';
import { archivoService } from '@/services/archivoService';
import type { Archivo, SubirArchivoParams } from '@/types/archivo.types';
import { toast } from 'sonner';


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
  onUploadComplete,
  onError,
  onClose
}: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Drop zone */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">{descripcion}</p>
            <p className="text-sm text-gray-400 mt-2">
              Tipos: {tiposPermitidos.join(', ')} | Máx: {tamanoMaximoMB}MB
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
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
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
            <div className="mt-4 space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <FileIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            disabled={uploading}
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Subiendo...' : 'Subir'}
          </button>
        </div>
      </div>
    </div>
  );
}
