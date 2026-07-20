import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import { generarConcentradoPDF } from '@/utils/generarConcentradoPDF';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import { EnvioConcentradoPDF, AGRUPACION_LABELS } from '@/components/ordenes/EnvioConcentradoPDF';
import type { AgrupacionKey } from '@/components/ordenes/EnvioConcentradoPDF';
import { OrdenCompraConcentradoPDF } from '@/components/ordenes/OrdenCompraConcentradoPDF';
import { useAuthStore } from '@/shared/auth/authStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Printer, Send, RefreshCw, LayoutGrid, CheckSquare, Square, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toApiError } from '@/utils/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnvioConcentradoItemResult {
  idOrden: number;
  folio: string;
  exitoso: boolean;
  nuevoEstado?: string;
  error?: string;
}

interface EnvioConcentradoResponse {
  total: number;
  exitosas: number;
  fallidas: number;
  resultados: EnvioConcentradoItemResult[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function getGroupLabel(orden: OrdenCompraResponse, agrupacion: AgrupacionKey): string {
  switch (agrupacion) {
    case 'sucursal':
      return orden.sucursalNombre ?? `Sucursal ${orden.idSucursal}`;
    case 'empresa':
      return orden.empresaNombre ?? `Empresa ${orden.idEmpresa}`;
    case 'area':
      return orden.areaNombre ?? `Área ${orden.idArea}`;
    case 'proveedor':
      return orden.razonSocialProveedor ?? 'Sin proveedor';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const AGRUPACIONES: Array<{ value: AgrupacionKey; label: string }> = [
  { value: 'sucursal', label: 'Sucursal' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'area', label: 'Área' },
  { value: 'proveedor', label: 'Proveedor' },
];

export default function EnvioConcentrado() {
  const { user } = useAuthStore();
  const [ordenes, setOrdenes] = useState<OrdenCompraResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [agrupacion, setAgrupacion] = useState<AgrupacionKey>('sucursal');
  const [enviando, setEnviando] = useState(false);
  const [envioResult, setEnvioResult] = useState<EnvioConcentradoResponse | null>(null);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [comentario, setComentario] = useState(
    'Autorización enviada desde el sistema de control de gastos'
  );

  // ── Fetch órdenes pendientes de envío concentrado ────────────────────────
  // Estado PREPARACION_GAF (id_estado = 11) - paso que tiene envia_concentrado
  const ESTADO_ENVIO_CONCENTRADO = 11;

  const fetchOrdenes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get<ApiResponse<OrdenCompraResponse[]>>(
        `/ordenes?idEstado=${ESTADO_ENVIO_CONCENTRADO}&soloEnvioConcentrado=true`
      );
      setOrdenes(res.data.data ?? []);
    } catch {
      setError('No se pudieron cargar las órdenes pendientes de envío concentrado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdenes();
  }, []);

  // ── Selección ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === ordenes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ordenes.map((o) => o.idOrden)));
    }
  };

  const allSelected = ordenes.length > 0 && selected.size === ordenes.length;
  const someSelected = selected.size > 0 && !allSelected;

  // ── Órdenes seleccionadas para el PDF ────────────────────────────────────
  const ordenesSeleccionadas = useMemo(
    () => ordenes.filter((o) => selected.has(o.idOrden)),
    [ordenes, selected]
  );

  const totalSeleccionado = useMemo(
    () => ordenesSeleccionadas.reduce((s, o) => s + o.total, 0),
    [ordenesSeleccionadas]
  );

  const isSingleOrden = ordenesSeleccionadas.length === 1;
  const singleOrden = isSingleOrden ? ordenesSeleccionadas[0] : null;

  const firmaElaboroUrl = (() => {
    if (!user?.id) return undefined;
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
    return `${apiUrl}/media/archivos/firmas_usuarios/${user.id}.png`;
  })();

  // ── Grupos para la vista previa ───────────────────────────────────────────
  const grupos = useMemo(() => {
    const map = new Map<string, OrdenCompraResponse[]>();
    for (const o of ordenesSeleccionadas) {
      const key = getGroupLabel(o, agrupacion);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es-MX'))
      .map(([grupo, items]) => ({
        grupo,
        items,
        subtotal: items.reduce((s, o) => s + o.total, 0),
      }));
  }, [ordenesSeleccionadas, agrupacion]);

  // ── Vista previa / Imprimir PDF ──────────────────────────────────────────
  const handlePrint = async () => {
    if (ordenesSeleccionadas.length === 0) return;
    try {
      const pdfBlob = await generarPdfBlob();
      const url = URL.createObjectURL(pdfBlob);

      // Abrir visor de impresión nativo del navegador con el PDF
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.src = url;

      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // Limpiar después de unos segundos
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
          URL.revokeObjectURL(url);
        }, 3000);
      };

      document.body.appendChild(iframe);
    } catch (error: unknown) {
      console.error('[EnvioConcentrado] Error generando PDF para impresión:', error);
    }
  };

  async function generarPdfBlob(): Promise<Blob> {
    // Single orden: html2canvas → jsPDF portrait
    if (isSingleOrden) {
      const portalEl = document.getElementById('envio-concentrado-pdf-portal');
      if (portalEl) {
        const canvas = await html2canvas(portalEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const imgW = pdfW;
        const imgH = (canvas.height * imgW) / canvas.width;
        if (imgH <= pdfH) {
          pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
        } else {
          // Multi-page
          let heightLeft = imgH;
          let position = 0;
          pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
          heightLeft -= pdfH;
          while (heightLeft > 0) {
            position -= pdfH;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
            heightLeft -= pdfH;
          }
        }

        // html2canvas rasterizes the React component to an image — no text layer.
        // PyMuPDF's search_for('#firmad') can't find text inside images, so the
        // Python signature replacer fails with ERROR_KEYWORD_NOT_FOUND.
        // Overlay invisible (white) #firmad text at the Visto Bueno box position.
        const scaleMm = imgW / canvas.width;
        const firmadYImage = imgH - 40 * scaleMm;
        const firmadPage = Math.floor(firmadYImage / pdfH);
        const firmadYPage = firmadYImage - firmadPage * pdfH;
        pdf.setPage(firmadPage + 1);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('#firmad', imgW * 0.74, firmadYPage, { align: 'center' });

        return pdf.output('blob');
      }
    }

    // Multiple ordenes: jsPDF landscape concentrado
    return generarConcentradoPDF({
      ordenes: ordenesSeleccionadas,
      agrupacion,
      generadoPor: user?.nombre ?? user?.username,
      firmaElaboro: firmaElaboroUrl,
    });
  }

  const handleSimularEnvio = async () => {
    if (ordenesSeleccionadas.length === 0) return;
    setEnviando(true);
    try {
      const pdfBlob = await generarPdfBlob();
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `concentrado-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const err = toApiError(error);
      setEnvioError(err.message);
      console.error('[EnvioConcentrado] Error simulando envío:', error);
    } finally {
      setEnviando(false);
    }
  };

  const handleEnviar = async () => {
    if (ordenesSeleccionadas.length === 0) return;
    setEnviando(true);
    setEnvioResult(null);
    setEnvioError(null);
    try {
      const pdfBlob = await generarPdfBlob();

      const formData = new FormData();
      for (const id of ordenesSeleccionadas.map((o) => o.idOrden)) {
        formData.append('IdsOrdenes', String(id));
      }
      formData.append('comentario', comentario);
      formData.append('nombre', `concentrado-${new Date().toISOString().split('T')[0]}`);
      formData.append('usuario', '41@Grupolefarma');
      formData.append('correo', '41@grupolefarma.com.mx');
      formData.append('correoCC', '6@grupolefarma.com.mx');
      formData.append('archivo', pdfBlob, 'concentrado.pdf');
      formData.append('tieneDocumentoSoporte', 'false');

      const res = await API.post<ApiResponse<EnvioConcentradoResponse>>(
        '/ordenes/envio-concentrado/pdf',
        formData
      );
      const data = res.data.data!;
      setEnvioResult(data);
      if ((data.exitosas ?? 0) > 0) {
        setTimeout(fetchOrdenes, 800);
        setSelected(new Set());
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      setEnvioError(err.message);
      console.error('[EnvioConcentrado] Error:', error);
    } finally {
      setEnviando(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Envío Concentrado</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Selecciona las órdenes pendientes de envío concentrado, genera el concentrado PDF y envía al director
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrdenes}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* ── Resultado del envío ── */}
      {(envioResult || envioError) && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
            envioError
              ? 'border-destructive/40 bg-destructive/5 text-destructive'
              : envioResult?.fallidas === 0
              ? 'border-green-500/40 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'
              : 'border-yellow-500/40 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
          )}
        >
          {envioError ? (
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            {envioError ? (
              <span>{envioError}</span>
            ) : envioResult ? (
              <>
                <span className="font-medium">
                  {envioResult.exitosas} orden(es) avanzadas exitosamente
                  {envioResult.fallidas > 0 && `, ${envioResult.fallidas} con error`}.
                </span>
                {envioResult.fallidas > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {envioResult.resultados
                      .filter((r) => !r.exitoso)
                      .map((r) => (
                        <li key={r.idOrden}>
                          {r.folio}: {r.error}
                        </li>
                      ))}
                  </ul>
                )}
              </>
            ) : null}
          </div>
          <button
            onClick={() => { setEnvioResult(null); setEnvioError(null); }}
            className="text-current opacity-50 hover:opacity-100 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Layout principal: tabla izquierda + preview derecha ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Panel izquierdo: tabla ── */}
        <div className="flex flex-col gap-3 w-[55%] min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-3 bg-muted/40 border rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              Agrupar por:
            </div>
            <Select
              value={agrupacion}
              onValueChange={(v) => setAgrupacion(v as AgrupacionKey)}
            >
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGRUPACIONES.map((a) => (
                  <SelectItem key={a.value} value={a.value} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>{ordenes.length} órdenes disponibles</span>
              {selected.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selected.size} seleccionadas
                </Badge>
              )}
            </div>
          </div>

          {/* Tabla */}
          <div className="border rounded-lg overflow-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Cargando órdenes…
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-40 text-sm text-destructive">
                {error}
              </div>
            ) : ordenes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground gap-1">
                <span className="text-2xl">📋</span>
                <span>No hay órdenes pendientes de envío concentrado</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10">
                      <button
                        onClick={toggleAll}
                        className="flex items-center justify-center"
                        title={allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : someSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary opacity-50" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Folio</TableHead>
                    <TableHead className="text-xs font-semibold">
                      {AGRUPACION_LABELS[agrupacion]}
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Área</TableHead>
                    <TableHead className="text-xs font-semibold text-right">F. Límite</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((orden) => {
                    const isSelected = selected.has(orden.idOrden);
                    return (
                      <TableRow
                        key={orden.idOrden}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/8 hover:bg-primary/12'
                            : 'hover:bg-muted/40'
                        )}
                        onClick={() => toggleSelect(orden.idOrden)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(orden.idOrden)}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium">
                          {orden.folio}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getGroupLabel(orden, agrupacion)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {orden.areaNombre ?? `Área ${orden.idArea}`}
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {orden.fechaLimitePago ? fmtDate(orden.fechaLimitePago) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {fmtMoney(orden.total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Barra de totales seleccionados */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between border rounded-lg px-4 py-2.5 bg-primary/5 border-primary/20">
              <div className="text-sm">
                <span className="font-semibold text-primary">{selected.size}</span>
                <span className="text-muted-foreground ml-1">
                  {selected.size === 1 ? 'orden seleccionada' : 'órdenes seleccionadas'}
                </span>
              </div>
              <div className="text-sm font-bold text-primary">{fmtMoney(totalSeleccionado)}</div>
            </div>
          )}
        </div>

        {/* ── Panel derecho: vista previa ── */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Header del panel */}
          <div className="flex items-center justify-between bg-muted/40 border rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground">Vista previa del PDF</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={handlePrint}
                disabled={ordenesSeleccionadas.length === 0}
              >
                <Printer className="h-3.5 w-3.5" />
                Vista previa
              </Button>
              <Button
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => setShowPreviewDialog(true)}
                disabled={ordenesSeleccionadas.length === 0 || enviando}
              >
                <Send className="h-3.5 w-3.5" />
                {enviando ? 'Procesando…' : 'Enviar concentrado'}
              </Button>
            </div>
          </div>

          {/* Preview del documento */}
          <div className="flex-1 border rounded-lg overflow-auto bg-zinc-100 dark:bg-zinc-900 p-3">
            {ordenesSeleccionadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <div className="text-4xl opacity-30">📄</div>
                <span className="text-sm">
                  Selecciona órdenes para ver la vista previa del PDF
                </span>
                <span className="text-xs opacity-60">
                  Puedes cambiar la agrupación y ver cómo quedará el documento
                </span>
              </div>
            ) : isSingleOrden && singleOrden ? (
              <div className="bg-white shadow-sm rounded overflow-hidden">
                <OrdenCompraConcentradoPDF orden={singleOrden} firmaElaboro={firmaElaboroUrl} />
              </div>
            ) : (
              <div id="envio-concentrado-preview" className="bg-white shadow-sm rounded overflow-hidden">
                {/* Resumen de grupos en preview */}
                <div className="p-4 border-b bg-slate-50 text-xs text-muted-foreground flex items-center gap-4">
                  <span>
                    <strong className="text-foreground">{grupos.length}</strong>{' '}
                    {grupos.length === 1 ? 'grupo' : 'grupos'} · agrupado por{' '}
                    <strong className="text-foreground">{AGRUPACION_LABELS[agrupacion]}</strong>
                  </span>
                  <span className="ml-auto font-semibold text-foreground">
                    Total: {fmtMoney(totalSeleccionado)}
                  </span>
                </div>
                {/* Grupos preview */}
                <div className="divide-y">
                  {grupos.map(({ grupo, items, subtotal }) => (
                    <div key={grupo} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {grupo}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {fmtMoney(subtotal)}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {items.map((o) => (
                          <div
                            key={o.idOrden}
                            className="flex items-center justify-between text-xs py-0.5 px-2 rounded bg-slate-50 border border-slate-100"
                          >
                            <span className="font-mono text-slate-700">{o.folio}</span>
                            <span className="text-slate-500">
                              {o.areaNombre ?? `Área ${o.idArea}`}
                            </span>
                            <span className="font-medium text-slate-800">
                              {fmtMoney(o.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Total general */}
                <div className="p-3 bg-slate-50 border-t flex justify-end">
                  <div className="text-sm font-bold text-slate-800">
                    Total general: {fmtMoney(totalSeleccionado)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialog de previsualización antes de enviar ── */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col" showCloseButton={!enviando}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Previsualización del envío
            </DialogTitle>
            <DialogDescription>
              Se enviarán <strong>{ordenesSeleccionadas.length}</strong> orden(es) agrupadas por{' '}
              <strong>{AGRUPACION_LABELS[agrupacion]}</strong> con un total de{' '}
              <strong>{fmtMoney(totalSeleccionado)}</strong>. Revisa el detalle antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto border rounded-lg bg-white envio-concentrado-preview">
            {isSingleOrden && singleOrden ? (
              <OrdenCompraConcentradoPDF
                id="envio-concentrado-pdf-preview"
                orden={singleOrden}
                firmaElaboro={firmaElaboroUrl}
              />
            ) : (
              <EnvioConcentradoPDF
                id="envio-concentrado-pdf-preview"
                ordenes={ordenesSeleccionadas}
                agrupacion={agrupacion}
                generadoPor={user?.nombre ?? user?.username}
                firmaElaboro={firmaElaboroUrl}
              />
            )}
          </div>

          <div className="space-y-1.5 shrink-0">
            <Label htmlFor="comentario-envio" className="text-sm font-medium">
              Comentario del envío
            </Label>
            <Textarea
              id="comentario-envio"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe el comentario que acompañará el envío..."
              rows={3}
              disabled={enviando}
            />
            <p className="text-xs text-muted-foreground">
              Este texto se envía como <code className="font-mono">comentario</code> en la solicitud al backend.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            {/* <Button
              variant="secondary"
              onClick={async () => {
                await handleSimularEnvio();
              }}
              disabled={enviando}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              {enviando ? 'Generando…' : 'Simular envío'}
            </Button> */}
            <Button
              onClick={async () => {
                await handleEnviar();
                setShowPreviewDialog(false);
              }}
              disabled={enviando}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              {enviando ? 'Enviando…' : 'Confirmar envío'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {createPortal(
        <div id="envio-concentrado-pdf-portal" style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          {isSingleOrden && singleOrden ? (
            <OrdenCompraConcentradoPDF
              orden={singleOrden}
              firmaElaboro={firmaElaboroUrl}
            />
          ) : (
            <EnvioConcentradoPDF
              ordenes={ordenesSeleccionadas}
              agrupacion={agrupacion}
              generadoPor={user?.nombre ?? user?.username}
              firmaElaboro={firmaElaboroUrl}
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}