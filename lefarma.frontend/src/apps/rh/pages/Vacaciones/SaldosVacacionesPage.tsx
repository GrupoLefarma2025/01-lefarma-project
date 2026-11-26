import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Info, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';
import { exportRowsToCsv } from '@/utils/csv';
import { authService } from '@/shared/auth/authService';
import { ResponsiveFilters } from '@/components/common/ResponsiveFilters';
import { CatalogoToolbar } from '@/apps/educacion-medica/components/CatalogoToolbar';
import { ResumenCompacto } from '@/apps/educacion-medica/components/ResumenCompacto';
import { vacacionesApi } from '../../services/vacaciones.api';
import { SaldoDetalleModal } from '../../components/SaldoDetalleModal';
import type { SaldoVacacionesResponse } from '@/types/vacaciones.types';
import type { Empresa } from '@/types/auth.types';

const formatearNumero = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

export function SaldosVacacionesPage() {
  usePageTitle('Saldos de vacaciones', 'Consulta y ajuste de saldos por período');

  const [items, setItems] = useState<SaldoVacacionesResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('__all__');
  const [soloVigentes, setSoloVigentes] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('__all__');
  const [filtroSaldo, setFiltroSaldo] = useState('todos');
  const [selectedSaldo, setSelectedSaldo] = useState<SaldoVacacionesResponse | null>(null);

  const loadSaldos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await vacacionesApi.getSaldos({
        idEmpresa: filtroEmpresa === '__all__' ? undefined : Number(filtroEmpresa),
        soloVigentes,
      });
      setItems(response.data.data ?? []);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al obtener saldos');
    } finally {
      setLoading(false);
    }
  }, [filtroEmpresa, soloVigentes]);

  useEffect(() => {
    authService
      .getEmpresas()
      .then(setEmpresas)
      .catch(() => setEmpresas([]));
  }, []);

  useEffect(() => {
    loadSaldos();
  }, [loadSaldos]);

  const itemsFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    return items.filter((item) => {
      if (filtroPeriodo !== '__all__' && String(item.numeroPeriodo) !== filtroPeriodo) {
        return false;
      }
      if (filtroSaldo === 'positivo' && item.diasPendientes <= 0) return false;
      if (filtroSaldo === 'negativo' && item.diasPendientes >= 0) return false;
      if (filtroSaldo === 'cero' && item.diasPendientes !== 0) return false;

      if (!term) return true;

      const nombre = (item.usuarioNombre ?? '').toLowerCase();
      const nomina = String(item.nomina ?? '');
      const empresa = (item.empresaNombre ?? '').toLowerCase();
      return nombre.includes(term) || nomina.includes(term) || empresa.includes(term);
    });
  }, [items, busqueda, filtroPeriodo, filtroSaldo]);

  const periodosDisponibles = useMemo(
    () => Array.from(new Set(items.map((item) => item.numeroPeriodo))).sort((a, b) => b - a),
    [items]
  );

  const resumenItems = useMemo(() => {
    const colaboradores = new Set(itemsFiltrados.map((item) => item.idUsuario)).size;
    const conSaldoPositivo = itemsFiltrados.filter((item) => item.diasPendientes > 0).length;
    const conSaldoNegativo = itemsFiltrados.filter((item) => item.diasPendientes < 0).length;
    const conArrastre = itemsFiltrados.filter((item) => item.diasAjustadosArrastre > 0).length;

    return [
      { label: 'colaboradores', value: colaboradores, dotClassName: 'bg-sky-500' },
      { label: 'con saldo positivo', value: conSaldoPositivo, dotClassName: 'bg-emerald-500' },
      { label: 'saldo negativo', value: conSaldoNegativo, dotClassName: 'bg-rose-500' },
      { label: 'con arrastre', value: conArrastre, dotClassName: 'bg-cyan-500' },
    ];
  }, [itemsFiltrados]);

  const exportar = () => {
    exportRowsToCsv(
      itemsFiltrados.map((item) => ({
        Nombre: item.usuarioNombre ?? '',
        Nómina: item.nomina ?? '',
        Período: item.numeroPeriodo,
        Fechas: item.periodo,
        Generados: item.diasGenerados,
        Vencidos: item.diasVencidos,
        Compensados: item.diasCompensados,
        Ajustados: item.diasAjustados,
        Arrastre: item.diasAjustadosArrastre,
        Tomados: item.diasTomados,
        Pendientes: item.diasPendientes,
      })),
      'saldos-vacaciones.csv'
    );
  };

  const columns: ColumnDef<SaldoVacacionesResponse>[] = [
    {
      accessorKey: 'usuarioNombre',
      header: 'Colaborador',
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.original.usuarioNombre ?? '—'}</div>
          <div className="text-xs text-muted-foreground">
            Nómina {row.original.nomina ?? '—'}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'numeroPeriodo',
      header: 'Período',
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">Período {row.original.numeroPeriodo}</div>
          <div className="whitespace-nowrap text-xs text-muted-foreground">
            {row.original.periodo}
          </div>
        </div>
      ),
    },
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
      accessorKey: 'diasAjustadosArrastre',
      header: 'Arrastre',
      cell: ({ row }) => formatearNumero(row.original.diasAjustadosArrastre),
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
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => setSelectedSaldo(row.original)}
        >
          <Eye className="h-3.5 w-3.5" />
          Ver
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-8">
      <ResumenCompacto items={resumenItems} loading={loading} />

      <CatalogoToolbar
        left={
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-card text-xs sm:w-56">
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
        }
        right={
          <>
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar nombre o nómina..."
                className="h-9 rounded-lg border-slate-200 bg-slate-50/60 pl-8 text-xs dark:border-slate-800 dark:bg-slate-900/40"
              />
            </div>

            <ResponsiveFilters
              activeCount={
                (soloVigentes ? 1 : 0) +
                (filtroPeriodo !== '__all__' ? 1 : 0) +
                (filtroSaldo !== 'todos' ? 1 : 0)
              }
              onClear={() => {
                setSoloVigentes(false);
                setFiltroPeriodo('__all__');
                setFiltroSaldo('todos');
              }}
              title="Filtros de saldos"
              description="Acota por período, vigencia y saldo pendiente."
              desktopWidthClassName="w-[320px]"
            >
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
                <div>
                  <p className="text-xs font-medium">Solo período vigente</p>
                  <p className="text-[10px] text-muted-foreground">Oculta períodos anteriores</p>
                </div>
                <Switch checked={soloVigentes} onCheckedChange={setSoloVigentes} />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Período</p>
                <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                  <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-card text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos los períodos</SelectItem>
                    {periodosDisponibles.map((numero) => (
                      <SelectItem key={numero} value={String(numero)}>
                        Período {numero}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">Saldo pendiente</p>
                <Select value={filtroSaldo} onValueChange={setFiltroSaldo}>
                  <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-card text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="positivo">Con saldo</SelectItem>
                    <SelectItem value="negativo">Saldo negativo</SelectItem>
                    <SelectItem value="cero">Sin saldo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </ResponsiveFilters>
          </>
        }
        onRefresh={loadSaldos}
        refreshing={loading}
        refreshLabel="Actualizar saldos"
      />

      <DataTable
        columns={columns}
        data={itemsFiltrados}
        title={
          <span className="flex items-center gap-2">
            Saldos de vacaciones
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Descripción de columnas"
                >
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 text-xs">
                <p className="mb-2 font-semibold">Descripción de columnas</p>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Período:</strong> número de año de servicio.
                  </li>
                  <li>
                    <strong className="text-foreground">Fechas:</strong> inicio y fin del período.
                  </li>
                  <li>
                    <strong className="text-foreground">Generados:</strong> días que corresponden
                    por ley, contrato o antigüedad en el período.
                  </li>
                  <li>
                    <strong className="text-foreground">Vencidos:</strong> días que caducaron al
                    cumplirse 18 meses desde el aniversario.
                  </li>
                  <li>
                    <strong className="text-foreground">Compensados:</strong> días pagados en lugar
                    de disfrutarse.
                  </li>
                  <li>
                    <strong className="text-foreground">Ajustados:</strong> correcciones manuales de
                    RH.
                  </li>
                  <li>
                    <strong className="text-foreground">Arrastre:</strong> saldo del puente de carga
                    que se conserva sin vencimiento automático.
                  </li>
                  <li>
                    <strong className="text-foreground">Tomados:</strong> días disfrutados del
                    período.
                  </li>
                  <li>
                    <strong className="text-foreground">Pendientes:</strong> generados + compensados
                    + ajustados + arrastre − vencidos − tomados.
                  </li>
                </ul>
              </PopoverContent>
            </Popover>
          </span>
        }
        subtitle="Saldos por período de servicio. El arrastre solo aparece cuando existe."
        showRowCount
        showDensityToggle
        showColumnToggle
        showExportButton
        onExport={exportar}
        pagination
        pageSize={10}
      />

      <SaldoDetalleModal
        saldo={selectedSaldo}
        onClose={() => setSelectedSaldo(null)}
        onUpdated={loadSaldos}
      />
    </div>
  );
}
