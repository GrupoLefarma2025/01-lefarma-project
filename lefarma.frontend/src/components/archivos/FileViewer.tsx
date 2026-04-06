import { useState, useEffect, useCallback } from 'react';
import { X, Download, FileIcon, AlertCircle, HardDrive, Calendar } from 'lucide-react';

import * as XLSX from 'xlsx';
import { archivoService } from '@/services/archivoService';
import { API } from '@/services/api';
import type { Archivo } from '@/types/archivo.types';
import { ExcelTable } from './ExcelTable';

interface FileViewerProps {
  archivoId: number;
  titulo?: string;
  textoDescargar?: string;
  open: boolean;
  onClose: () => void;
}

export function FileViewer({
  archivoId,
  titulo,
  textoDescargar = 'Descargar',
  open,
  onClose
}: FileViewerProps) {
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<Record<string, unknown>[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadArchivo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await archivoService.getById(archivoId);
      setArchivo(data);
    } catch (err) {
      setError('Error al cargar el archivo');
    } finally {
      setLoading(false);
    }
  }, [archivoId]);

  useEffect(() => {
    if (open && archivoId) {
      loadArchivo();
    }
  }, [open, archivoId, loadArchivo]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleDownload = () => {
    if (archivo) {
      window.open(archivoService.getDownloadUrl(archivo.id), '_blank');
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExcelFile = (ext: string): boolean => {
    return ['.xlsx', '.xls'].includes(ext.toLowerCase());
  };

  const loadExcelPreview = useCallback(async () => {
    if (!archivo) return;

    const excelExtensions = ['.xlsx', '.xls'];
    if (!excelExtensions.includes(archivo.extension.toLowerCase())) return;

    setPreviewLoading(true);
    setExcelData(null);

    try {
      const response = await API.get(`/archivos/${archivo.id}/preview`, {
        responseType: 'arraybuffer'
      });

      const workbook = XLSX.read(response.data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

      setExcelData(data);
    } catch (err) {
      console.error('Error loading Excel preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [archivo]);

  useEffect(() => {
    if (archivo && !loading) {
      loadExcelPreview();
    }
  }, [archivo, loading, loadExcelPreview]);

  const getExtensionColor = (ext: string): string => {
    const colors: Record<string, string> = {
      '.pdf': 'bg-red-100 text-red-700',
      '.xlsx': 'bg-green-100 text-green-700',
      '.docx': 'bg-blue-100 text-blue-700',
      '.pptx': 'bg-orange-100 text-orange-700',
      '.png': 'bg-purple-100 text-purple-700',
      '.jpg': 'bg-purple-100 text-purple-700',
      '.jpeg': 'bg-purple-100 text-purple-700',
      '.gif': 'bg-purple-100 text-purple-700',
      '.webp': 'bg-purple-100 text-purple-700',
    };
    return colors[ext.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold truncate">
            {titulo || 'Detalles del archivo'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-32 text-red-500">
              <AlertCircle className="w-12 h-12 mb-2" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && archivo && (
            <>
              {/* File icon and name */}
              <div className="flex items-center gap-4">
                <div className={`px-3 py-2 rounded-lg text-sm font-medium uppercase ${getExtensionColor(archivo.extension)}`}>
                  {archivo.extension.replace('.', '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{archivo.nombreOriginal}</p>
                  <p className="text-sm text-gray-500">{archivo.tipoMime}</p>
                </div>
              </div>

              {/* File details */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-gray-600">
                  <HardDrive className="w-4 h-4" />
                  <span>Tamaño: {formatSize(archivo.tamanoBytes)}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Subido: {formatDate(archivo.fechaCreacion)}</span>
                </div>
              </div>

              {/* Excel Preview */}
              {isExcelFile(archivo.extension) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Vista previa</h3>
                  {previewLoading && (
                    <div className="flex items-center justify-center h-24">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {excelData && <ExcelTable data={excelData} />}
                </div>
              )}

              {/* Download button */}
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Download className="w-5 h-5" />
                {textoDescargar}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
