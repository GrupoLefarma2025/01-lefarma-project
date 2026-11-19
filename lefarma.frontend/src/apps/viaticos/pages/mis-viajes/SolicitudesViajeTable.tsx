import { useMemo, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { ModoTransporteBadge } from '../../components/ModoTransporteBadge';
import { contarPuntos } from '../../services/resumenViaje';
import { estadoTexto } from '../../types/aprobaciones.types';
import {
  clasificarRelacion,
  colorEstado,
  costoViaje,
  fechaLarga,
  mxn,
  modoTransporte,
  nombreCreadorDe,
  personasInvolucradas,
  type FilaViaje,
} from './viajes.helpers';

export interface SolicitudesViajeTableProps {
  filas: FilaViaje[];
  cargando: boolean;
  titulo: string;
  subtitulo?: string;
  /** Clave con la que el DataTable recuerda qué columnas se ven. */
  tableId: string;
  miId?: number;
  miNombre?: string;
  onVerDetalle: (idSolicitud: number) => void;
  /** Vuelve a pedir los datos al servidor. */
  onRefresh: () => void;
  /** Contenido de la celda «Acción»: cada pantalla decide sus botones. */
  acciones: (fila: FilaViaje) => ReactNode;
}

/**
 * Tabla de solicitudes de viaje compartida por Mis viajes y Autorizaciones.
 * Las mismas columnas en ambas pantallas para que el autorizador vea lo que ve
 * el solicitante; solo cambian las acciones de la última columna.
 */
export function SolicitudesViajeTable({
  filas,
  cargando,
  titulo,
  subtitulo,
  tableId,
  miId,
  miNombre,
  onVerDetalle,
  onRefresh,
  acciones,
}: SolicitudesViajeTableProps) {
  const columnas = useMemo<ColumnDef<FilaViaje>[]>(
    () => [
      {
        id: 'viaje',
        header: 'Viaje',
        accessorFn: (fila) => fila.solicitud.folio ?? fila.solicitud.id_solicitud,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.solicitud.folio ?? `#${row.original.solicitud.id_solicitud}`}</span>
            <span className="text-xs text-muted-foreground">{fechaLarga(row.original.solicitud.fecha_creacion)}</span>
          </div>
        ),
      },
      {
        id: 'destino',
        header: 'Destino',
        accessorFn: (fila) => fila.resumen.destino ?? '',
        cell: ({ row }) => {
          const distintivos = clasificarRelacion(row.original.solicitud, row.original.resumen, miId, miNombre);
          return (
            <div className="flex flex-col gap-1">
              <span className="font-medium">{row.original.resumen.destino ?? 'Destino por confirmar'}</span>
              {distintivos.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {distintivos.map((d) => (
                    <Badge key={d.clave} variant="outline" className="text-[10px]">{d.texto}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'lugares',
        header: () => <div className="text-center">Lugares a visitar</div>,
        accessorFn: (fila) => fila.solicitud.num_puntos ?? contarPuntos(fila.solicitud.datos),
        cell: ({ getValue }) => (
          <div className="text-center">
            <span className="text-sm font-medium">{getValue<number>()}</span>
          </div>
        ),
      },
      {
        id: 'transporte',
        header: 'Transporte',
        accessorFn: (fila) => (modoTransporte(fila.solicitud) === 'propio' ? 'Carro propio' : 'Solicitud de transporte'),
        cell: ({ row }) => <ModoTransporteBadge modo={modoTransporte(row.original.solicitud)} />,
      },
      {
        id: 'personas',
        header: () => <div className="text-center">Personas involucradas</div>,
        accessorFn: (fila) => personasInvolucradas(fila.solicitud),
        cell: ({ getValue }) => (
          <div className="text-center">
            <span className="text-sm font-medium">{getValue<number>()}</span>
          </div>
        ),
      },
      {
        id: 'costo',
        header: 'Costo del viaje',
        accessorFn: (fila) => costoViaje(fila.solicitud) ?? 0,
        cell: ({ row }) => {
          const costo = costoViaje(row.original.solicitud);
          return <span className="text-sm font-medium">{costo !== null ? mxn(costo) : '—'}</span>;
        },
      },
      {
        id: 'solicitante',
        header: 'Solicitante',
        accessorFn: (fila) => `${fila.solicitud.persona_solicitante ?? ''} ${fila.solicitud.persona_viajera ?? ''}`.trim(),
        cell: ({ row }) => {
          const solicitante = row.original.solicitud.persona_solicitante?.trim()
            || nombreCreadorDe(row.original.solicitud, miId, miNombre);
          const viajero = row.original.solicitud.persona_viajera?.trim() || solicitante;
          if (solicitante === viajero) {
            return <Badge variant="secondary" className="font-normal">{solicitante}</Badge>;
          }
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              <span>
                <span className="text-muted-foreground">Creador: </span>
                <span className="font-medium">{solicitante}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Viajero: </span>
                <span className="font-medium">{viajero}</span>
              </span>
            </div>
          );
        },
      },
      {
        id: 'creadaPor',
        header: 'Creada por',
        accessorFn: (fila) => nombreCreadorDe(fila.solicitud, miId, miNombre),
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        id: 'estado',
        header: 'Estado',
        accessorFn: (fila) => estadoTexto(fila.solicitud.estado),
        cell: ({ row }) => {
          const estado = row.original.solicitud.estado;
          const color = colorEstado(estado);
          return (
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              style={{ borderColor: color, color, backgroundColor: `${color}15` }}
            >
              {estadoTexto(estado)}
            </span>
          );
        },
      },
      {
        id: 'acciones',
        header: () => <div className="text-right">Acción</div>,
        enableSorting: false,
        cell: ({ row }) => (
          // La fila abre el detalle; un clic en la acción no debe disparar los dos.
          <div className="flex items-center justify-end gap-1" onClick={(evento) => evento.stopPropagation()}>
            {acciones(row.original)}
          </div>
        ),
      },
    ],
    [miId, miNombre, acciones],
  );

  return (
    <DataTable
      columns={columnas}
      data={filas}
      title={titulo}
      subtitle={subtitulo ?? `Total: ${filas.length}`}
      pagination
      pageSize={10}
      height={460}
      loading={cargando}
      showRefreshButton
      onRefresh={onRefresh}
      filterConfig={{
        tableId,
        searchableColumns: ['destino', 'estado'],
        defaultSearchColumns: ['destino'],
        defaultVisibleColumns: ['viaje', 'destino', 'transporte', 'lugares', 'personas', 'costo', 'solicitante', 'estado', 'acciones'],
      }}
      rowTestId={(fila) => `viaje-${fila.solicitud.id_solicitud}`}
      onRowClick={(fila) => onVerDetalle(fila.solicitud.id_solicitud)}
    />
  );
}
