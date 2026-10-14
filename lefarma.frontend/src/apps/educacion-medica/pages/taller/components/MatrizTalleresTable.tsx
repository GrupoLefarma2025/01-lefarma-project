import { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ClipboardList,
  Eye,
  FileImage,
  FileSignature,
  MoreHorizontal,
  Package,
  Receipt,
} from 'lucide-react';
import { ActionMenuItem } from '@/apps/educacion-medica/components/ActionMenuItem';
import type { Taller } from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtFecha = (fecha: string | null) => {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

const RESUMEN_RECURSOS: Record<string, string> = {
  Producto: 'Producto',
  Folleto: 'Folleto',
  Envio: 'Envío',
  BoxLunch: 'Box lunch',
};

interface MatrizTalleresTableProps {
  talleres: Taller[];
  loading?: boolean;
  /** El usuario es el AEM en el paso de registro de costos. */
  puedeEditarCostos: boolean;
  onEditarCostos: (taller: Taller) => void;
  /** Ver detalle del taller/hospital (logística, recursos y ubicación). */
  onVerDetalle: (taller: Taller) => void;
  /** AEM: registrar/editar la entrega de material. */
  onMaterial: (taller: Taller) => void;
  /** Lectura de la lista de asistencia. */
  onAsistencias: (taller: Taller) => void;
  /** Lectura de las evidencias del taller. */
  onEvidencias: (taller: Taller) => void;
  /** CEM: resolver la solicitud de cambio pendiente (ADR-00010). */
  onResolverSolicitud: (taller: Taller) => void;
  onRefresh?: () => void;
}

/** Tabla concentrada de la matriz general: filas con recursos y Costo Total. */
export function MatrizTalleresTable({
  talleres,
  loading,
  puedeEditarCostos,
  onEditarCostos,
  onVerDetalle,
  onMaterial,
  onAsistencias,
  onEvidencias,
  onResolverSolicitud,
  onRefresh,
}: MatrizTalleresTableProps) {
  // Las solicitudes de cambio pendientes se ordenan arriba (ADR-00010 decisión 14).
  const datosOrdenados = useMemo(
    () =>
      [...talleres].sort(
        (a, b) =>
          Number(Boolean(b.solicitudCambioPendiente)) -
          Number(Boolean(a.solicitudCambioPendiente))
      ),
    [talleres]
  );

  const columnas = useMemo<ColumnDef<Taller>[]>(
    () => [
      {
        id: 'hospital',
        accessorFn: (taller) =>
          [taller.nombreHospital, taller.region].filter(Boolean).join(' '),
        header: 'Hospital',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate">{row.original.nombreHospital ?? '—'}</span>
              {row.original.esExtraordinario && (
                <Badge
                  variant="outline"
                  className="border-amber-300 text-[10px] text-amber-700 dark:border-amber-800 dark:text-amber-300"
                  title={row.original.motivoExtraordinario ?? 'Taller extraordinario'}
                >
                  Extraordinario
                </Badge>
              )}
              {row.original.solicitudCambioPendiente && (
                <Badge
                  variant="outline"
                  className="gap-1 border-purple-300 text-[10px] text-purple-700 dark:border-purple-800 dark:text-purple-300"
                  title={`Solicitud pendiente de ${row.original.solicitudCambioPendiente.nombreSolicitante ?? 'el equipo'}`}
                >
                  <FileSignature className="h-3 w-3" />
                  Solicitud pendiente
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.region ?? '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'equipo',
        accessorFn: (taller) =>
          [taller.nombreEjecutivo, taller.nombreEspecialista].filter(Boolean).join(' '),
        header: 'Equipo',
        cell: ({ row }) => (
          <div className="text-xs leading-tight">
            <p>
              {row.original.nombreEjecutivo ?? '—'}{' '}
              <span className="text-muted-foreground">(EV)</span>
            </p>
            <p className="text-muted-foreground">
              {row.original.nombreEspecialista ?? '—'} <span>(EP)</span>
            </p>
          </div>
        ),
      },
      {
        id: 'fechaHora',
        accessorFn: (taller) =>
          [taller.fechaTaller, taller.horaTaller].filter(Boolean).join(' '),
        header: 'Fecha y hora',
        cell: ({ row }) => (
          <div className="text-sm">
            <p>{fmtFecha(row.original.fechaTaller)}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.horaTaller?.slice(0, 5) ?? '—'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'numeroParticipantes',
        header: 'Participantes',
        cell: ({ row }) => row.original.numeroParticipantes ?? '—',
      },
      {
        id: 'recursos',
        header: 'Recursos',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.recursos.length === 0 ? (
              <Badge variant="outline" className="text-[10px] text-amber-600">
                Sin recursos
              </Badge>
            ) : (
              row.original.recursos.map((r) => (
                <Badge key={r.idTallerRecurso} variant="outline" className="text-[10px]">
                  {RESUMEN_RECURSOS[r.tipoRecurso] ?? r.tipoRecurso}
                  {r.cantidad != null ? ` ×${r.cantidad}` : ''}
                  {r.costoUnitario != null ? ` (${fmtMoneda(r.costoUnitario)})` : ''}
                </Badge>
              ))
            )}
          </div>
        ),
      },
      {
        accessorKey: 'costoTotal',
        header: 'Costo total',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{fmtMoneda(row.original.costoTotal)}</span>
        ),
      },
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => {
          const taller = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => onVerDetalle(taller)}
                title="Ver detalle"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!puedeEditarCostos}
                onClick={() => onEditarCostos(taller)}
                title={
                  puedeEditarCostos
                    ? 'Registrar costos del taller (AEM)'
                    : 'Disponible mientras la matriz está en el paso de registro de costos'
                }
              >
                <Receipt className="mr-1.5 h-4 w-4" />
                Costos
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    aria-label="Más acciones"
                    title="Más acciones"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {taller.solicitudCambioPendiente && (
                    <>
                      <ActionMenuItem
                        label="Resolver solicitud"
                        icon={FileSignature}
                        onClick={() => onResolverSolicitud(taller)}
                      />
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <ActionMenuItem
                    label="Material"
                    icon={Package}
                    onClick={() => onMaterial(taller)}
                  />
                  <ActionMenuItem
                    label="Asistencia"
                    icon={ClipboardList}
                    onClick={() => onAsistencias(taller)}
                  />
                  <ActionMenuItem
                    label="Evidencias"
                    icon={FileImage}
                    onClick={() => onEvidencias(taller)}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      puedeEditarCostos,
      onEditarCostos,
      onVerDetalle,
      onMaterial,
      onAsistencias,
      onEvidencias,
      onResolverSolicitud,
    ]
  );

  return (
    <DataTable
      columns={columnas}
      data={datosOrdenados}
      title="Matriz concentrada"
      subtitle="Talleres de todos los equipos de la gerencia en el mes. Las solicitudes pendientes se muestran arriba."
      showRowCount
      loading={loading}
      globalFilter
      showRefreshButton={Boolean(onRefresh)}
      onRefresh={onRefresh}
      pagination
      pageSize={20}
      filterConfig={{
        tableId: 'educacion-medica-matriz-talleres',
        searchableColumns: [
          'hospital',
          'equipo',
          'fechaHora',
          'numeroParticipantes',
        ],
        defaultSearchColumns: ['hospital'],
      }}
    />
  );
}
