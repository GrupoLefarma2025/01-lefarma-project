import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Document, DocumentStatus } from "@/apps/sigma/lib/documents";

export type ColumnsContext = {
  onPreview?: (document: Document) => void;
  onApprove?: (document: Document) => void;
  onReject?: (document: Document) => void;
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

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const createColumns = (
  context?: ColumnsContext
): ColumnDef<Document>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nombre
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const document = row.original;
      const displayName = document.customName || document.name;

      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => context?.onPreview?.(document)}
            className="font-medium text-primary hover:underline cursor-pointer text-left"
          >
            {displayName}
          </button>
          {document.customName && (
            <span className="text-xs text-muted-foreground">
              ({document.name})
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "size",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Tamaño
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-muted-foreground">
          {formatFileSize(row.getValue("size"))}
        </div>
      );
    },
  },
  {
    accessorKey: "uploadDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Fecha de subida
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="text-muted-foreground">
          {formatDate(row.getValue("uploadDate"))}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const status = row.getValue("status") as DocumentStatus;
      const config = statusConfig[status];
      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
  },
  {
    id: "approve",
    header: "Aprobar",
    cell: ({ row }) => {
      const document = row.original;

      if (document.status === "approved" || document.status === "rejected") {
        return null;
      }

      return (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-green-600 border-green-600 hover:bg-green-600 hover:text-white cursor-pointer"
          onClick={() => context?.onApprove?.(document)}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Aprobar
        </Button>
      );
    },
  },
  {
    id: "reject",
    header: "Rechazar",
    cell: ({ row }) => {
      const document = row.original;

      if (document.status === "rejected" || document.status === "approved") {
        return null;
      }

      return (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-red-600 border-red-600 hover:bg-red-600 hover:text-white cursor-pointer"
          onClick={() => context?.onReject?.(document)}
        >
          <XCircle className="h-3.5 w-3.5" />
          Rechazar
        </Button>
      );
    },
  },
];
