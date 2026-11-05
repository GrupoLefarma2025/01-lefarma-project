import { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import type {
  ConcentracionEquipo,
  Taller,
} from '@/apps/educacion-medica/types/educacionMedica.types';

const fmtMoneda = (valor: number) =>
  valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

interface MatrizEquiposTableProps {
  equipos: ConcentracionEquipo[];
  /** Talleres de la matriz general (para calcular el costo por equipo). */
  talleres: Taller[];
  loading?: boolean;
  /** Visitas planeadas sin taller confirmado para el equipo. */
  visitasSinTaller?: (equipo: ConcentracionEquipo) => number;
  onVerDetalle: (equipo: ConcentracionEquipo) => void;
}

/** Vista "Por equipo" de la Matriz general: una fila por matriz individual. */
export function MatrizEquiposTable({
  equipos,
  talleres,
  loading,
  visitasSinTaller,
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
        id: 'talleres',
        header: 'Talleres',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.totalTalleres}</span>
        ),
      },
      {
        id: 'visitasSinTaller',
        header: 'Planeadas sin taller',
        cell: ({ row }) => {
          const total = visitasSinTaller?.(row.original) ?? 0;
          if (total === 0) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <Badge
              variant="outline"
              className="border-slate-300 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              {total}
            </Badge>
          );
        },
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
          </div>
        ),
      },
    ],
    [costoPorEquipo, onVerDetalle, visitasSinTaller]
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
