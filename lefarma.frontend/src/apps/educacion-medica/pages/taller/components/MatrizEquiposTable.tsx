import { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, LockOpen } from 'lucide-react';
import type {
  ConcentracionEquipo,
  Taller,
} from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const fmtFecha = (fecha: string | null) => {
  if (!fecha) return null;
  return new Date(fecha).toLocaleDateString('es-MX');
};

interface MatrizEquiposTableProps {
  equipos: ConcentracionEquipo[];
  /** Talleres de la matriz general (para calcular el costo por equipo). */
  talleres: Taller[];
  loading?: boolean;
  /** Puede reabrir capturas (GV/CA) y la general está en Creada. */
  puedeReabrir: boolean;
  onReabrir: (equipo: ConcentracionEquipo) => void;
  onVerDetalle: (equipo: ConcentracionEquipo) => void;
}

/** Vista "Por equipo" de la Matriz general: una fila por matriz individual. */
export function MatrizEquiposTable({
  equipos,
  talleres,
  loading,
  puedeReabrir,
  onReabrir,
  onVerDetalle,
}: MatrizEquiposTableProps) {
  const costoPorEquipo = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const taller of talleres) {
      if (taller.idMatrizIndividual == null) continue;
      mapa.set(
        taller.idMatrizIndividual,
        (mapa.get(taller.idMatrizIndividual) ?? 0) + taller.costoTotal
      );
    }
    return mapa;
  }, [talleres]);

  const columnas = useMemo<ColumnDef<ConcentracionEquipo>[]>(
    () => [
      {
        id: 'equipo',
        header: 'Equipo',
        cell: ({ row }) => (
          <div className="text-xs leading-tight">
            <p className="font-medium">
              {row.original.nombreEjecutivo ?? `EV ${row.original.idEjecutivo ?? '—'}`}{' '}
              <span className="font-normal text-muted-foreground">(EV)</span>
            </p>
            <p className="text-muted-foreground">
              {row.original.nombreEspecialista ?? `EP ${row.original.idEspecialista ?? '—'}`}{' '}
              <span>(EP)</span>
            </p>
          </div>
        ),
      },
      {
        id: 'region',
        header: 'Región',
        cell: ({ row }) => row.original.nombreRegion ?? '—',
      },
      {
        id: 'captura',
        header: 'Captura',
        cell: ({ row }) => (
          <Badge variant={row.original.esBloqueado ? 'default' : 'outline'}>
            {row.original.esBloqueado ? 'Bloqueada' : 'En captura'}
          </Badge>
        ),
      },
      {
        id: 'talleres',
        header: 'Talleres',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.totalTalleres}</span>
        ),
      },
      {
        id: 'costo',
        header: 'Costo total',
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {fmtMoneda(costoPorEquipo.get(row.original.idMatrizIndividual) ?? 0)}
          </span>
        ),
      },
      {
        id: 'fecha',
        header: 'Fecha',
        cell: ({ row }) => {
          const fecha = row.original.esBloqueado
            ? fmtFecha(row.original.fechaBloqueo)
            : fmtFecha(row.original.fechaDesbloqueo);
          if (!fecha) return '—';
          return (
            <span className="text-xs text-muted-foreground">
              {row.original.esBloqueado ? `Bloqueada el ${fecha}` : `Reabierta el ${fecha}`}
            </span>
          );
        },
      },
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => onVerDetalle(row.original)}
              title="Ver detalle"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {puedeReabrir && row.original.esBloqueado && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onReabrir(row.original)}
              >
                <LockOpen className="mr-1 h-3.5 w-3.5" />
                Reabrir captura
              </Button>
            )}
          </div>
        ),
      },
    ],
    [costoPorEquipo, puedeReabrir, onReabrir, onVerDetalle]
  );

  return (
    <DataTable
      columns={columnas}
      data={equipos}
      title="Avance por equipo"
      subtitle="Una fila por matriz individual (equipo de pareo + mes). Ver detalle muestra sus hospitales."
      showRowCount
      loading={loading}
    />
  );
}
