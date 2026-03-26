import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, FileIcon, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { archivoService } from '@/services/archivoService';
import { API } from '@/services/api';
import type { Archivo } from '@/types/archivo.types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface FileViewerProps {
  archivoId: number;
  titulo?: string;
  textoNoSoportado?: string;
  textoDescargar?: string;
  open: boolean;
  onClose: () => void;
}

export function FileViewer({
  archivoId,
  titulo,
  textoNoSoportado = 'Formato no soportado para previsualización',
  textoDescargar = 'Descargar',
  open,
  onClose
}: FileViewerProps) {
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notSupported, setNotSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadArchivo = useCallback(async () => {
    try {
      setLoading(true);
      setNotSupported(false);
      setError(null);
      
      const data = await archivoService.getById(archivoId);
      setArchivo(data);
    } catch (err) {
      setError('Error al cargar el archivo');
    } finally {
      setLoading(false);
    }
  }, [archivoId]);

  const renderPreview = useCallback(async () => {
    if (!archivo || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // URL relativa (sin /api porque API.get ya lo agrega)
    const previewUrl = `/archivos/${archivo.id}/preview`;

    // Fetch con autenticación
    let blob: Blob;
    try {
      const response = await API.get(previewUrl, { responseType: 'blob' });
      blob = response.data as Blob;
    } catch (err) {
      setNotSupported(true);
      drawNotSupported();
      return;
    }

    const blobUrl = URL.createObjectURL(blob);

    // Check if it's an image
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (imageExtensions.includes(archivo.extension.toLowerCase())) {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(blobUrl); // Cleanup
        const containerWidth = containerRef.current?.clientWidth || 600;
        const scale = containerWidth / img.width;
        canvas.width = containerWidth;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        setNotSupported(true);
        drawNotSupported();
      };
      img.src = blobUrl;
      return;
    }

    // Try to render as PDF
    try {
      const loadingTask = pdfjsLib.getDocument(blobUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      const containerWidth = containerRef.current?.clientWidth || 600;
      const viewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: scaledViewport,
        canvas: canvas
      };

      await page.render(renderContext).promise;
      URL.revokeObjectURL(blobUrl); // Cleanup after render
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      setNotSupported(true);
      drawNotSupported();
    }
  }, [archivo]);

  const drawNotSupported = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    canvas.width = containerWidth;
    canvas.height = 300;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Icon (draw a simple file icon shape)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    const iconX = canvas.width / 2 - 30;
    const iconY = 60;
    
    ctx.beginPath();
    ctx.moveTo(iconX, iconY);
    ctx.lineTo(iconX, iconY + 60);
    ctx.lineTo(iconX + 40, iconY + 60);
    ctx.lineTo(iconX + 40, iconY + 15);
    ctx.lineTo(iconX + 25, iconY);
    ctx.closePath();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(iconX + 25, iconY);
    ctx.lineTo(iconX + 25, iconY + 15);
    ctx.lineTo(iconX + 40, iconY + 15);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#64748b';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(textoNoSoportado, canvas.width / 2, 160);

    // File name
    if (archivo) {
      ctx.fillStyle = '#334155';
      ctx.font = '14px sans-serif';
      ctx.fillText(archivo.nombreOriginal, canvas.width / 2, 190);
    }
  }, [textoNoSoportado, archivo]);

  useEffect(() => {
    if (open && archivoId) {
      loadArchivo();
    }
  }, [open, archivoId, loadArchivo]);

  useEffect(() => {
    if (archivo && !loading) {
      renderPreview();
    }
  }, [archivo, loading, renderPreview]);

  const handleDownload = () => {
    if (archivo) {
      window.open(archivoService.getDownloadUrl(archivo.id), '_blank');
    }
  };

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

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold truncate">
            {titulo || archivo?.nombreOriginal || 'Visor de archivos'}
          </h2>
          <div className="flex items-center gap-2">
            {archivo && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                <Download className="w-4 h-4" />
                {textoDescargar}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              title="Cerrar (Esc)"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-64 text-red-500">
              <AlertCircle className="w-12 h-12 mb-2" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <canvas
              ref={canvasRef}
              className="max-w-full shadow-lg"
            />
          )}
        </div>

        {/* Footer for not supported */}
        {notSupported && archivo && (
          <div className="p-4 border-t bg-gray-50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <FileIcon className="w-5 h-5" />
                <span className="text-sm">{archivo.nombreOriginal}</span>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                {textoDescargar}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
