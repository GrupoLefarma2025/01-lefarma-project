import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';
import { authService } from '@/shared/auth/authService';
import { vacacionesApi } from '../../services/vacaciones.api';
import { SaldoDetalleModal } from '../../components/SaldoDetalleModal';
import type { SaldoVacacionesResponse } from '@/types/vacaciones.types';
import type { Empresa } from '@/types/auth.types';

const formatearNumero = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

export function SaldosVacacionesPage() {
  usePageTitle('Saldos de vacaciones', 'Consulta y ajuste de saldos de vacaciones');

  const [items, setItems] = useState<SaldoVacacionesResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('__all__');
  const [filtroAnio, setFiltroAnio] = useState<string>('__all__');
  const [selectedSaldo, setSelectedSaldo] = useState<SaldoVacacionesResponse | null>(null);

  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => actual - index);
  }, []);

  const loadSaldos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await vacacionesApi.getSaldos({
        idEmpresa: filtroEmpresa === '__all__' ? undefined : Number(filtroEmpresa),
        anio: filtroAnio === '__all__' ? undefined : Number(filtroAnio),
      });
      setItems(response.data.data ?? []);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al obtener saldos');
    } finally {
      setLoading(false);
    }
  }, [filtroEmpresa, filtroAnio]);

  useEffect(() => {
    authService
      .getEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]));
  }, []);

  useEffect(() => {
    loadSaldos();
  }, [loadSaldos]);

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

  const columns: ColumnDef<SaldoVacacionesResponse>[] = [
    {
      accessorKey: 'usuarioNombre',
      header: 'Nombre',
      cell: ({ row }) => row.original.usuarioNombre ?? '—',
    },
    {
      accessorKey: 'nomina',
      header: 'Nómina',
      cell: ({ row }) => row.original.nomina ?? '—',
    },
    { accessorKey: 'anio', header: 'Año' },
    {
      accessorKey: 'diasGenerados',
      header: 'Generados',
      cell: ({ row }) => formatearNumero(row.original.diasGenerados),
    },
    {
      accessorKey: 'diasVencidos',
      header: 'Vencidos',
      cell: ({ row }) => formatearNumero(row.original.diasVencidos),
    },
    {
      accessorKey: 'diasCompensados',
      header: 'Compensados',
      cell: ({ row }) => formatearNumero(row.original.diasCompensados),
    },
    {
      accessorKey: 'diasAjustados',
      header: 'Ajustados',
      cell: ({ row }) => formatearNumero(row.original.diasAjustados),
    },
    {
      accessorKey: 'diasTomados',
      header: 'Tomados',
      cell: ({ row }) => formatearNumero(row.original.diasTomados),
    },
    {
      accessorKey: 'diasPendientes',
      header: 'Pendientes',
      cell: ({ row }) => (
        <span
          className={
            row.original.diasPendientes < 0 ? 'font-semibold text-destructive' : 'font-semibold'
          }
        >
          {formatearNumero(row.original.diasPendientes)}
        </span>
      ),
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedSaldo(row.original)}>
          <Eye className="mr-1 h-4 w-4" />
          Ver detalle
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las empresas</SelectItem>
              {empresas.map((empresa) => (
                <SelectItem key={empresa.idEmpresa} value={String(empresa.idEmpresa)}>
                  {empresa.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroAnio} onValueChange={setFiltroAnio}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los años</SelectItem>
              {anios.map((anio) => (
                <SelectItem key={anio} value={String(anio)}>
                  {anio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSincronizar} disabled={isSyncing}>
          {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <RefreshCw className="mr-2 h-4 w-4" />
          Sincronizar saldos
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        title="Lista de saldos de vacaciones"
        subtitle="Consulta el saldo anual de cada empleado y ajusta días cuando sea necesario"
        showRefreshButton
        onRefresh={loadSaldos}
        showColumnToggle
        globalFilter
        pagination
        pageSize={10}
      />

      <div className="rounded-md border bg-muted/50 p-4">
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

      <SaldoDetalleModal
        saldo={selectedSaldo}
        onClose={() => setSelectedSaldo(null)}
        onUpdated={loadSaldos}
      />
    </div>
  );
}
