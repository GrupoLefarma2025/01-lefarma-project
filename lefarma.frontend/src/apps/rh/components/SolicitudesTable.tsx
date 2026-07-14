import { useMemo } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import { Eye, FileSignature, Paperclip, History, Pencil } from 'lucide-react';
import { getCategoriaNombre } from '@/types/solicitudPersonal.types';

interface SolicitudesTableProps {
  data: SolicitudPersonalResponse[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  getEstadoInfo: (
    solicitud:
      | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
      | null
      | undefined
  ) => { nombre: string; color: string };
  onDetalle: (s: SolicitudPersonalResponse) => void;
  onFirma: (s: SolicitudPersonalResponse) => void;
  onArchivos: (s: SolicitudPersonalResponse) => void;
  onHistorial: (s: SolicitudPersonalResponse) => void;
  onEditar?: (s: SolicitudPersonalResponse) => void;
  puedeEditar?: boolean;
  onRefresh?: () => void;
  showFirma?: boolean;
  showEditar?: boolean;
  pageSize?: number;
  globalFilter?: boolean;
  manualPagination?: boolean;
  totalCount?: number;
  paginationState?: PaginationState;
  onPaginationChange?: (state: PaginationState) => void;
}

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

export function SolicitudesTable({
  data,
  title,
  subtitle,
  getEstadoInfo,
  onDetalle,
  onFirma,
  onArchivos,
  onHistorial,
  onEditar,
  puedeEditar,
  onRefresh,
  showFirma = true,
  showEditar = true,
  pageSize = 10,
  globalFilter = false,
  manualPagination,
  totalCount,
  paginationState,
  onPaginationChange,
}: SolicitudesTableProps) {
  const columns: ColumnDef<SolicitudPersonalResponse>[] = useMemo(
    () => [
      {
        accessorKey: 'folio',
        header: 'Folio',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.folio}</span>
            <span className="text-xs text-muted-foreground">
              {getCategoriaNombre(row.original.categoria)}
            </span>
          </div>
        ),
      },
      {
        id: 'tipoSolicitudNombre',
        header: 'Tipo de solicitud',
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.tipoSolicitudNombre || `Tipo #${row.original.idTipoSolicitud}`}
          </span>
        ),
      },
      {
        id: 'fechaCreacion',
        header: 'Fecha creación',
        cell: ({ row }) => <span className="text-xs">{fmtFecha(row.original.fechaCreacion)}</span>,
      },
      {
        id: 'fechas',
        header: 'Fechas',
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="text-xs">
              <p>Inicio: {fmtFecha(s.fechaInicio)}</p>
              {s.fechaFin && <p>Fin: {fmtFecha(s.fechaFin)}</p>}
              {s.diasSolicitados != null && (
                <p className="text-muted-foreground">{s.diasSolicitados} día(s)</p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'solicitanteNombre',
        header: 'Solicitante',
        cell: ({ row }) => <span className="text-xs">{row.original.solicitanteNombre ?? '-'}</span>,
      },
      /* {
        id: 'motivo',
        header: 'Motivo',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[260px] text-xs text-muted-foreground" title={row.original.motivo ?? ''}>
            {row.original.motivo || '-'}
          </span>
        ),
      }, */
      {
        accessorKey: 'idEstado',
        header: 'Estado',
        cell: ({ row }) => {
          const info = getEstadoInfo(row.original);
          return (
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold"
              style={{
                borderColor: info.color,
                color: info.color,
                backgroundColor: info.color + '15',
              }}
            >
              {info.nombre}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => {
          const s = row.original;
          const puedeEditarFila = showEditar && puedeEditar && s.estadoNombre === 'CREADA';
          return (
            <div className="flex items-center gap-1">
              {puedeEditarFila && (
                <ActionButton label="Editar" icon={Pencil} onClick={() => onEditar?.(s)} />
              )}
              <ActionButton label="Detalle" icon={Eye} onClick={() => onDetalle(s)} />
              {showFirma && (
                <ActionButton label="Firma" icon={FileSignature} onClick={() => onFirma(s)} />
              )}
              <ActionButton label="Archivos" icon={Paperclip} onClick={() => onArchivos(s)} />
              <ActionButton label="Historial" icon={History} onClick={() => onHistorial(s)} />
            </div>
          );
        },
      },
    ],
    [
      getEstadoInfo,
      onDetalle,
      onFirma,
      onArchivos,
      onHistorial,
      onEditar,
      puedeEditar,
      showFirma,
      showEditar,
    ]
  );

  return (
    <div className="w-full">
      <DataTable
        columns={columns}
        data={data}
        title={title}
        subtitle={subtitle}
        pagination
        pageSize={pageSize}
        manualPagination={manualPagination}
        totalCount={totalCount}
        paginationState={paginationState}
        onPaginationChange={onPaginationChange}
        globalFilter={globalFilter}
        showRefreshButton={Boolean(onRefresh)}
        onRefresh={onRefresh}
        filterConfig={{
          tableId: 'autorizaciones-solicitudes',
          searchableColumns: ['folio'],
          defaultSearchColumns: ['folio'],
        }}
      />
    </div>
  );
}
