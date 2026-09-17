import { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, FileSignature, History, Paperclip, Pencil } from 'lucide-react';
import type { SeleccionMensual } from '@/apps/educacion-medica/types/educacionMedica.types';
import { formatearFechaSeleccion, formatearPeriodoSeleccion } from './seleccionUtils';

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

interface SeleccionesTableProps {
  data: SeleccionMensual[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  onVer: (s: SeleccionMensual) => void;
  /** Abre el detalle en modo edición (solo disponible en Borrador). */
  onEditar: (s: SeleccionMensual) => void;
  onFirma: (s: SeleccionMensual) => void;
  onHistorial: (s: SeleccionMensual) => void;
  onArchivos: (s: SeleccionMensual) => void;
  onRefresh?: () => void;
  pageSize?: number;
}

/** DataTable del listado de Selecciones Mensuales — mismo patrón que la Bandeja (RH). */
export function SeleccionesTable({
  data,
  loading,
  title,
  subtitle,
  onVer,
  onEditar,
  onFirma,
  onHistorial,
  onArchivos,
  onRefresh,
  pageSize = 10,
}: SeleccionesTableProps) {
  const columns: ColumnDef<SeleccionMensual>[] = useMemo(
    () => [
      {
        id: 'seleccion',
        accessorKey: 'fechaSeleccion',
        header: 'Selección',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{formatearPeriodoSeleccion(row.original.fechaSeleccion)}</span>
            <span className="text-xs text-muted-foreground">
              Selección #{row.original.idSeleccionMensual}
            </span>
          </div>
        ),
      },
      {
        id: 'gerencia',
        header: 'Gerencia',
        cell: ({ row }) => (
          <span className="text-xs">{row.original.tipoGerencia ?? '—'}</span>
        ),
      },
      {
        id: 'periodo',
        header: 'Período',
        cell: ({ row }) => (
          <span className="text-xs">
            {formatearFechaSeleccion(row.original.fechaInicioVigencia)} —{' '}
            {formatearFechaSeleccion(row.original.fechaFinVigencia)}
          </span>
        ),
      },
      {
        id: 'hospitales',
        header: 'Hospitales',
        cell: ({ row }) => <span className="text-xs">{row.original.totalHospitales}</span>,
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
        id: 'etapa',
        header: 'Etapa',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="text-xs">{row.original.pasoActualNombre ?? '—'}</span>
            {row.original.acciones.length > 0 && (
              <Badge className="w-fit bg-amber-500 text-[10px] text-white hover:bg-amber-500">
                Pendiente de tu firma
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'creadoPor',
        header: 'Creado por',
        cell: ({ row }) => (
          <span className="text-xs">{row.original.nombreUsuarioCreacion ?? '—'}</span>
        ),
      },
      {
        id: 'fecha',
        header: 'Fecha',
        cell: ({ row }) => <span className="text-xs">{formatearFechaSeleccion(row.original.fechaCreacion)}</span>,
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => {
          const s = row.original;
          const editable = s.estado === 'Borrador';
          return (
            <div className="flex items-center gap-1">
              <ActionButton label="Ver detalle" icon={Eye} onClick={() => onVer(s)} />
              {editable && (
                <ActionButton label="Editar" icon={Pencil} onClick={() => onEditar(s)} />
              )}
              {s.acciones.length > 0 && (
                <ActionButton
                  label="Firmar / acciones disponibles"
                  icon={FileSignature}
                  onClick={() => onFirma(s)}
                />
              )}
              <ActionButton label="Historial" icon={History} onClick={() => onHistorial(s)} />
              <ActionButton label="Archivos" icon={Paperclip} onClick={() => onArchivos(s)} />
            </div>
          );
        },
      },
    ],
    [onVer, onEditar, onFirma, onHistorial, onArchivos]
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
          tableId: 'educacion-medica-selecciones',
          searchableColumns: ['fechaSeleccion'],
          defaultSearchColumns: ['fechaSeleccion'],
        }}
      />
    </div>
  );
}
