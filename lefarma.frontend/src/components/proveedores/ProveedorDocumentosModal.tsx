import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Eye, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import { toApiError } from '@/utils/errors';
import { toast } from 'sonner';

interface CuentaDocumentos {
  idCuenta: number;
  bancoNombre?: string | null;
  clabe?: string | null;
  numeroCuenta?: string | null;
  numeroTarjeta?: string | null;
  caratulaUrl?: string | null;
}

interface ProveedorDocumentos {
  idProveedor: number;
  razonSocial: string;
  rfc?: string | null;
  detalle?: { constanciaFiscalUrl?: string | null } | null;
  cuentasFormaPago?: CuentaDocumentos[];
}

export interface ProveedorDocumentosModalProps {
  proveedorId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

const buildFullUrl = (relativePath: string) => {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return `${apiUrl}/media/archivos/${relativePath}`;
};

const ultimos4 = (cuenta: CuentaDocumentos) => {
  const src = cuenta.clabe || cuenta.numeroCuenta || cuenta.numeroTarjeta || '';
  const digitos = src.replace(/\D/g, '');
  if (digitos.length === 0) return '????';
  return digitos.length >= 4 ? digitos.slice(-4) : digitos;
};

export function ProveedorDocumentosModal({
  proveedorId,
  open,
  onOpenChange,
}: ProveedorDocumentosModalProps) {
  const [proveedor, setProveedor] = useState<ProveedorDocumentos | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !proveedorId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await API.get<ApiResponse<ProveedorDocumentos>>(
          `/catalogos/Proveedores/${proveedorId}`,
        );
        if (!cancelled) setProveedor(response.data.data ?? null);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = toApiError(err).message ?? 'Error al cargar los documentos';
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, proveedorId]);

  useEffect(() => {
    if (!viewerUrl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setViewerUrl(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [viewerUrl]);

  const constanciaUrl = proveedor?.detalle?.constanciaFiscalUrl ?? null;
  const caratulas = (proveedor?.cuentasFormaPago ?? []).filter(
    (c) => !!c.caratulaUrl,
  );

  const renderVerButton = (relativePath: string) => (
    <Button
      type="button"
      size="sm"
      className="h-8 gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
      onClick={() => setViewerUrl(buildFullUrl(relativePath))}
    >
      <Eye className="h-3.5 w-3.5" />
      Ver
    </Button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setViewerUrl(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-[560px]"
        onInteractOutside={(e) => {
          if (viewerUrl) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (viewerUrl) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Documentos del proveedor</DialogTitle>
          <DialogDescription>
            {proveedor ? (
              <span className="block">
                <span className="font-medium text-foreground">
                  {proveedor.razonSocial}
                </span>
                <span className="ml-2 font-mono text-xs">
                  RFC: {proveedor.rfc || 'N/A'}
                </span>
              </span>
            ) : (
              'Constancia de situación fiscal y carátulas bancarias.'
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Cargando documentos...
            </span>
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : !constanciaUrl && caratulas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay documentos cargados para este proveedor.
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Carátulas bancarias
                </p>
                {caratulas.length === 0 ? (
                  <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-muted-foreground">
                    Sin carátulas cargadas.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {caratulas.map((c) => {
                      const fullUrl = buildFullUrl(c.caratulaUrl!);
                      return (
                        <li
                          key={c.idCuenta}
                          className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50/60 px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="rounded-md bg-muted p-1.5">
                              {isPdf(fullUrl) ? (
                                <FileText className="h-6 w-6 text-blue-600" />
                              ) : (
                                <img
                                  src={fullUrl}
                                  alt={`Carátula ••${ultimos4(c)}`}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                {c.bancoNombre || 'Cuenta bancaria'}
                              </span>
                              <Badge
                                variant="outline"
                                className="w-fit font-mono text-xs"
                              >
                                ••{ultimos4(c)}
                              </Badge>
                            </div>
                          </div>
                          {renderVerButton(c.caratulaUrl!)}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Constancia de Situación Fiscal
                </p>
                {constanciaUrl ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50/60 px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-muted p-1.5">
                        {isPdf(buildFullUrl(constanciaUrl)) ? (
                          <FileText className="h-6 w-6 text-blue-600" />
                        ) : (
                          <img
                            src={buildFullUrl(constanciaUrl)}
                            alt="Constancia de situación fiscal"
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">
                          Constancia cargada
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Documento opcional del proveedor
                        </span>
                      </div>
                    </div>
                    {renderVerButton(constanciaUrl)}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-muted-foreground">
                    Sin constancia cargada.
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>

      {viewerUrl &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[10000] bg-black/80"
              onClick={() => setViewerUrl(null)}
            />
            <div className="pointer-events-none fixed inset-0 z-[10001] flex items-center justify-center p-4">
              <div className="pointer-events-auto">
                {viewerUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={viewerUrl}
                    className="h-[85vh] w-[90vw] max-w-4xl rounded"
                    title="Documento del proveedor"
                  />
                ) : (
                  <img
                    src={viewerUrl}
                    alt="Documento del proveedor"
                    className="max-h-[90vh] max-w-full object-contain"
                  />
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Cerrar vista previa"
              className="pointer-events-auto fixed right-4 top-4 z-[10002] flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-black/50 text-4xl font-bold leading-none text-white transition-colors hover:bg-black/70 hover:text-gray-200"
              onClick={() => setViewerUrl(null)}
            >
              ×
            </button>
          </>,
          document.body,
        )}
    </Dialog>
  );
}

export default ProveedorDocumentosModal;
