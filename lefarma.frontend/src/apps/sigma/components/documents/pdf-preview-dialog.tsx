import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Document } from "@/apps/sigma/lib/documents";
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize,
  Maximize2,
  MessageSquare,
  PanelLeft,
  Printer,
  User,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface PDFPreviewDialogProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (document: Document) => void;
  onReject?: (document: Document) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  isDocumentBusy?: boolean;
  onDocumentLoad?: (documentId: string, mostrarDocumentoSoporte: boolean) => Promise<void>;
  attachments?: {
    idDocumento: string;
    nombreArchivo: string;
    tipoDocumento?: string;
    esPrincipal?: boolean;
  }[];
  onSelectAttachment?: (idDocumento: string) => void;
}

interface PdfControlsState {
  pageNumber: number;
  numPages: number;
  isDocumentLoaded: boolean;
  scale: number;
  changePage: (delta: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: () => void;
  print: () => void;
  isPrinting: boolean;
  toggleThumbnails: () => void;
  showThumbnails: boolean;
}

/**
 * El visor embebe el PDF con un iframe, así que la navegación de páginas y el zoom
 * son indicativos: el propio visor del navegador los resuelve dentro del marco.
 * Imprimir, descargar, abrir en pestaña y pantalla completa sí actúan sobre el PDF.
 */
const INITIAL_PDF_CONTROLS: PdfControlsState = {
  pageNumber: 1,
  numPages: 0,
  isDocumentLoaded: false,
  scale: 100,
  changePage: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
  fitWidth: () => {},
  print: () => {},
  isPrinting: false,
  toggleThumbnails: () => {},
  showThumbnails: false,
};

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "Fecha no disponible";

  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) return "Fecha inválida";

  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
};

const STATUS_CONFIG: Record<
  Document["status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pendiente", variant: "outline" },
  processing: { label: "Procesando", variant: "secondary" },
  approved: { label: "Aprobado", variant: "default" },
  rejected: { label: "Rechazado", variant: "destructive" },
};

