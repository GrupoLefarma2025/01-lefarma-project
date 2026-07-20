import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';
import { vacacionesApi } from '../../services/vacaciones.api';
import type { SaldoVacacionesResponse, DiaUsuarioResponse } from '@/types/vacaciones.types';

export function SaldosVacacionesPage() {
  usePageTitle('Saldos de vacaciones', 'Lista de saldos de vacaciones');

  const [items, setItems] = useState<SaldoVacacionesResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [diasUsuario, setDiasUsuario] = useState<DiaUsuarioResponse[]>([]);
  const [loadingDias, setLoadingDias] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<SaldoVacacionesResponse | null>(null);

  const loadSaldos = async () => {
    try {
      setLoading(true);
      const response = await vacacionesApi.getSaldos({});
      setItems(response.data.data ?? []);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al obtener saldos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSaldos();
  }, []);

  const handleSincronizar = async () => {
    try {
      setIsSyncing(true);
      const response = await vacacionesApi.syncSaldos({});
      const data = response.data.data;
      toast.success(
        `Sincronización completada: ${data?.creados} creados, ${data?.actualizados} actualizados, ${data?.omitidos} omitidos.`
      );
      loadSaldos();
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al sincronizar saldos');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVerDias = async (row: SaldoVacacionesResponse) => {
    try {
      setSelectedUsuario(row);
      setLoadingDias(true);
      const response = await vacacionesApi.getDiasUsuario({ idUsuario: row.idUsuario, anio: row.anio });
      setDiasUsuario(response.data.data ?? []);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al obtener días del usuario');
    } finally {
      setLoadingDias(false);
    }
  };

  const columns: ColumnDef<SaldoVacacionesResponse>[] = [
    { accessorKey: 'usuarioNombre', header: 'Nombre' },
    { accessorKey: 'nomina', header: 'Nómina' },
    { accessorKey: 'anio', header: 'Año' },
    { accessorKey: 'diasGenerados', header: 'Generados' },
    { accessorKey: 'diasVencidos', header: 'Vencidos' },
    { accessorKey: 'diasCompensados', header: 'Compensados' },
    { accessorKey: 'diasAjustados', header: 'Ajustados' },
    { accessorKey: 'diasTomados', header: 'Tomados' },
    { accessorKey: 'diasPendientes', header: 'Pendientes' },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => handleVerDias(row.original)}>
          <Eye className="mr-1 h-4 w-4" />
          Ver días
        </Button>
      ),
    },
  ];

  const diasColumns: ColumnDef<DiaUsuarioResponse>[] = [
    { accessorKey: 'fecha', header: 'Fecha' },
    { accessorKey: 'tipoDiaNombre', header: 'Tipo' },
    { accessorKey: 'origen', header: 'Origen' },
    { accessorKey: 'estado', header: 'Estado' },
    { accessorKey: 'consumeSaldo', header: 'Consume saldo' },
    { accessorKey: 'comentarios', header: 'Comentarios' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-end">
        <Button onClick={handleSincronizar} disabled={isSyncing}>
          {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <RefreshCw className="mr-2 h-4 w-4" />
          Sincronizar saldos
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de saldos de vacaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            globalFilter
            pagination
            pageSize={10}
          />
          <div className="mt-6 rounded-md border bg-muted/50 p-4">
            <h4 className="mb-2 text-sm font-semibold">Descripción de columnas</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <strong>Generados:</strong> Días que el empleado ganó por ley, contrato o antigüedad.
              </li>
              <li>
                <strong>Ajustados:</strong> Cambios administrativos hechos por RH.
              </li>
              <li>
                <strong>Tomados:</strong> Días que el empleado realmente utilizó.
              </li>
              <li>
                <strong>Vencidos:</strong> Días que caducaron según las políticas de la empresa.
              </li>
              <li>
                <strong>Compensados:</strong> Días pagados por la empresa en lugar de ser disfrutados, según legislación y políticas internas.
              </li>
              <li>
                <strong>Pendientes:</strong> Días disponibles que aún puede solicitar el empleado. Se calcula como: generados + compensados + ajustados - vencidos - tomados.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Modal
        id="dias-usuario-modal"
        open={selectedUsuario != null}
        setOpen={(open) => {
          if (!open) {
            setSelectedUsuario(null);
            setDiasUsuario([]);
          }
        }}
        title={`Días de ${selectedUsuario?.usuarioNombre ?? 'Usuario'} — Nómina: ${selectedUsuario?.nomina ?? '—'} | Año: ${selectedUsuario?.anio ?? '—'}`}
        size="wide"
      >
        <div className="py-4">
          <DataTable
            columns={diasColumns}
            data={diasUsuario}
            loading={loadingDias}
            pagination
            pageSize={5}
          />
        </div>
      </Modal>
    </div>
  );
}
