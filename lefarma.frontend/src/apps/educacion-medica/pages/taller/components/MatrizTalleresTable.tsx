import { useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt } from 'lucide-react';
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
}

/** Tabla concentrada de la matriz general: filas FOR-005 con recursos y Costo Total. */
export function MatrizTalleresTable({
  talleres,
  loading,
  puedeEditarCostos,
  onEditarCostos,
}: MatrizTalleresTableProps) {
  const columnas = useMemo<ColumnDef<Taller>[]>(
    () => [
      { accessorKey: 'nombreHospital', header: 'Hospital' },
      { accessorKey: 'region', header: 'Región' },
      {
        accessorKey: 'fechaTaller',
        header: 'Fecha',
        cell: ({ row }) => fmtFecha(row.original.fechaTaller),
      },
      {
        accessorKey: 'horaTaller',
        header: 'Hora',
        cell: ({ row }) => row.original.horaTaller?.slice(0, 5) ?? '—',
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
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            disabled={!puedeEditarCostos}
            onClick={() => onEditarCostos(row.original)}
          >
            <Receipt className="mr-1.5 h-4 w-4" />
            Costos
          </Button>
        ),
      },
    ],
    [puedeEditarCostos, onEditarCostos]
  );

  return (
    <DataTable
      columns={columnas}
      data={talleres}
      title="Matriz concentrada (FOR-005)"
      subtitle="Talleres de todos los equipos de la gerencia en el mes."
      showRowCount
      loading={loading}
    />
  );
}
