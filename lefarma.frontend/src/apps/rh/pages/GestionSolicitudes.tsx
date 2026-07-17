import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermission } from '@/hooks/usePermission';
import { useSolicitudesAutorizaciones } from '@/hooks/useSolicitudes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { Modal } from '@/components/ui/modal';
import { InlineLoader } from '@/components/ui/inline-loader';
import { SolicitudesTable } from '../components/SolicitudesTable';
import { SolicitudHeaderCard } from '../components/SolicitudHeaderCard';
import { SolicitudDetalleTab } from '../components/SolicitudDetalleTab';
import { SolicitudArchivosTab } from '../components/SolicitudArchivosTab';
import { SolicitudFlujoTab } from '../components/SolicitudFlujoTab';
import { API } from '@/shared/api/apiClient';
import { ApiResponse } from '@/types/api.types';
import { solicitudesPersonalApi } from '../services/rh.api';
import { tipoSolicitudApi } from '../services/rh.api';
import { usuariosCatalogoApi, type UsuarioCatalogo } from '../services/rh.api';
import {
  CATEGORIAS_SOLICITUD,
  type SolicitudPersonalResponse,
  type SolicitudPersonalFilterParams,
  type TipoSolicitudResponse,
} from '@/types/solicitudPersonal.types';
import type { WorkflowEstado } from '@/types/workflow.types';
import type { Empresa, Sucursal, Area } from '@/types/catalogo.types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import {
  FileText,
  Paperclip,
  History,
  Search,
  RotateCcw,
  Filter,
  Tag,
  LayoutGrid,
} from 'lucide-react';

const NONE_VALUE = 'none';

type VistaKey = 'ninguna' | 'empresa' | 'sucursal' | 'area' | 'tipo' | 'usuario' | 'estado';

const VISTAS: Array<{ value: VistaKey; label: string }> = [
  { value: 'ninguna', label: 'Sin agrupación' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'sucursal', label: 'Sucursal' },
  { value: 'area', label: 'Área' },
  { value: 'tipo', label: 'Tipo de solicitud' },
  { value: 'usuario', label: 'Usuario creador' },
  { value: 'estado', label: 'Estado' },
];

type SelectValue = number | typeof NONE_VALUE;

interface Filters {
  idEmpresa: SelectValue;
  idSucursal: SelectValue;
  idArea: SelectValue;
  idTipoSolicitud: SelectValue;
  categoria: string;
  idUsuarioCreador: SelectValue;
  idsEstados: number[];
  fechaCreacionDesde: string | null;
  fechaCreacionHasta: string | null;
  fechaDiasDesde: string | null;
  fechaDiasHasta: string | null;
  busqueda: string;
}

const initialFilters: Filters = {
  idEmpresa: NONE_VALUE,
  idSucursal: NONE_VALUE,
  idArea: NONE_VALUE,
  idTipoSolicitud: NONE_VALUE,
  categoria: NONE_VALUE,
  idUsuarioCreador: NONE_VALUE,
  idsEstados: [],
  fechaCreacionDesde: null,
  fechaCreacionHasta: null,
  fechaDiasDesde: null,
  fechaDiasHasta: null,
  busqueda: '',
};

