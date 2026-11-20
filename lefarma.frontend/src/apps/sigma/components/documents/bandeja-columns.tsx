import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, CheckCircle, XCircle, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { Document, DocumentStatus } from "@/apps/sigma/lib/documents";

export type BandejaColumnsContext = {
  onPreview?: (document: Document) => void;
  onApprove?: (document: Document) => void;
  onReject?: (document: Document) => void;
  loadingDocumentId?: string | null;
  showAttentionComments?: boolean;
};

const statusConfig: Record<
  DocumentStatus,
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

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "Fecha no disponible";

  try {
    const dateObj = date instanceof Date ? date : new Date(date);

    // Verificar si la fecha es válida
    if (isNaN(dateObj.getTime())) {
      return "Fecha inválida";
    }

    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Fecha inválida";
  }
};

const OBSERVATION_TRUNCATE_LIMIT = 120;
const OBSERVATION_COLUMN_WIDTH = "w-[320px] min-w-[320px]";

export const createBandejaColumns = (
  context?: BandejaColumnsContext,
  options?: { includeActions?: boolean }
): ColumnDef<Document>[] => {
  const includeActions = options?.includeActions ?? true;
  const baseColumns: ColumnDef<Document>[] = [];

  if (includeActions) {
    baseColumns.push({
      id: "actions",
      header: () => <div className="text-xs">Acciones</div>,
      cell: ({ row }) => {
        const document = row.original;
        const isLoading = context?.loadingDocumentId === document.id;

        if (document.status === "approved" || document.status === "rejected") {
          return null;
        }

        return (
          <div className="flex items-center gap-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className={`h-6 px-1 py-0 gap-0.5 text-xs min-w-[50px] ${
                      document.tieneDocumentoLigado
                        ? "text-blue-600 border-blue-600 hover:bg-blue-600"
                        : "text-green-600 border-green-600 hover:bg-green-600"
                    } hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                    onClick={() => !isLoading && context?.onApprove?.(document)}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle className="h-2.5 w-2.5" />
                    )}
                    <span className="text-[10px]">Aprobar</span>
                  </Button>
                </TooltipTrigger>
                {document.tieneDocumentoLigado && (
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Este documento tiene un documento de soporte ligado que también será autorizado y visualizado
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="h-6 px-1 py-0 gap-0.5 text-xs min-w-[50px] text-red-600 border-red-600 hover:bg-red-600 hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => !isLoading && context?.onReject?.(document)}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="h-2.5 w-2.5" />
              )}
              <span className="text-[10px]">Rechazar</span>
            </Button>
          </div>
        );
      },
      meta: {
        sticky: "left",
      },
    });
  }

  baseColumns.push(
    {
    accessorKey: "observations",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1 text-xs"
        >
          <span className="max-w-[260px] truncate inline-block" title="Motivo para solicitud de autorización">
            Motivo para solicitud de autorización
          </span>
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const document = row.original;
      const displayName = document.observations || document.name;
      const isLoading = context?.loadingDocumentId === document.id;
      const hasSupportDoc = document.tieneDocumentoLigado;
      const shouldTruncate = displayName.length > OBSERVATION_TRUNCATE_LIMIT;
      const truncatedText = shouldTruncate
        ? displayName.substring(0, OBSERVATION_TRUNCATE_LIMIT) + "..."
        : displayName;

      return (
        <div className="flex items-center gap-2 max-w-[340px] truncate">
          <HoverCard>
            <HoverCardTrigger asChild>
              <button
              onClick={() => !isLoading && context?.onPreview?.(document)}
              disabled={isLoading}
              className={`font-medium text-primary hover:text-primary/80 cursor-pointer text-left flex items-center gap-2 max-w-[320px] truncate text-xs ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {hasSupportDoc && (
                <Paperclip className="h-3.5 w-3.5 text-sky-500 dark:text-sky-300 shrink-0" />
              )}
                {truncatedText}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-96">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Motivo completo para solicitud de autorización</h4>
                <p className="text-sm whitespace-pre-wrap break-words">{displayName}</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      );
    },
    meta: {
      className: OBSERVATION_COLUMN_WIDTH,
      headerClassName: OBSERVATION_COLUMN_WIDTH,
      cellClassName: OBSERVATION_COLUMN_WIDTH,
    },
  },
  {
    accessorKey: "uploadedBy",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1 text-xs"
        >
          Subido por
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const uploadedBy = String(row.getValue("uploadedBy") ?? "");
      return (
        <div className="text-muted-foreground max-w-[160px] truncate" title={uploadedBy}>
          {uploadedBy}
        </div>
      );
    },
    meta: {
      className: "w-[160px] min-w-[160px]",
      headerClassName: "w-[160px] min-w-[160px]",
    },
  },
  {
    accessorKey: "uploadDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1 text-xs"
        >
          Fecha de subida
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const fecha = formatDate(row.getValue("uploadDate"));
      return (
        <div className="text-muted-foreground whitespace-nowrap" title={fecha}>
          {fecha}
        </div>
      );
    },
    meta: {
      className: "w-[165px] min-w-[165px]",
      headerClassName: "w-[165px] min-w-[165px]",
    },
  },
  {
    accessorKey: "status",
    header: () => <div className="text-xs">Estado</div>,
    cell: ({ row }) => {
      const status = row.getValue("status") as DocumentStatus;
      const config = statusConfig[status];
      
      // Clase personalizada para estado aprobado (verde)
      if (status === "approved") {
        return (
          <Badge 
            variant="outline" 
            className="text-xs px-1.5 py-0 max-w-[80px] truncate bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
          >
            {config.label}
          </Badge>
        );
      }
      
      return <Badge variant={config.variant} className="text-xs px-1.5 py-0 max-w-[80px] truncate">{config.label}</Badge>;
    },
  }
  );

  // Agregar columna de comentarios de atención solo si showAttentionComments es true
  if (context?.showAttentionComments) {
    baseColumns.push({
      accessorKey: "attentionComments",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-7 px-1 text-xs"
          >
            <span className="max-w-[180px] truncate inline-block" title="Comentario de autorización/rechazo">
              Comentario de autorización/rechazo
            </span>
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const document = row.original;
        const attentionText = document.attentionComments || "";
        const truncatedText =
          attentionText.length > 40
            ? attentionText.substring(0, 40) + "..."
            : attentionText;

        if (!attentionText) {
          return (
            <div className="text-muted-foreground text-sm max-w-[120px] truncate text-center">
              -
            </div>
          );
        }

        return (
          <div className="text-muted-foreground max-w-[170px] truncate">
            {attentionText.length > 40 ? (
              <HoverCard>
                <HoverCardTrigger asChild>
                  <span
                    className="w-full truncate text-left text-muted-foreground text-xs inline-block"
                  >
                    {truncatedText}
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">
                      Comentario completo de autorización/rechazo
                    </h4>
                    <p className="text-sm">{attentionText}</p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <span className="text-xs" title={attentionText}>
                {attentionText}
              </span>
            )}
          </div>
        );
      },
    });
  }

  return baseColumns;
};