export function PDFPreviewDialog({
  document: doc,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isApproving = false,
  isRejecting = false,
  isDocumentBusy = false,
  onDocumentLoad,
  attachments = [],
  onSelectAttachment,
}: PDFPreviewDialogProps) {
  const [supportSelection, setSupportSelection] = useState<{
    id: string | null;
    value: boolean;
  }>({ id: null, value: false });
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfControls, setPdfControls] = useState<PdfControlsState>(INITIAL_PDF_CONTROLS);

  // Convertir el contenido del documento a una URL utilizable por el iframe.
  const pdfUrl = useMemo(() => {
    const fileUrl = doc?.fileUrl;
    if (!fileUrl) return null;

    if (
      fileUrl.startsWith("data:") ||
      fileUrl.startsWith("http") ||
      fileUrl.startsWith("blob:")
    ) {
      return fileUrl;
    }

    // Si llega como base64 sin prefijo, se envuelve como data URL de PDF.
    return `data:application/pdf;base64,${fileUrl}`;
  }, [doc?.fileUrl]);

  if (!doc) return null;

  const mostrarDocumentoSoporte =
    supportSelection.id === doc.id ? supportSelection.value : false;

  const handleSelectSupport = async (value: boolean) => {
    setSupportSelection({ id: doc.id, value });

    if (!doc.tieneDocumentoLigado || !onDocumentLoad) return;

    setIsLoadingDocument(true);
    try {
      await onDocumentLoad(doc.id, value);
    } catch {
      // La página que carga el documento reporta el error al usuario.
    } finally {
      setIsLoadingDocument(false);
    }
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;

    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const htmlDocument = globalThis.document;
      const link = htmlDocument.createElement("a");
      link.href = downloadUrl;
      link.download = `${doc.id}.pdf`;
      htmlDocument.body.appendChild(link);
      link.click();
      htmlDocument.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    } catch {
      // Si el navegador bloquea la descarga, el usuario puede abrir el PDF en otra pestaña.
    }
  };

  const handleOpenInTab = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleApproveClick = () => {
    if (!onApprove) return;
    onOpenChange(false);
    onApprove(doc);
  };

  const handleRejectClick = () => {
    if (!onReject) return;
    onOpenChange(false);
    onReject(doc);
  };

  const canApprove = doc.status === "pending" && !!onApprove;
  const canReject = doc.status === "pending" && !!onReject;
  const isActionDisabled =
    doc.status !== "pending" || isDocumentBusy || isApproving || isRejecting;
  const metaItems = [
    { icon: User, label: "Emitido por", value: doc.uploadedBy ?? "Desconocido" },
    { icon: Calendar, label: "Fecha de carga", value: formatDate(doc.uploadDate) },
  ];
  const formattedSize = formatFileSize(doc.size);
  const statusConfig = STATUS_CONFIG[doc.status];
  const principales = attachments.filter(
    (a) => (a.tipoDocumento || "Principal").toLowerCase() === "principal"
  );
  const anexos = attachments.filter(
    (a) => (a.tipoDocumento || "Principal").toLowerCase() !== "principal"
  );

  // Pantalla completa: segundo diálogo sin bordes que ocupa todo el viewport.
  if (isFullscreen) {
    return (
      <Dialog open={true} onOpenChange={() => setIsFullscreen(false)}>
        <DialogContent
          showCloseButton={false}
          className="!w-screen !max-w-none h-screen max-h-screen !m-0 flex flex-col p-0 gap-0 rounded-none border-0 !overflow-hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Vista previa del documento {doc.customName || doc.name}</DialogTitle>
            <DialogDescription>Documento en modo pantalla completa</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-gray-100 dark:bg-gray-900 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-2 right-2 z-50 text-primary hover:text-primary/80 hover:bg-background/80 backdrop-blur-sm"
              title="Salir de pantalla completa"
            >
              <X className="h-5 w-5" />
            </Button>
            {pdfUrl ? (
              <PdfViewerPane
                key={`${doc.id}-${mostrarDocumentoSoporte ? "support" : "primary"}-fullscreen`}
                src={pdfUrl}
                onControlsChange={setPdfControls}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-20 w-20 mb-4 opacity-50" />
                <p className="text-lg font-medium">Vista previa no disponible</p>
                <p className="text-sm mt-2">El archivo no está disponible para visualización</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[99vw] !max-w-none h-[99vh] max-h-[99vh] flex flex-col p-0 gap-0 m-0 rounded-none [&>button]:text-primary [&>button]:hover:text-primary/80 fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background z-[100] !overflow-hidden">
        <DialogHeader className="relative border-b shrink-0">
          <DialogTitle className="sr-only">Vista previa del documento</DialogTitle>
          <DialogDescription className="sr-only">
            Visualiza y gestiona el documento seleccionado
          </DialogDescription>

          {/* Botón de maximizar al lado del cierre del diálogo */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(true)}
            disabled={!pdfControls.isDocumentLoaded}
            className="absolute top-4 right-12 z-10 h-6 w-6 text-primary hover:text-primary/80 hover:bg-muted/50"
            title="Maximizar"
          >
            <Maximize className="h-4 w-4" />
          </Button>

          {/* Header compacto para móvil */}
          <div className="block md:hidden">
            <div className="pl-0 pr-12 py-0 flex items-center gap-1">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-2 w-2 shrink-0" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="shrink-0 truncate max-w-[80px] cursor-help">
                          {(doc.customName || doc.name).length > 12
                            ? `${(doc.customName || doc.name).substring(0, 12)}...`
                            : doc.customName || doc.name}
                        </span>
                      </TooltipTrigger>
                      {(doc.customName || doc.name).length > 12 && (
                        <TooltipContent>
                          <p className="max-w-xs">{doc.customName || doc.name}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <Badge
                    variant={statusConfig.variant}
                    className="text-[9px] font-semibold px-1 py-0 shrink-0"
                  >
                    {statusConfig.label}
                  </Badge>
                  {/* Controles PDF integrados */}
                  <div className="flex items-center gap-0.5 ml-auto shrink-0">
                    <div className="flex items-center gap-0.5">
                      <PanelLeft className="h-1.5 w-1.5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {pdfControls.pageNumber}/{pdfControls.numPages || 0}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => pdfControls.changePage(-1)}
                      disabled={!pdfControls.isDocumentLoaded || pdfControls.pageNumber <= 1}
                      className="h-[18px] w-[18px] p-0 min-w-0 min-h-0 rounded-sm"
                      title="Página anterior"
                    >
                      <ChevronLeft className="h-[10px] w-[10px]" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => pdfControls.changePage(1)}
                      disabled={
                        !pdfControls.isDocumentLoaded ||
                        pdfControls.pageNumber >= pdfControls.numPages
                      }
                      className="h-[18px] w-[18px] p-0 min-w-0 min-h-0 rounded-sm"
                      title="Página siguiente"
                    >
                      <ChevronRight className="h-[10px] w-[10px]" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => pdfControls.zoomOut()}
                      disabled={!pdfControls.isDocumentLoaded}
                      className="h-[18px] w-[18px] p-0 min-w-0 min-h-0 rounded-sm"
                      title="Alejar"
                    >
                      <ZoomOut className="h-[10px] w-[10px]" />
                    </Button>
                    <div className="flex items-center justify-center h-1 px-0.5 bg-primary/10 border border-primary/20 rounded text-primary">
                      <span className="text-[4px] font-mono font-bold">
                        {pdfControls.scale}%
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => pdfControls.zoomIn()}
                      disabled={!pdfControls.isDocumentLoaded}
                      className="h-[18px] w-[18px] p-0 min-w-0 min-h-0 rounded-sm"
                      title="Acercar"
                    >
                      <ZoomIn className="h-[10px] w-[10px]" />
                    </Button>
                    <div className="h-1 w-px bg-border mx-0.5" />
                    <Button
                      variant="outline"
                      onClick={() => pdfControls.toggleThumbnails()}
                      disabled={!pdfControls.isDocumentLoaded}
                      aria-pressed={pdfControls.showThumbnails}
                      className={cn(
                        "h-[18px] w-[18px] p-0 min-w-0 min-h-0 rounded-sm",
                        pdfControls.showThumbnails && "bg-primary/10 text-primary"
                      )}
                      title="Ver páginas"
                    >
                      <FileText className="h-[10px] w-[10px]" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => pdfControls.print()}
                      disabled={!pdfControls.isDocumentLoaded || pdfControls.isPrinting}
                      className="h-[18px] w-[18px] p-0 min-w-0 min-h-0 rounded-sm"
                      title="Imprimir"
                    >
                      {pdfControls.isPrinting ? (
                        <Loader2 className="h-[10px] w-[10px] animate-spin" />
                      ) : (
                        <Printer className="h-[10px] w-[10px]" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleOpenInTab}
                      disabled={!pdfControls.isDocumentLoaded}
                      className="h-[18px] w-[18px] p-0 min-w-0 min-h-0 rounded-sm"
                      title="Abrir en otra pestaña"
                    >
                      <ExternalLink className="h-[10px] w-[10px]" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownload}
                      disabled={!pdfControls.isDocumentLoaded}
                      className="h-[18px] w-[18px] p-0 min-w-0 min-h-0 rounded-sm"
                      title="Descargar"
                    >
                      <Download className="h-[10px] w-[10px]" />
                    </Button>
                    <div className="flex items-center justify-center h-1 px-0.5 bg-muted/50 border border-border rounded text-muted-foreground">
                      <span className="text-[4px] font-mono font-medium">
                        {formattedSize}
                      </span>
                    </div>
                  </div>
                </div>
                {doc.observations && (
                  <div className="text-[9px] leading-tight text-muted-foreground truncate">
                    <span className="text-foreground font-medium">Observaciones:</span>{" "}
                    {doc.observations}
                  </div>
                )}
              </div>
            </div>

            {/* Detalles y acciones en móvil */}
            <Accordion type="single" collapsible className="border-t">
              <AccordionItem value="details" className="border-0">
                <AccordionTrigger className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                  Ver detalles y controles
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-1">
                  <div className="flex flex-wrap gap-2 text-[10px] items-center">
                    {metaItems.map(({ icon: MetaIcon, label, value }) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className="gap-1 rounded-full px-2 py-0.5 font-medium"
                      >
                        <MetaIcon className="h-2.5 w-2.5 opacity-70" />
                        {value}
                      </Badge>
                    ))}
                    {doc.tieneDocumentoLigado && (
                      <div className="inline-flex items-center rounded border border-border bg-muted/30 p-0 overflow-hidden">
                        <button
                          onClick={() => handleSelectSupport(false)}
                          disabled={isLoadingDocument}
                          className={cn(
                            "px-1 py-0.5 text-[7px] font-medium transition-all duration-200 h-4 flex items-center justify-center leading-none",
                            !mostrarDocumentoSoporte
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          Original
                        </button>
                        <button
                          onClick={() => handleSelectSupport(true)}
                          disabled={isLoadingDocument}
                          className={cn(
                            "px-1 py-0.5 text-[7px] font-medium transition-all duration-200 h-4 flex items-center justify-center leading-none",
                            mostrarDocumentoSoporte
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          Soporte
                        </button>
                        {isLoadingDocument && (
                          <Loader2 className="ml-0.5 h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    )}
                    {(canApprove || canReject) && (
                      <div className="flex gap-1">
                        {canApprove && (
                          <Button
                            size="sm"
                            onClick={handleApproveClick}
                            disabled={isActionDisabled}
                            className={cn(
                              "h-6 px-2 text-[10px] text-white gap-1 disabled:opacity-75 font-medium",
                              doc.tieneDocumentoLigado
                                ? "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                                : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                            )}
                          >
                            {isApproving ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-2.5 w-2.5" />
                            )}
                            <span>Aprobar</span>
                          </Button>
                        )}
                        {canReject && (
                          <Button
                            size="sm"
                            onClick={handleRejectClick}
                            disabled={isActionDisabled}
                            className="h-6 px-2 text-[10px] bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white gap-1 disabled:opacity-75 font-medium"
                          >
                            {isRejecting && !isApproving ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <XCircle className="h-2.5 w-2.5" />
                            )}
                            <span>Rechazar</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Header compacto para escritorio */}
          <div className="hidden md:flex flex-col gap-2 px-2 py-1 border-b border-border/60 bg-background/80 backdrop-blur">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="max-w-[140px] truncate cursor-help font-medium text-[11px]">
                      {doc.customName || doc.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{doc.customName || doc.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge
                variant={statusConfig.variant}
                className="text-[10px] px-1 py-0 shrink-0 h-4"
              >
                {statusConfig.label}
              </Badge>

              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {metaItems.map(({ icon: MetaIcon, value }) => (
                  <span key={value} className="flex items-center gap-0.5">
                    <MetaIcon className="h-2.5 w-2.5 opacity-70" />
                    <span className="whitespace-nowrap">{value}</span>
                  </span>
                ))}
                {doc.observations && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1 py-0.5 h-4 max-w-[300px] ml-1"
                  >
                    <MessageSquare className="h-2 w-2 mr-0.5" />
                    <span className="truncate">{doc.observations}</span>
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <PanelLeft className="h-2 w-2 text-muted-foreground" />
              <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                {pdfControls.pageNumber}/{pdfControls.numPages || 0}
              </span>
              <Button
                variant="outline"
                onClick={() => pdfControls.changePage(-1)}
                disabled={!pdfControls.isDocumentLoaded || pdfControls.pageNumber <= 1}
                className="h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm"
                title="Página anterior"
              >
                <ChevronLeft className="h-[12px] w-[12px]" />
              </Button>
              <Button
                variant="outline"
                onClick={() => pdfControls.changePage(1)}
                disabled={
                  !pdfControls.isDocumentLoaded || pdfControls.pageNumber >= pdfControls.numPages
                }
                className="h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm"
                title="Página siguiente"
              >
                <ChevronRight className="h-[12px] w-[12px]" />
              </Button>

              <div className="h-2 w-px bg-border mx-0.5" />

              <Button
                variant="outline"
                onClick={() => pdfControls.zoomOut()}
                disabled={!pdfControls.isDocumentLoaded}
                className="h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm"
                title="Alejar"
              >
                <ZoomOut className="h-[12px] w-[12px]" />
              </Button>
              <span className="text-[10px] font-mono font-bold text-primary px-1 bg-primary/5 rounded">
                {pdfControls.scale}%
              </span>
              <Button
                variant="outline"
                onClick={() => pdfControls.zoomIn()}
                disabled={!pdfControls.isDocumentLoaded}
                className="h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm"
                title="Acercar"
              >
                <ZoomIn className="h-[12px] w-[12px]" />
              </Button>
              <Button
                variant="outline"
                onClick={() => pdfControls.fitWidth()}
                disabled={!pdfControls.isDocumentLoaded}
                className="h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm"
                title="Ajustar"
              >
                <Maximize2 className="h-[12px] w-[12px]" />
              </Button>

              <div className="h-2 w-px bg-border mx-0.5" />

              <Button
                variant="outline"
                onClick={() => pdfControls.toggleThumbnails()}
                disabled={!pdfControls.isDocumentLoaded}
                className={cn(
                  "h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm",
                  pdfControls.showThumbnails && "bg-primary/10 text-primary"
                )}
                title="Ver páginas"
              >
                <FileText className="h-[12px] w-[12px]" />
              </Button>
              <Button
                variant="outline"
                onClick={() => pdfControls.print()}
                disabled={!pdfControls.isDocumentLoaded || pdfControls.isPrinting}
                className="h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm"
                title="Imprimir"
              >
                {pdfControls.isPrinting ? (
                  <Loader2 className="h-[12px] w-[12px] animate-spin" />
                ) : (
                  <Printer className="h-[12px] w-[12px]" />
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenInTab}
                disabled={!pdfControls.isDocumentLoaded}
                className="h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm"
                title="Abrir en otra pestaña"
              >
                <ExternalLink className="h-[12px] w-[12px]" />
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={!pdfControls.isDocumentLoaded}
                className="h-[22px] w-[22px] p-0 min-w-0 min-h-0 rounded-sm"
                title="Descargar"
              >
                <Download className="h-[12px] w-[12px]" />
              </Button>

              {doc.tieneDocumentoLigado && (
                <div className="inline-flex items-center rounded border border-border bg-muted/30 p-0 shrink-0 h-[16px] ml-1 overflow-hidden">
                  <button
                    onClick={() => handleSelectSupport(false)}
                    disabled={isLoadingDocument}
                    className={cn(
                      "px-2 py-0 text-[8px] font-medium h-[16px] w-auto flex items-center justify-center leading-none",
                      !mostrarDocumentoSoporte
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => handleSelectSupport(true)}
                    disabled={isLoadingDocument}
                    className={cn(
                      "px-2 py-0 text-[8px] font-medium h-[16px] w-auto flex items-center justify-center leading-none",
                      mostrarDocumentoSoporte
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    Soporte
                  </button>
                  {isLoadingDocument && (
                    <Loader2 className="ml-0.5 h-2 w-2 animate-spin" />
                  )}
                </div>
              )}

              {(canApprove || canReject) && (
                <>
                  <div className="h-2.5 w-px bg-border mx-0.5" />
                  {canApprove && (
                    <Button
                      size="sm"
                      onClick={handleApproveClick}
                      disabled={isActionDisabled}
                      className={cn(
                        "h-[22px] px-3 text-[11px] text-white gap-1 disabled:opacity-75 font-medium",
                        doc.tieneDocumentoLigado
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-green-600 hover:bg-green-700"
                      )}
                    >
                      {isApproving ? (
                        <Loader2 className="h-[12px] w-[12px] animate-spin" />
                      ) : (
                        <CheckCircle className="h-[12px] w-[12px]" />
                      )}
                      <span>Aprobar</span>
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      size="sm"
                      onClick={handleRejectClick}
                      disabled={isActionDisabled}
                      className="h-[22px] px-3 text-[11px] bg-red-600 hover:bg-red-700 text-white gap-1 disabled:opacity-75 font-medium"
                    >
                      {isRejecting && !isApproving ? (
                        <Loader2 className="h-[12px] w-[12px] animate-spin" />
                      ) : (
                        <XCircle className="h-[12px] w-[12px]" />
                      )}
                      <span>Rechazar</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Vista previa del PDF */}
        <div className="flex-1 min-h-0 overflow-hidden flex">
          <aside className="hidden md:flex w-64 border-r border-border/60 bg-muted/30 flex-col">
            <div className="px-3 py-2 border-b border-border/60">
              <p className="text-xs font-semibold text-foreground">Documentos del grupo</p>
              <p className="text-[11px] text-muted-foreground">Selecciona para previsualizar</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">
                    Para firmar
                  </p>
                  {principales.length === 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      Sin documentos principales
                    </div>
                  )}
                  {principales.map((item) => {
                    const active = doc.id === item.idDocumento;
                    return (
                      <button
                        key={item.idDocumento}
                        onClick={() => onSelectAttachment?.(item.idDocumento)}
                        className={cn(
                          "w-full text-left text-xs px-2 py-1.5 rounded border transition flex items-center gap-2",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-transparent hover:bg-muted"
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.nombreArchivo}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">
                    Anexos
                  </p>
                  {anexos.length === 0 && (
                    <div className="text-[11px] text-muted-foreground">Sin anexos</div>
                  )}
                  {anexos.map((item) => {
                    const active = doc.id === item.idDocumento;
                    return (
                      <button
                        key={item.idDocumento}
                        onClick={() => onSelectAttachment?.(item.idDocumento)}
                        className={cn(
                          "w-full text-left text-xs px-2 py-1.5 rounded border transition flex items-center gap-2",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-transparent hover:bg-muted"
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{item.nombreArchivo}</span>
                          <span className="text-[10px] text-muted-foreground">Anexo</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </aside>

          <div className="flex-1 min-h-0 overflow-hidden relative">
            {pdfUrl ? (
              <PdfViewerPane
                key={`${doc.id}-${mostrarDocumentoSoporte ? "support" : "primary"}`}
                src={pdfUrl}
                onControlsChange={setPdfControls}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-20 w-20 mb-4 opacity-50" />
                <p className="text-lg font-medium">Vista previa no disponible</p>
                <p className="text-sm mt-2">El archivo no está disponible para visualización</p>
              </div>
            )}
            {isDocumentBusy && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PdfViewerPane({
  src,
  onControlsChange,
}: {
  src: string;
  onControlsChange?: (controls: PdfControlsState) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);
  const [pageNumber] = useState(1);
  const [numPages] = useState(0);
  const [scale] = useState(100);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // El iframe no expone su paginación: estas acciones las resuelve el visor del navegador.
  const changePage = useCallback<(delta: number) => void>(() => {}, []);
  const handleZoomIn = useCallback(() => {}, []);
  const handleZoomOut = useCallback(() => {}, []);
  const handleFitWidth = useCallback(() => {}, []);

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const handlePrint = useCallback(() => {
    if (!iframeRef.current?.contentWindow || isPrinting) return;
    setIsPrinting(true);
    try {
      iframeRef.current.contentWindow.print();
    } finally {
      setTimeout(() => setIsPrinting(false), 1000);
    }
  }, [isPrinting]);

  const toggleThumbnails = useCallback(() => {
    setShowThumbnails((prev) => !prev);
  }, []);

  useEffect(() => {
    onControlsChange?.({
      pageNumber,
      numPages,
      isDocumentLoaded,
      scale,
      changePage,
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      fitWidth: handleFitWidth,
      print: handlePrint,
      isPrinting,
      toggleThumbnails,
      showThumbnails,
    });
  }, [
    pageNumber,
    numPages,
    isDocumentLoaded,
    scale,
    changePage,
    onControlsChange,
    handleZoomIn,
    handleZoomOut,
    handleFitWidth,
    handlePrint,
    isPrinting,
    toggleThumbnails,
    showThumbnails,
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-full flex-1 overflow-hidden">
        {showThumbnails && (
          <div className="z-10 flex w-48 flex-col border-r border-border bg-background/95 shadow-md">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium text-foreground">Paginas</span>
              <Button
                variant="ghost"
                onClick={toggleThumbnails}
                className="h-7 w-7 p-0"
                aria-label="Ocultar paginado"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Usa el visor para navegar</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
          <iframe
            ref={iframeRef}
            src={src}
            className="h-full w-full border-0"
            title="Vista previa del documento"
            onLoad={() => setIsDocumentLoaded(true)}
          />
          {!isDocumentLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Cargando PDF...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
