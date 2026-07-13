import { useEffect, useState } from 'react';
import { FileText, Eye, Loader2, ImageIcon } from 'lucide-react';
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
import { proveedorApi } from '@/services/api';
import { ApiResponse } from '@/types/api.types';
import { toApiError } from '@/utils/errors';
import { toast } from 'sonner';

/**
 * One carátula per account, as returned by
 * GET /api/catalogos/Proveedores/{id}/caratulas.
 */
interface CaratulaCuenta {
  cuentaId: number;
  ultimos4: string;
  caratulaUrl: string | null;
}

export interface CaratulasPreviewModalProps {
  proveedorId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional callback that opens the shared fullscreen viewer for a carátula URL.
   * When omitted, preview buttons are disabled. Reusing the parent viewer keeps a
   * single source of truth for the fullscreen overlay (see design §6).
   */
  onPreview?: (url: string) => void;
}

const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

const buildFullUrl = (relativePath: string) => {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return `${apiUrl}/media/archivos/${relativePath}`;
};

/**
 * Lists every carátula a supplier holds (one per account). Empty state, loading
 * and error states included. Replaces the legacy single-thumbnail row cell.
 */
export function CaratulasPreviewModal({
  proveedorId,
  open,
  onOpenChange,
  onPreview,
}: CaratulasPreviewModalProps) {
  const [caratulas, setCaratulas] = useState<CaratulaCuenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !proveedorId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await proveedorApi.getCaratulas(proveedorId);
        const list =
          ((response.data as ApiResponse<CaratulaCuenta[]>)?.data ??
            (response.data as unknown as CaratulaCuenta[])) ??
          [];
        if (!cancelled) setCaratulas(list);
      } catch (err: unknown) {
        if (cancelled) return;
        const apiErr = toApiError(err);
        const message = apiErr.message ?? 'Error al cargar las carátulas';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Carátulas del proveedor</DialogTitle>
          <DialogDescription>
            Una carátula por cuenta bancaria que tenga un archivo cargado.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Cargando carátulas...
            </span>
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : caratulas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay carátulas para este proveedor.
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <ul className="space-y-2 pr-2">
              {caratulas.map((c) => {
                const fullUrl = c.caratulaUrl ? buildFullUrl(c.caratulaUrl) : null;
                return (
                  <li
                    key={c.cuentaId}
                    className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-muted p-1.5">
                        {fullUrl && isPdf(fullUrl) ? (
                          <FileText className="h-6 w-6 text-blue-600" />
                        ) : fullUrl ? (
                          <img
                            src={fullUrl}
                            alt={`Carátula ••${c.ultimos4}`}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          Cuenta
                        </span>
                        <Badge
                          variant="outline"
                          className="w-fit font-mono text-xs"
                        >
                          ••{c.ultimos4}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      disabled={!fullUrl || !onPreview}
                      onClick={() => fullUrl && onPreview?.(fullUrl)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </Button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CaratulasPreviewModal;