export default function GestionSolicitudes() {
  usePageTitle('Gestión de Solicitudes', 'Gestión y filtrado avanzado de solicitudes de personal');
  const puedeVerTodas = usePermission({ require: 'solicitud_personal.puede_ver_todas_solcitudes' });

  const {
    fetchDetalleCompleto,
    fetchHistorial,
    getEstadoInfo,
    selectedSolicitud,
    selectSolicitud,
    loadingDetalle,
    loadingHistorial,
    historial,
    pasosWorkflow,
  } = useSolicitudesAutorizaciones();

  const [rawItems, setRawItems] = useState<SolicitudPersonalResponse[]>([]);
  const items = rawItems;
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [busquedaServer, setBusquedaServer] = useState('');
  const [vista, setVista] = useState<VistaKey>('ninguna');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [totalCount, setTotalCount] = useState(0);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tipos, setTipos] = useState<TipoSolicitudResponse[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCatalogo[]>([]);
  const [workflowEstados, setWorkflowEstados] = useState<WorkflowEstado[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);

  const [modalStates, setModalStates] = useState({
    detalle: false,
    archivos: false,
    historial: false,
  });

  const toggleModal = (modalName: keyof typeof modalStates, state?: boolean) => {
    setModalStates((prev) => ({
      ...prev,
      [modalName]: state ?? !prev[modalName],
    }));
  };

  const closeModal = (modalName: keyof typeof modalStates) => {
    toggleModal(modalName, false);
    selectSolicitud(null);
  };

  const setFilterAndResetPage = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  useEffect(() => {
    const loadCatalogs = async () => {
      setLoadingCatalogs(true);
      try {
        const [empRes, sucRes, areaRes, tipoRes, estRes] = await Promise.all([
          API.get<ApiResponse<Empresa[]>>('/catalogos/Empresas'),
          API.get<ApiResponse<Sucursal[]>>('/catalogos/Sucursales'),
          API.get<ApiResponse<Area[]>>('/catalogos/Areas'),
          tipoSolicitudApi.getActivos(),
          API.get<ApiResponse<WorkflowEstado[]>>('/config/workflows/estados'),
          usuariosCatalogoApi.getAll().then((u) => setUsuarios(u)),
        ]);

        if (empRes.data.success) setEmpresas(empRes.data.data ?? []);
        if (sucRes.data.success) setSucursales(sucRes.data.data ?? []);
        if (areaRes.data.success) setAreas(areaRes.data.data ?? []);
        if (tipoRes.data.success) setTipos(tipoRes.data.data ?? []);
        if (estRes.data.success) setWorkflowEstados(estRes.data.data ?? []);
      } catch {
        toast.error('No se pudieron cargar todos los catálogos');
      } finally {
        setLoadingCatalogs(false);
      }
    };
    loadCatalogs();
  }, []);

  const sucursalesFiltradas = useMemo(() => {
    if (filters.idEmpresa === NONE_VALUE) return sucursales;
    return sucursales.filter((s) => Number(s.idEmpresa) === filters.idEmpresa);
  }, [sucursales, filters.idEmpresa]);

  const areasFiltradas = useMemo(() => {
    let list = areas;
    if (filters.idEmpresa !== NONE_VALUE) {
      list = list.filter((a) => Number(a.idEmpresa) === filters.idEmpresa);
    }
    if (filters.idSucursal !== NONE_VALUE) {
      list = list.filter(
        (a) => a.idSucursal == null || Number(a.idSucursal) === filters.idSucursal
      );
    }
    return list;
  }, [areas, filters.idEmpresa, filters.idSucursal]);

  const buscar = useCallback(async () => {
    if (!puedeVerTodas) {
      toast.error('No tienes permiso para ver todas las solicitudes');
      return;
    }
    setLoading(true);
    try {
      const params: SolicitudPersonalFilterParams = {
        verTodas: true,
        orderBy: 'FechaCreacion',
        orderDirection: 'desc',
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
      };
      if (filters.idEmpresa !== NONE_VALUE) params.idEmpresa = filters.idEmpresa;
      if (filters.idSucursal !== NONE_VALUE) params.idSucursal = filters.idSucursal;
      if (filters.idArea !== NONE_VALUE) params.idArea = filters.idArea;
      if (filters.idTipoSolicitud !== NONE_VALUE) params.idTipoSolicitud = filters.idTipoSolicitud;
      if (filters.categoria !== NONE_VALUE) params.categoria = filters.categoria;
      if (filters.idUsuarioCreador !== NONE_VALUE)
        params.idUsuarioCreador = filters.idUsuarioCreador;
      if (filters.idsEstados.length > 0) params.idsEstados = filters.idsEstados.join(',');
      if (filters.busqueda.trim()) params.busqueda = filters.busqueda.trim();
      if (filters.fechaCreacionDesde) params.fechaCreacionDesde = filters.fechaCreacionDesde;
      if (filters.fechaCreacionHasta) params.fechaCreacionHasta = filters.fechaCreacionHasta;
      if (filters.fechaDiasDesde) params.fechaDiasDesde = filters.fechaDiasDesde;
      if (filters.fechaDiasHasta) params.fechaDiasHasta = filters.fechaDiasHasta;

      const response = await solicitudesPersonalApi.getAll(params);
      if (response.data.success) {
        const paged = response.data.data;
        setRawItems(paged?.items ?? []);
        setTotalCount(paged?.totalCount ?? 0);
      } else {
        setRawItems([]);
        setTotalCount(0);
        toast.error(response.data.message ?? 'Error al cargar solicitudes');
      }
    } catch (error: unknown) {
      const err = toApiError(error);
      toast.error(err.message ?? 'Error al cargar solicitudes');
      setRawItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    filters.idEmpresa,
    filters.idSucursal,
    filters.idArea,
    filters.idTipoSolicitud,
    filters.categoria,
    filters.idUsuarioCreador,
    filters.idsEstados,
    filters.busqueda,
    filters.fechaCreacionDesde,
    filters.fechaCreacionHasta,
    filters.fechaDiasDesde,
    filters.fechaDiasHasta,
    pagination,
    puedeVerTodas,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    buscar();
  }, [buscar]);

  const limpiar = () => {
    setFilters(initialFilters);
    setBusquedaServer('');
    setPagination({ pageIndex: 0, pageSize: 10 });
    setTimeout(buscar, 0);
  };

  const handleEmpresaChange = (val: string) => {
    const idEmpresa = val === NONE_VALUE ? NONE_VALUE : Number(val);
    setFilters((prev) => ({
      ...prev,
      idEmpresa,
      idSucursal: NONE_VALUE,
      idArea: NONE_VALUE,
    }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleSucursalChange = (val: string) => {
    const idSucursal = val === NONE_VALUE ? NONE_VALUE : Number(val);
    setFilters((prev) => ({
      ...prev,
      idSucursal,
      idArea: NONE_VALUE,
    }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleEstadoToggle = (idEstado: number) => {
    setFilters((prev) =>
      prev.idsEstados.includes(idEstado)
        ? { ...prev, idsEstados: prev.idsEstados.filter((e) => e !== idEstado) }
        : { ...prev, idsEstados: [...prev.idsEstados, idEstado] }
    );
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleOpenDetalle = (s: SolicitudPersonalResponse) => {
    selectSolicitud(s.idSolicitud);
    fetchDetalleCompleto(s.idSolicitud);
    toggleModal('detalle', true);
  };

  const handleOpenArchivos = (s: SolicitudPersonalResponse) => {
    selectSolicitud(s.idSolicitud);
    fetchDetalleCompleto(s.idSolicitud);
    toggleModal('archivos', true);
  };

  const handleOpenHistorial = (s: SolicitudPersonalResponse) => {
    selectSolicitud(s.idSolicitud);
    fetchDetalleCompleto(s.idSolicitud);
    fetchHistorial(s.idSolicitud);
    toggleModal('historial', true);
  };

  const categoriasOptions = useMemo(
    () => Object.entries(CATEGORIAS_SOLICITUD).filter(([key]) => /^[1-9]\d*$/.test(key)),
    []
  );

  const estadosActivos = useMemo(
    () => workflowEstados.filter((e) => e.activo).sort((a, b) => a.idEstado - b.idEstado),
    [workflowEstados]
  );

  const grupos = useMemo(() => {
    const getLabel = (s: SolicitudPersonalResponse): string => {
      switch (vista) {
        case 'empresa':
          return s.empresaNombre ?? `Empresa ${s.idEmpresa}`;
        case 'sucursal':
          return s.sucursalNombre ?? `Sucursal ${s.idSucursal}`;
        case 'area':
          return s.areaNombre ?? `Área ${s.idArea}`;
        case 'tipo':
          return s.tipoSolicitudNombre ?? `Tipo ${s.idTipoSolicitud}`;
        case 'usuario':
          return s.solicitanteNombre ?? `Usuario ${s.idUsuarioCreador}`;
        case 'estado':
          return s.estadoNombre ?? `Estado ${s.idEstado}`;
        default:
          return '';
      }
    };

    if (vista === 'ninguna') return [];
    const map = new Map<string, SolicitudPersonalResponse[]>();
    for (const s of items) {
      const key = getLabel(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es-MX'))
      .map(([label, data]) => ({ label, data }));
  }, [items, vista]);

  return (
    <div className="w-full space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Empresa</label>
              <Select
                value={String(filters.idEmpresa)}
                onValueChange={handleEmpresaChange}
                disabled={loadingCatalogs}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.idEmpresa} value={String(e.idEmpresa)}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sucursal</label>
              <Select
                value={String(filters.idSucursal)}
                onValueChange={handleSucursalChange}
                disabled={loadingCatalogs || filters.idEmpresa === NONE_VALUE}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todas</SelectItem>
                  {sucursalesFiltradas.map((s) => (
                    <SelectItem key={s.idSucursal} value={String(s.idSucursal)}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Área</label>
              <Select
                value={String(filters.idArea)}
                onValueChange={(v) =>
                  setFilterAndResetPage('idArea', v === NONE_VALUE ? NONE_VALUE : Number(v))
                }
                disabled={loadingCatalogs || filters.idSucursal === NONE_VALUE}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todas</SelectItem>
                  {areasFiltradas.map((a) => (
                    <SelectItem key={a.idArea} value={String(a.idArea)}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de solicitud</label>
              <Select
                value={String(filters.idTipoSolicitud)}
                onValueChange={(v) =>
                  setFilterAndResetPage(
                    'idTipoSolicitud',
                    v === NONE_VALUE ? NONE_VALUE : Number(v)
                  )
                }
                disabled={loadingCatalogs}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todos</SelectItem>
                  {tipos.map((t) => (
                    <SelectItem key={t.idTipoSolicitud} value={String(t.idTipoSolicitud)}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Categoría</label>
              <Select
                value={filters.categoria}
                onValueChange={(v) => setFilterAndResetPage('categoria', v)}
                disabled={loadingCatalogs}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todas</SelectItem>
                  {categoriasOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Usuario creador</label>
              <Select
                value={String(filters.idUsuarioCreador)}
                onValueChange={(v) =>
                  setFilterAndResetPage(
                    'idUsuarioCreador',
                    v === NONE_VALUE ? NONE_VALUE : Number(v)
                  )
                }
                disabled={loadingCatalogs}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todos</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u.idUsuario} value={String(u.idUsuario)}>
                      {u.nombreCompleto || u.samAccountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estados</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 w-full justify-start font-normal">
                    <Tag className="mr-2 h-4 w-4 shrink-0" />
                    {filters.idsEstados.length === 0
                      ? 'Todos los estados'
                      : `${filters.idsEstados.length} estado${filters.idsEstados.length !== 1 ? 's' : ''}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 space-y-1 p-2">
                  {estadosActivos.length === 0 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No hay estados</p>
                  )}
                  {estadosActivos.map((e) => {
                    const checked = filters.idsEstados.includes(e.idEstado);
                    return (
                      <button
                        key={e.idEstado}
                        type="button"
                        onClick={() => handleEstadoToggle(e.idEstado)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted',
                          checked && 'bg-muted'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-3.5 w-3.5 items-center justify-center rounded border',
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input'
                          )}
                        >
                          {checked && (
                            <svg
                              viewBox="0 0 12 12"
                              className="h-2.5 w-2.5 fill-none stroke-current stroke-2"
                            >
                              <path d="M2 6.5l2.5 2.5L10 3" />
                            </svg>
                          )}
                        </span>
                        {e.nombre}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Buscar folio</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Folio..."
                  value={busquedaServer}
                  onChange={(e) => setBusquedaServer(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Creación desde</label>
              <DatePicker
                value={filters.fechaCreacionDesde}
                onChange={(v) => setFilterAndResetPage('fechaCreacionDesde', v)}
                placeholder="Fecha inicio"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Creación hasta</label>
              <DatePicker
                value={filters.fechaCreacionHasta}
                onChange={(v) => setFilterAndResetPage('fechaCreacionHasta', v)}
                placeholder="Fecha fin"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Días solicitados desde
              </label>
              <DatePicker
                value={filters.fechaDiasDesde}
                onChange={(v) => setFilterAndResetPage('fechaDiasDesde', v)}
                placeholder="Fecha inicio"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Días solicitados hasta
              </label>
              <DatePicker
                value={filters.fechaDiasHasta}
                onChange={(v) => setFilterAndResetPage('fechaDiasHasta', v)}
                placeholder="Fecha fin"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={limpiar} disabled={loading}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Limpiar filtros
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setFilters((prev) => ({ ...prev, busqueda: busquedaServer }));
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
              disabled={loading}
            >
              {loading ? (
                <>Buscando...</>
              ) : (
                <>
                  <Search className="mr-1.5 h-4 w-4" />
                  Buscar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {loading
              ? 'Cargando...'
              : `${totalCount} solicitud${totalCount !== 1 ? 'es' : ''} encontrada${totalCount !== 1 ? 's' : ''}`}
          </span>
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <Select value={vista} onValueChange={(v) => setVista(v as VistaKey)}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Agrupar por..." />
              </SelectTrigger>
              <SelectContent>
                {VISTAS.map((v) => (
                  <SelectItem key={v.value} value={v.value} className="text-xs">
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {vista === 'ninguna' ? (
        <SolicitudesTable
          data={items}
          loading={loading || loadingCatalogs}
          title="Resultados"
          subtitle="Solicitudes que coinciden con los filtros seleccionados"
          getEstadoInfo={getEstadoInfo}
          onDetalle={handleOpenDetalle}
          onFirma={() => {}}
          onArchivos={handleOpenArchivos}
          onHistorial={handleOpenHistorial}
          showFirma={false}
          showEditar={false}
          onRefresh={buscar}
          pageSize={pagination.pageSize}
          globalFilter
          manualPagination
          totalCount={totalCount}
          paginationState={pagination}
          onPaginationChange={setPagination}
        />
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border py-16 text-sm text-muted-foreground">
          <Filter className="h-8 w-8 opacity-30" />
          <p>No hay solicitudes para agrupar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(({ label, data }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  {label}
                  <span className="text-muted-foreground/70 ml-2 text-xs font-normal">
                    ({data.length} solicitud{data.length !== 1 ? 'es' : ''})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SolicitudesTable
                  data={data}
                  loading={loading}
                  getEstadoInfo={getEstadoInfo}
                  onDetalle={handleOpenDetalle}
                  onFirma={() => {}}
                  onArchivos={handleOpenArchivos}
                  onHistorial={handleOpenHistorial}
                  showFirma={false}
                  showEditar={false}
                  onRefresh={buscar}
                  globalFilter
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        id="modal-admin-solicitud-detalle"
        open={modalStates.detalle}
        setOpen={(o) => {
          if (!o) closeModal('detalle');
        }}
        title={
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span>Detalle de solicitud</span>
          </div>
        }
        size="full"
      >
        {selectedSolicitud && (
          <div className="mb-4">
            <SolicitudHeaderCard solicitud={selectedSolicitud} getEstadoInfo={getEstadoInfo} />
          </div>
        )}
        {loadingDetalle && <InlineLoader message="Cargando detalle..." />}
        {!loadingDetalle && selectedSolicitud && (
          <SolicitudDetalleTab solicitud={selectedSolicitud} />
        )}
      </Modal>

      <Modal
        id="modal-admin-solicitud-archivos"
        open={modalStates.archivos}
        setOpen={(o) => {
          if (!o) closeModal('archivos');
        }}
        title={
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            <span>Archivos de solicitud</span>
          </div>
        }
        size="full"
      >
        {selectedSolicitud && (
          <div className="mb-4">
            <SolicitudHeaderCard solicitud={selectedSolicitud} getEstadoInfo={getEstadoInfo} />
          </div>
        )}
        {selectedSolicitud && <SolicitudArchivosTab idSolicitud={selectedSolicitud.idSolicitud} />}
      </Modal>

      <Modal
        id="modal-admin-solicitud-historial"
        open={modalStates.historial}
        setOpen={(o) => {
          if (!o) closeModal('historial');
        }}
        title={
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <span>Historial de solicitud</span>
          </div>
        }
        size="full"
      >
        {selectedSolicitud && (
          <div className="mb-4">
            <SolicitudHeaderCard solicitud={selectedSolicitud} getEstadoInfo={getEstadoInfo} />
          </div>
        )}
        {loadingHistorial && <InlineLoader message="Cargando historial..." />}
        {!loadingHistorial && selectedSolicitud && (
          <SolicitudFlujoTab
            solicitud={selectedSolicitud}
            pasosWorkflow={pasosWorkflow}
            historial={historial}
          />
        )}
      </Modal>
    </div>
  );
}
