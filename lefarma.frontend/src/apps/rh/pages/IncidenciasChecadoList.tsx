import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Eye, Mail, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { incidenciasChecadoApi } from '../services/rh.api';
import { IncidenciasChecadoEmpleadoDetalleModal } from '../components/IncidenciasChecadoEmpleadoDetalleModal';
import { IncidenciasChecadoResumenNotificacionModal } from '../components/IncidenciasChecadoResumenNotificacionModal';
import type {
  IncidenciasChecadoResumenEmpleadoRequest,
  IncidenciasChecadoResumenEmpleadoResponse,
  PagedResult,
} from '@/types/solicitudPersonal.types';

const PERIODOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'esta-semana', label: 'Esta semana' },
  { value: 'esta-quincena', label: 'Esta quincena' },
  { value: 'quincena-anterior', label: 'Quincena anterior' },
  { value: 'este-mes', label: 'Este mes' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'personalizado', label: 'Personalizado' },
];

function toISODate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function calcularRangoPeriodo(periodo: string): { fechaInicio: string; fechaFin: string } {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = hoy.getMonth();
  const dd = hoy.getDate();
  const ultimoDiaMes = new Date(yyyy, mm + 1, 0).getDate();

  let resultado: { fechaInicio: string; fechaFin: string };

  switch (periodo) {
    case 'hoy':
      resultado = { fechaInicio: toISODate(hoy), fechaFin: toISODate(hoy) };
      break;
    case 'esta-semana': {
      const dow = hoy.getDay();
      const diff = (dow + 6) % 7;
      const inicio = new Date(yyyy, mm, dd - diff);
      const fin = new Date(yyyy, mm, dd - diff + 6);
      resultado = { fechaInicio: toISODate(inicio), fechaFin: toISODate(fin) };
      break;
    }
    case 'esta-quincena':
      if (dd <= 15) {
        resultado = { fechaInicio: toISODate(new Date(yyyy, mm, 1)), fechaFin: toISODate(new Date(yyyy, mm, 15)) };
      } else {
        resultado = { fechaInicio: toISODate(new Date(yyyy, mm, 16)), fechaFin: toISODate(new Date(yyyy, mm, ultimoDiaMes)) };
      }
      break;
    case 'quincena-anterior':
      if (dd <= 15) {
        const ultimoDiaMesAnterior = new Date(yyyy, mm, 0).getDate();
        resultado = { fechaInicio: toISODate(new Date(yyyy, mm - 1, 16)), fechaFin: toISODate(new Date(yyyy, mm - 1, ultimoDiaMesAnterior)) };
      } else {
        resultado = { fechaInicio: toISODate(new Date(yyyy, mm, 1)), fechaFin: toISODate(new Date(yyyy, mm, 15)) };
      }
      break;
    case 'este-mes':
      resultado = { fechaInicio: toISODate(new Date(yyyy, mm, 1)), fechaFin: toISODate(new Date(yyyy, mm, ultimoDiaMes)) };
      break;
    case 'mes-anterior': {
      const ultimoDiaMesAnterior = new Date(yyyy, mm, 0).getDate();
      resultado = { fechaInicio: toISODate(new Date(yyyy, mm - 1, 1)), fechaFin: toISODate(new Date(yyyy, mm - 1, ultimoDiaMesAnterior)) };
      break;
    }
    case 'personalizado':
    default:
      return { fechaInicio: '', fechaFin: '' };
  }

  const fechaFinLimite = toISODate(hoy);
  if (resultado.fechaFin > fechaFinLimite) {
    resultado.fechaFin = fechaFinLimite;
  }

  return resultado;
}

interface Filters {
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  nomina: string;
  nombre: string;
  empresa: string;
  departamento: string;
  puesto: string;
  tieneIncidenciaEntrada: boolean;
  tieneIncidenciaSalida: boolean;
  tieneIncidenciaOmision: boolean;
}

