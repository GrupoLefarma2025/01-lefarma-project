import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Loader2, Trash2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Document, DocumentStatus } from "@/apps/sigma/lib/documents";

export type SubidaColumnsContext = {
  onPreview?: (document: Document) => void;
  onDelete?: (document: Document) => void;
  onRefresh?: () => Promise<void>;
  loadingDocumentId?: string | null;
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

const MOTIVO_TRUNCATE_LIMIT = 120;
const MOTIVO_COLUMN_WIDTH = "w-[260px] min-w-[260px]";

export const createSubidaColumns = (
  context?: SubidaColumnsContext
): ColumnDef<Document>[] => [
  {
    accessorKey: "observations",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto w-full flex items-center justify-between gap-1 px-2 py-2 text-xs font-semibold"
        >
          <span className="flex-1 text-center">Motivos de autorización</span>
          <ArrowUpDown className="h-3 w-3 shrink-0" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const document = row.original;
      const displayName = document.observations || document.name;
      const isLoading = context?.loadingDocumentId === document.id;
      const isAnyLoading = !!context?.loadingDocumentId;
      const hasSupportDoc = document.tieneDocumentoLigado;
      const shouldTruncate = displayName.length > MOTIVO_TRUNCATE_LIMIT;
      const truncatedText = shouldTruncate
        ? displayName.substring(0, MOTIVO_TRUNCATE_LIMIT) + "..."
        : displayName;

      return (
        <div className="flex items-center gap-2 w-full">
          <HoverCard>
            <HoverCardTrigger asChild>
              <button
                onClick={() => !isAnyLoading && context?.onPreview?.(document)}
                disabled={isAnyLoading}
                className={`font-medium text-primary hover:text-primary/80 cursor-pointer text-left flex items-center gap-2 w-full truncate text-sm ${
                  isAnyLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {hasSupportDoc && (
                  <Paperclip className="h-3 w-3 text-sky-500 dark:text-sky-300 shrink-0" />
                )}
                <span className={shouldTruncate ? "truncate" : "whitespace-normal"}>
                  {truncatedText}
                </span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-96">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Motivo completo</h4>
                <p className="text-sm whitespace-pre-wrap break-words">{displayName}</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      );
    },
    meta: {
      className: MOTIVO_COLUMN_WIDTH,
      headerClassName: `px-2 !whitespace-normal text-center ${MOTIVO_COLUMN_WIDTH}`,
      cellClassName: "px-2",
    },
  },
  {
    accessorKey: "uploadDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto w-full flex items-center justify-between gap-1 px-2 py-2 text-xs font-semibold"
        >
          <span className="flex-1 text-center">Fecha de subida</span>
          <ArrowUpDown className="h-3 w-3 shrink-0" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-muted-foreground w-full text-sm">
          {formatDate(row.getValue("uploadDate"))}
        </div>
      );
    },
    meta: {
      className: "w-[150px] min-w-[150px]",
      headerClassName: "px-2 !whitespace-normal text-center",
      cellClassName: "px-2",
    },
  },
  {
    accessorKey: "status",
    header: () => (
      <div className="text-xs font-semibold leading-tight text-center whitespace-normal">
        Estado
      </div>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as DocumentStatus;
      const config = statusConfig[status];
      return (
        <div className="flex justify-center">
          <Badge
            variant={config.variant}
            className="text-xs px-2 py-1"
          >
            {config.label}
          </Badge>
        </div>
      );
    },
    meta: {
      className: "w-[110px] min-w-[110px]",
      headerClassName: "px-2",
      cellClassName: "px-2",
    },
  },
  {
    accessorKey: "attentionDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto w-full flex items-center justify-between gap-1 px-2 py-2 text-xs font-semibold"
        >
          <span className="flex-1 text-center">Fecha de atención</span>
          <ArrowUpDown className="h-3 w-3 shrink-0" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-muted-foreground w-full text-sm">
          {formatDate(row.getValue("attentionDate"))}
        </div>
      );
    },
    meta: {
      className: "w-[150px] min-w-[150px]",
      headerClassName: "px-2 !whitespace-normal text-center",
      cellClassName: "px-2",
    },
  },
  {
    accessorKey: "attentionComments",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto w-full flex items-center justify-between gap-1 px-2 py-2 text-xs font-semibold"
        >
          <span className="flex-1 text-center">Motivo de autorización/rechazo</span>
          <ArrowUpDown className="h-3 w-3 shrink-0" />
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
          <div className="text-muted-foreground text-sm w-full text-center">
            -
          </div>
        );
      }

      return (
        <div className="text-muted-foreground w-full">
          {attentionText.length > 40 ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className="w-full truncate text-left text-primary underline decoration-dotted hover:underline cursor-pointer bg-transparent p-0 border-0 text-sm"
                  title={attentionText}
                >
                  {truncatedText}
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Motivo completo de autorización/rechazo
                  </h4>
                  <p className="text-sm">{attentionText}</p>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span className="text-sm" title={attentionText}>
              {attentionText}
            </span>
          )}
        </div>
      );
    },
    meta: {
      className: "w-[170px] min-w-[170px]",
      headerClassName: "px-2 !whitespace-normal text-center",
      cellClassName: "px-2",
    },
  },
  {
    accessorKey: "name",
    header: () => (
      <div className="text-xs font-semibold leading-tight text-center whitespace-normal">
        Nombre del archivo
      </div>
    ),
    cell: ({ row }) => {
      const document = row.original;
      const fileName = document.name || "";
      const truncatedText =
        fileName.length > 30
          ? fileName.substring(0, 30) + "..."
          : fileName;

      return (
        <div className="text-muted-foreground w-full">
          {fileName.length > 30 ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  className="w-full truncate text-left text-muted-foreground hover:text-foreground cursor-pointer bg-transparent p-0 border-0 text-sm"
                  title={fileName}
                >
                  {truncatedText}
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Nombre completo del archivo
                  </h4>
                  <p className="text-sm break-all">{fileName}</p>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span className="text-sm" title={fileName}>
              {fileName}
            </span>
          )}
        </div>
      );
    },
    meta: {
      className: "w-[140px] min-w-[140px]",
      headerClassName: "px-2 !whitespace-normal text-center",
      cellClassName: "px-2",
    },
  },
  {
    id: "actions",
    header: () => <div className="text-xs font-semibold">Acciones</div>,
    cell: ({ row }) => {
      const document = row.original;
      const isAnyLoading = !!context?.loadingDocumentId;
      const status = row.getValue("status") as DocumentStatus;

      if (status !== "pending") {
        return null;
      }

      const handleDelete = async () => {
        if (isAnyLoading) return;

        context?.onDelete?.(document);
        await context?.onRefresh?.();
      };

      return (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={isAnyLoading}
            className="h-7 px-2 gap-1 text-xs text-red-600 border-red-600 hover:bg-red-600 hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3" />
            <span className="text-[11px]">Eliminar</span>
          </Button>
        </div>
      );
    },
    meta: {
      className: "w-[100px] min-w-[100px]",
      headerClassName: "px-2",
      cellClassName: "px-2",
    },
  },
];
