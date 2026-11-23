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
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize,
  MessageSquare,
  Printer,
  User,
  X,
  XCircle,
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
  const nombreCompleto = doc.customName || doc.name;
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    nombreCompleto
  );
  const displayName = esUuid ? `Documento ${nombreCompleto.slice(0, 8)}` : nombreCompleto;
  const principales = attachments.filter(
    (a) => (a.tipoDocumento || "Principal").toLowerCase() === "principal"
  );
  const anexos = attachments.filter(
    (a) => (a.tipoDocumento || "Principal").toLowerCase() !== "principal"
  );

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

          {}
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

          {}
          <div className="block md:hidden">
            <div className="flex items-start gap-3 px-3 pb-2 pt-2 pr-14">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate text-[13px] font-semibold text-foreground cursor-help">
                          {displayName}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{doc.customName || doc.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Badge
                    variant={statusConfig.variant}
                    className="shrink-0 text-[10px] font-semibold"
                  >
                    {statusConfig.label}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <User className="h-3 w-3 shrink-0 opacity-70" />
                  <span className="truncate">{doc.uploadedBy ?? "Desconocido"}</span>
                  <span className="text-border">•</span>
                  <span className="shrink-0">{formattedSize}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 pb-3">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 shadow-sm">
                <Button
                  variant="ghost"
                  onClick={() => pdfControls.print()}
                  disabled={!pdfControls.isDocumentLoaded || pdfControls.isPrinting}
                  className="h-7 w-7 rounded-md p-0"
                  title="Imprimir"
                >
                  {pdfControls.isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleOpenInTab}
                  disabled={!pdfControls.isDocumentLoaded}
                  className="h-7 w-7 rounded-md p-0"
                  title="Abrir en otra pestaña"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDownload}
                  disabled={!pdfControls.isDocumentLoaded}
                  className="h-7 w-7 rounded-md p-0"
                  title="Descargar"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>

              {doc.tieneDocumentoLigado && (
                <div className="ml-auto inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleSelectSupport(false)}
                    disabled={isLoadingDocument}
                    aria-pressed={!mostrarDocumentoSoporte}
                    title="Ver el documento original"
                    className={cn(
                      "flex h-full items-center justify-center rounded-md px-3 text-[11px] font-semibold leading-none transition-colors",
                      !mostrarDocumentoSoporte
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/70 hover:bg-background hover:text-foreground"
                    )}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSupport(true)}
                    disabled={isLoadingDocument}
                    aria-pressed={mostrarDocumentoSoporte}
                    title="Ver el documento de soporte"
                    className={cn(
                      "flex h-full items-center justify-center rounded-md px-3 text-[11px] font-semibold leading-none transition-colors",
                      mostrarDocumentoSoporte
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/70 hover:bg-background hover:text-foreground"
                    )}
                  >
                    Soporte
                  </button>
                  {isLoadingDocument && (
                    <Loader2 className="ml-0.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </div>

            {doc.observations && (
              <div className="border-t border-border/60 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">Observaciones:</span>{" "}
                {doc.observations}
              </div>
            )}

            {}
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
                        <MetaIcon className="h-3.5 w-3.5 opacity-70" />
                        {value}
                      </Badge>
                    ))}
                    {(canApprove || canReject) && (
                      <div className="flex gap-1">
                        {canApprove && (
                          <Button
                            size="sm"
                            onClick={handleApproveClick}
                            disabled={isActionDisabled}
                            className={cn(
                              "h-8 px-3 text-[11px] text-white gap-1.5 disabled:opacity-75 font-medium",
                              doc.tieneDocumentoLigado
                                ? "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                                : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                            )}
                          >
                            {isApproving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            <span>Aprobar</span>
                          </Button>
                        )}
                        {canReject && (
                          <Button
                            size="sm"
                            onClick={handleRejectClick}
                            disabled={isActionDisabled}
                            className="h-8 px-3 text-[11px] bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white gap-1.5 disabled:opacity-75 font-medium"
                          >
                            {isRejecting && !isApproving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
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

          {}
          <div className="hidden md:flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-background/80 px-3 py-1.5 pr-20 backdrop-blur">
            <div className="flex min-w-[240px] flex-1 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex min-w-0 flex-col justify-center">
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="max-w-[280px] truncate cursor-help text-[13px] font-semibold text-foreground">
                          {displayName}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{doc.customName || doc.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Badge
                    variant={statusConfig.variant}
                    className="shrink-0 text-[10px] font-semibold"
                  >
                    {statusConfig.label}
                  </Badge>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  {metaItems.map(({ icon: MetaIcon, value }) => (
                    <span key={value} className="flex items-center gap-1">
                      <MetaIcon className="h-3 w-3 opacity-70" />
                      <span className="whitespace-nowrap">{value}</span>
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 font-medium text-foreground/80">
                    {formattedSize}
                  </span>
                </div>
              </div>
              {doc.observations && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-auto inline-flex min-w-0 max-w-[280px] cursor-help items-center">
                        <Badge
                          variant="secondary"
                          className="h-6 min-w-0 max-w-full gap-1 px-2 text-[10px] font-medium"
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{doc.observations}</span>
                        </Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="whitespace-pre-wrap break-words">{doc.observations}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 shadow-sm">
                <Button
                  variant="ghost"
                  onClick={() => pdfControls.print()}
                  disabled={!pdfControls.isDocumentLoaded || pdfControls.isPrinting}
                  className="h-7 w-7 rounded-md p-0"
                  title="Imprimir"
                >
                  {pdfControls.isPrinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleOpenInTab}
                  disabled={!pdfControls.isDocumentLoaded}
                  className="h-7 w-7 rounded-md p-0"
                  title="Abrir en otra pestaña"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDownload}
                  disabled={!pdfControls.isDocumentLoaded}
                  className="h-7 w-7 rounded-md p-0"
                  title="Descargar"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>

              {doc.tieneDocumentoLigado && (
                <div className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleSelectSupport(false)}
                    disabled={isLoadingDocument}
                    aria-pressed={!mostrarDocumentoSoporte}
                    title="Ver el documento original"
                    className={cn(
                      "flex h-full items-center justify-center rounded-md px-3 text-[11px] font-semibold leading-none transition-colors",
                      !mostrarDocumentoSoporte
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/70 hover:bg-background hover:text-foreground"
                    )}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSupport(true)}
                    disabled={isLoadingDocument}
                    aria-pressed={mostrarDocumentoSoporte}
                    title="Ver el documento de soporte"
                    className={cn(
                      "flex h-full items-center justify-center rounded-md px-3 text-[11px] font-semibold leading-none transition-colors",
                      mostrarDocumentoSoporte
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/70 hover:bg-background hover:text-foreground"
                    )}
                  >
                    Soporte
                  </button>
                  {isLoadingDocument && (
                    <Loader2 className="ml-0.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
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
                        "h-7 px-3 text-xs text-white gap-1.5 disabled:opacity-75 font-medium",
                        doc.tieneDocumentoLigado
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-green-600 hover:bg-green-700"
                      )}
                    >
                      {isApproving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      <span>Aprobar</span>
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      size="sm"
                      onClick={handleRejectClick}
                      disabled={isActionDisabled}
                      className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white gap-1.5 disabled:opacity-75 font-medium"
                    >
                      {isRejecting && !isApproving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span>Rechazar</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {}
        <div className="flex-1 min-h-0 overflow-hidden flex">
          <aside
            className={cn(
              "border-r border-border/60 bg-muted/30 flex-col",
              attachments.length > 0 ? "hidden md:flex w-56" : "hidden"
            )}
          >
            <div className="px-2.5 py-1.5 border-b border-border/60">
              <p className="text-xs font-semibold text-foreground">Documentos del grupo</p>
              <p className="text-[11px] text-muted-foreground">Selecciona para previsualizar</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-1.5 space-y-2">
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
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    setIsDocumentLoaded(false);
  }, [src]);

  const handlePrint = useCallback(() => {
    const frame = frameRef.current;
    if (!frame?.contentWindow || isPrinting) return;
    setIsPrinting(true);
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      window.setTimeout(() => setIsPrinting(false), 1200);
    }
  }, [isPrinting, src]);

  useEffect(() => {
    onControlsChange?.({
      pageNumber: 1,
      numPages: 0,
      isDocumentLoaded,
      scale: 100,
      changePage: () => {},
      zoomIn: () => {},
      zoomOut: () => {},
      fitWidth: () => {},
      print: handlePrint,
      isPrinting,
      toggleThumbnails: () => {},
      showThumbnails: false,
    });
  }, [isDocumentLoaded, isPrinting, handlePrint, onControlsChange]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/30">
      <iframe
        ref={frameRef}
        src={src}
        title="Vista previa del documento"
        className="h-full w-full border-0"
        onLoad={() => setIsDocumentLoaded(true)}
      />
    </div>
  );
}