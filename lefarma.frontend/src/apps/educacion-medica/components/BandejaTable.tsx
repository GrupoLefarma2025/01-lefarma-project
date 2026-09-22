import { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, FileSignature, Paperclip, History, ExternalLink } from 'lucide-react';
import type { PendienteAprobacion } from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtFecha = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface BandejaTableProps {
  data: PendienteAprobacion[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  onDetalle: (d: PendienteAprobacion) => void;
  onFirma: (d: PendienteAprobacion) => void;
  onArchivos: (d: PendienteAprobacion) => void;
  onHistorial: (d: PendienteAprobacion) => void;
  onAbrirDocumento: (d: PendienteAprobacion) => void;
  onRefresh?: () => void;
  pageSize?: number;
}

/** DataTable de la Bandeja de Autorizaciones — mismo patrón que SolicitudesTable (RH). */
export function BandejaTable({
  data,
  title,
  subtitle,
  loading,
  onDetalle,
  onFirma,
  onArchivos,
  onHistorial,
  onAbrirDocumento,
  onRefresh,
  pageSize = 10,
}: BandejaTableProps) {
  const columns: ColumnDef<PendienteAprobacion>[] = useMemo(
    () => [
      {
        id: 'documento',
        accessorKey: 'documento',
        header: 'Documento',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.documento}</span>
            {row.original.detalle && (
              <span className="text-xs text-muted-foreground">{row.original.detalle}</span>
            )}
          </div>
        ),
      },
      {
        id: 'tipo',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px] uppercase">
            {row.original.tipo === 'seleccion' ? 'Selección' : 'Rutas'}
          </Badge>
        ),
      },
      {
        id: 'solicitante',
        header: 'Solicitante',
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.nombreUsuarioCreador ??
              (row.original.idUsuarioCreador ? `Usuario #${row.original.idUsuarioCreador}` : '-')}
          </span>
        ),
      },
      {
        id: 'fecha',
        header: 'Fecha',
        cell: ({ row }) => <span className="text-xs">{fmtFecha(row.original.fecha)}</span>,
      },
      {
        id: 'etapa',
        header: 'Etapa actual',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="text-xs">{row.original.pasoNombre ?? '—'}</span>
            {row.original.acciones.length > 0 && (
              <Badge className="w-fit bg-amber-500 text-[10px] text-white hover:bg-amber-500">
                Pendiente de tu firma
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        cell: ({ row }) => {
          const color = row.original.estadoColor ?? '#94a3b8';
          const nombre = row.original.estadoNombre ?? row.original.estado ?? '—';
          return (
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold"
              style={{
                borderColor: color,
                color,
                backgroundColor: color + '15',
              }}
            >
              {nombre}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => {
          const d = row.original;
          return (
            <div className="flex items-center gap-1">
              <ActionButton label="Ver detalle" icon={Eye} onClick={() => onDetalle(d)} />
              {d.acciones.length > 0 && (
                <ActionButton label="Firmar / acciones disponibles" icon={FileSignature} onClick={() => onFirma(d)} />
              )}
              <ActionButton label="Archivos" icon={Paperclip} onClick={() => onArchivos(d)} />
              <ActionButton label="Historial" icon={History} onClick={() => onHistorial(d)} />
              <ActionButton label="Abrir documento" icon={ExternalLink} onClick={() => onAbrirDocumento(d)} />
            </div>
          );
        },
      },
    ],
    [onDetalle, onFirma, onArchivos, onHistorial, onAbrirDocumento]
  );

  return (
    <div className="w-full">
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        title={title}
        subtitle={subtitle}
        pagination
        pageSize={pageSize}
        globalFilter={true}
        showRefreshButton={Boolean(onRefresh)}
        onRefresh={onRefresh}
        filterConfig={{
          tableId: 'educacion-medica-bandeja',
          searchableColumns: ['documento'],
          defaultSearchColumns: ['documento'],
        }}
      />
    </div>
  );
}