export default function IncidenciasChecadoList() {
  usePageTitle('Incidencias de checado', 'Gestión de incidencias de checado');

  const rangoInicial = useMemo(() => calcularRangoPeriodo('quincena-anterior'), []);

  const initialFilters: Filters = {
    periodo: 'quincena-anterior',
    fechaInicio: rangoInicial.fechaInicio,
    fechaFin: rangoInicial.fechaFin,
    nomina: '',
    nombre: '',
    empresa: '',
    departamento: '',
    puesto: '',
    tieneIncidenciaEntrada: true,
    tieneIncidenciaSalida: true,
    tieneIncidenciaOmision: true,
  };

  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  const [data, setData] = useState<PagedResult<IncidenciasChecadoResumenEmpleadoResponse> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedEmpleados, setSelectedEmpleados] = useState<IncidenciasChecadoResumenEmpleadoResponse[]>([]);
  const [notificarModalOpen, setNotificarModalOpen] = useState(false);
  const [detalleEmpleado, setDetalleEmpleado] = useState<IncidenciasChecadoResumenEmpleadoResponse | null>(null);
  const requestIdRef = useRef(0);

  const fetchData = async (
    pageToFetch = page,
    pageSizeToFetch = pageSize,
    signal?: AbortSignal
  ) => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      const request: IncidenciasChecadoResumenEmpleadoRequest = {
        periodo: appliedFilters.periodo,
        fechaInicio: appliedFilters.fechaInicio,
        fechaFin: appliedFilters.fechaFin,
        nomina: appliedFilters.nomina ? Number(appliedFilters.nomina) : undefined,
        nombre: appliedFilters.nombre || undefined,
        empresa: appliedFilters.empresa || undefined,
        departamento: appliedFilters.departamento || undefined,
        puesto: appliedFilters.puesto || undefined,
        tieneIncidenciaEntrada: appliedFilters.tieneIncidenciaEntrada,
        tieneIncidenciaSalida: appliedFilters.tieneIncidenciaSalida,
        tieneIncidenciaOmision: appliedFilters.tieneIncidenciaOmision,
        page: pageToFetch,
        pageSize: pageSizeToFetch,
      };

      const response = await incidenciasChecadoApi.getResumen(request, signal);
      if (signal?.aborted || requestId !== requestIdRef.current) return;

      if (response.data.success) {
        setData(response.data.data ?? null);
      } else {
        setData(null);
      }
    } catch (error: unknown) {
      if (signal?.aborted || requestId !== requestIdRef.current) return;
      const err = toApiError(error);
      if (err.message === 'REQUEST_CANCELED') return;
      toast.error(err.message ?? 'No se pudieron cargar las incidencias.');
      setData(null);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(page, pageSize, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, page, pageSize]);

  const updateDraft = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setDraftFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'periodo' && value !== 'personalizado') {
        const rango = calcularRangoPeriodo(value as string);
        next.fechaInicio = rango.fechaInicio;
        next.fechaFin = rango.fechaFin;
      }
      return next;
    });
  };

  const handleBuscar = () => {
    if (draftFilters.periodo === 'personalizado') {
      if (!draftFilters.fechaInicio || !draftFilters.fechaFin) {
        toast.error('Selecciona la fecha de inicio y la fecha de fin.');
        return;
      }
    }
    setAppliedFilters(draftFilters);
    setPage(1);
  };

  const handleLimpiar = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const handleVerDetalle = useCallback((empleado: IncidenciasChecadoResumenEmpleadoResponse) => {
    setDetalleEmpleado(empleado);
  }, []);

  const handleSelectionChange = useCallback((rows: IncidenciasChecadoResumenEmpleadoResponse[]) => {
    setSelectedEmpleados(rows);
  }, []);

  const columns: ColumnDef<IncidenciasChecadoResumenEmpleadoResponse>[] = useMemo(
    () => [
      {
        accessorKey: 'nomina',
        header: 'Nómina',
        cell: ({ row }) => row.original.nomina,
      },
      {
        accessorKey: 'nombre',
        header: 'Nombre',
      },
      {
        accessorKey: 'empresa',
        header: 'Empresa',
        cell: ({ row }) => row.original.empresa ?? '-',
      },
      {
        accessorKey: 'departamento',
        header: 'Departamento',
        cell: ({ row }) => row.original.departamento ?? '-',
      },
      {
        accessorKey: 'puesto',
        header: 'Puesto',
        cell: ({ row }) => row.original.puesto ?? '-',
      },
      {
        accessorKey: 'totalIncidencias',
        header: 'Total incidencias',
      },
      {
        accessorKey: 'tardanzas',
        header: 'Tardanzas',
      },
      {
        accessorKey: 'salidasAnticipadas',
        header: 'Salidas anticipadas',
      },
      {
        accessorKey: 'omisiones',
        header: 'Omisiones',
      },
      {
        accessorKey: 'justificadas',
        header: 'Justificadas',
      },
      {
        accessorKey: 'pendientes',
        header: 'Pendientes',
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleVerDetalle(row.original)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Ver detalle
          </Button>
        ),
      },
    ],
    [handleVerDetalle]
  );

  const paginationState: PaginationState = useMemo(
    () => ({
      pageIndex: page - 1,
      pageSize,
    }),
    [page, pageSize]
  );

  const handlePaginationChange = (state: PaginationState) => {
    setPage(state.pageIndex + 1);
    setPageSize(state.pageSize);
  };

  const esPersonalizado = draftFilters.periodo === 'personalizado';

  return (
    <div className="w-full space-y-6">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draftFilters.periodo}
                onChange={(e) => updateDraft('periodo', e.target.value)}
              >
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {esPersonalizado && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fecha inicio</label>
                  <Input
                    type="date"
                    value={draftFilters.fechaInicio}
                    onChange={(e) => updateDraft('fechaInicio', e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fecha fin</label>
                  <Input
                    type="date"
                    value={draftFilters.fechaFin}
                    onChange={(e) => updateDraft('fechaFin', e.target.value)}
                    className="h-10"
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nómina</label>
              <Input
                type="text"
                placeholder="Nómina"
                value={draftFilters.nomina}
                onChange={(e) => updateDraft('nomina', e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input
                type="text"
                placeholder="Nombre del empleado"
                value={draftFilters.nombre}
                onChange={(e) => updateDraft('nombre', e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Empresa</label>
              <Input
                type="text"
                placeholder="Empresa"
                value={draftFilters.empresa}
                onChange={(e) => updateDraft('empresa', e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Departamento</label>
              <Input
                type="text"
                placeholder="Departamento"
                value={draftFilters.departamento}
                onChange={(e) => updateDraft('departamento', e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Puesto</label>
              <Input
                type="text"
                placeholder="Puesto"
                value={draftFilters.puesto}
                onChange={(e) => updateDraft('puesto', e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="tieneIncidenciaEntrada"
                  checked={draftFilters.tieneIncidenciaEntrada}
                  onCheckedChange={(checked) => updateDraft('tieneIncidenciaEntrada', !!checked)}
                />
                <label htmlFor="tieneIncidenciaEntrada" className="cursor-pointer text-sm">
                  Con incidencia entrada
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="tieneIncidenciaSalida"
                  checked={draftFilters.tieneIncidenciaSalida}
                  onCheckedChange={(checked) => updateDraft('tieneIncidenciaSalida', !!checked)}
                />
                <label htmlFor="tieneIncidenciaSalida" className="cursor-pointer text-sm">
                  Con incidencia salida
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="tieneIncidenciaOmision"
                  checked={draftFilters.tieneIncidenciaOmision}
                  onCheckedChange={(checked) => updateDraft('tieneIncidenciaOmision', !!checked)}
                />
                <label htmlFor="tieneIncidenciaOmision" className="cursor-pointer text-sm">
                  Con omisión de checado
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleLimpiar} disabled={loading}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Limpiar filtros
              </Button>
              <Button size="sm" onClick={handleBuscar} disabled={loading}>
                {loading ? (
                  'Buscando...'
                ) : (
                  <>
                    <Search className="mr-1.5 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedEmpleados.length === 0 || !appliedFilters.fechaInicio || !appliedFilters.fechaFin}
              onClick={() => setNotificarModalOpen(true)}
            >
              <Mail className="mr-1.5 h-4 w-4" />
              Notificar {selectedEmpleados.length > 0 && `(${selectedEmpleados.length})`}
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={data?.items ?? []}
            title="Resumen de incidencias por empleado"
            pagination
            manualPagination
            totalCount={data?.totalCount}
            paginationState={paginationState}
            onPaginationChange={handlePaginationChange}
            showRefreshButton
            globalFilter
            enableRowSelection
            getRowId={(row) => String(row.nomina)}
            onSelectionChange={handleSelectionChange}
            filterConfig={{
              tableId: 'admin-incidencias-checado-resumen',
              searchableColumns: ['nomina', 'nombre', 'empresa', 'departamento', 'puesto'],
              defaultSearchColumns: ['nombre'],
            }}
            onRefresh={() => fetchData(page, pageSize)}
            loading={loading}
          />
        </CardContent>
      </Card>

      {detalleEmpleado && (
        <IncidenciasChecadoEmpleadoDetalleModal
          open={!!detalleEmpleado}
          onClose={() => setDetalleEmpleado(null)}
          nomina={detalleEmpleado.nomina}
          nombre={detalleEmpleado.nombre}
          fechaInicio={appliedFilters.fechaInicio}
          fechaFin={appliedFilters.fechaFin}
        />
      )}

      <IncidenciasChecadoResumenNotificacionModal
        key={notificarModalOpen ? 'open' : 'closed'}
        open={notificarModalOpen}
        setOpen={setNotificarModalOpen}
        empleados={selectedEmpleados}
        periodo={appliedFilters.periodo}
        fechaInicio={appliedFilters.fechaInicio}
        fechaFin={appliedFilters.fechaFin}
        onEnviado={() => {
          fetchData(page, pageSize);
          setSelectedEmpleados([]);
        }}
      />
    </div>
  );
}
