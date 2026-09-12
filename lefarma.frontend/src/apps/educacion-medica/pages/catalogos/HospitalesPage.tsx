import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Search, Pencil, Loader2, RotateCcw, Map, MapPin, Sparkles } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import type {
  Hospital,
  HospitalFilterParams,
  HospitalUbicacion,
  TipoGerencia,
  UpsertHospitalExtensionRequest,
  Region,
  SugerenciaRegionResponse,
} from '@/apps/educacion-medica/types/educacionMedica.types';

const HospitalesMap = lazy(() =>
  import('@/apps/educacion-medica/components/HospitalesMap').then((m) => ({
    default: m.HospitalesMap,
  }))
);

const NONE_VALUE = 'none';
const TIPO_GERENCIA_NONE = 'none';

const extensionSchema = z.object({
  fecha: z.string().nullable().optional(),
  idTipoGerencia: z.string().optional(),
  idRegion: z.string().optional(),
  conSia: z.boolean().optional(),
  numeroQuirofanos: z.string().optional(),
});

type ExtensionFormValues = z.infer<typeof extensionSchema>;

const MODO_TODAS = 'todas';
const MODO_IMSS = 'imss';
const MODO_ISSSTE = 'issste';
const MODO_BIENESTAR = 'bienestar';
const MODO_OTRAS = 'otras';

const MODO_OPTIONS = [
  { value: MODO_TODAS, label: 'Todas' },
  { value: MODO_IMSS, label: 'IMSS' },
  { value: MODO_ISSSTE, label: 'ISSSTE' },
  { value: MODO_BIENESTAR, label: 'Bienestar' },
  { value: MODO_OTRAS, label: 'Otras' },
];

interface Filters {
  search: string;
  modoInstitucion: string;
  conSia: string;
  idTipoGerencia: string;
  idRegion: string;
  numeroQuirofanosMin: string;
  anestesiasTotalesMin: string;
  activo: string;
}

const initialFilters: Filters = {
  search: '',
  modoInstitucion: MODO_TODAS,
  conSia: NONE_VALUE,
  idTipoGerencia: NONE_VALUE,
  idRegion: NONE_VALUE,
  numeroQuirofanosMin: '',
  anestesiasTotalesMin: '',
  activo: 'true',
};

const PAGE_SIZE = 20;

function ReadOnlyField({ label, value }: { label: string; value: number | null | undefined }) {
  const formatted =
    value === null || value === undefined ? '-' : Number(value).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="h-9 rounded-md border bg-muted px-3 py-2 text-sm">{formatted}</div>
    </div>
  );
}

export default function HospitalesPage() {
  usePageTitle('Hospitales', 'Catálogo de Educación Médica');

  const [hospitales, setHospitales] = useState<Hospital[]>([]);
  const [tiposGerencia, setTiposGerencia] = useState<TipoGerencia[]>([]);
  const [zonas, setRegiones] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [busquedaServer, setBusquedaServer] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [sugerencia, setSugerencia] = useState<SugerenciaRegionResponse | null>(null);
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapHospitales, setMapHospitales] = useState<HospitalUbicacion[]>([]);
  const [mapSelectedCodigo, setMapSelectedCodigo] = useState<number | null>(null);

  const form = useForm<ExtensionFormValues>({
    resolver: zodResolver(extensionSchema),
    defaultValues: {
      fecha: null,
      idTipoGerencia: TIPO_GERENCIA_NONE,
      idRegion: NONE_VALUE,
      conSia: false,
      numeroQuirofanos: '',
    },
  });

  const fetchTiposGerencia = async () => {
    try {
      const response = await educacionMedicaApi.tipoGerencia.getAll();
      if (response.data.success) {
        setTiposGerencia(response.data.data ?? []);
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar tipos de gerencia');
    }
  };

  const fetchRegiones = async () => {
    try {
      const response = await educacionMedicaApi.regiones.getAll();
      if (response.data.success) {
        setRegiones((response.data.data ?? []).filter((z) => z.activo));
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar regiones');
    }
  };

  const buildParams = useCallback(
    (pageIndex: number, pageSize: number): HospitalFilterParams => {
      const params: HospitalFilterParams = {
        page: pageIndex + 1,
        pageSize,
        modoInstitucion: filters.modoInstitucion,
      };
      if (busquedaServer.trim()) params.search = busquedaServer.trim();
      if (filters.conSia !== NONE_VALUE) params.conSia = filters.conSia === 'true';
      if (filters.idTipoGerencia !== NONE_VALUE) {
        params.idTipoGerencia = Number(filters.idTipoGerencia);
      }
      if (filters.idRegion !== NONE_VALUE) {
        params.idRegion = Number(filters.idRegion);
      }
      if (filters.numeroQuirofanosMin.trim()) {
        const v = Number(filters.numeroQuirofanosMin);
        if (!isNaN(v) && v >= 0) params.numeroQuirofanosMin = v;
      }
      if (filters.anestesiasTotalesMin.trim()) {
        const v = Number(filters.anestesiasTotalesMin);
        if (!isNaN(v) && v >= 0) params.anestesiasTotalesMin = v;
      }
      if (filters.activo !== NONE_VALUE) params.activo = filters.activo === 'true';
      return params;
    },
    [filters, busquedaServer]
  );

  const buildMapFilterParams = useCallback((): HospitalFilterParams => {
    const params: HospitalFilterParams = {
      modoInstitucion: filters.modoInstitucion,
    };
    if (busquedaServer.trim()) params.search = busquedaServer.trim();
    if (filters.conSia !== NONE_VALUE) params.conSia = filters.conSia === 'true';
    if (filters.idTipoGerencia !== NONE_VALUE) {
      params.idTipoGerencia = Number(filters.idTipoGerencia);
    }
    if (filters.idRegion !== NONE_VALUE) {
      params.idRegion = Number(filters.idRegion);
    }
    if (filters.numeroQuirofanosMin.trim()) {
      const v = Number(filters.numeroQuirofanosMin);
      if (!isNaN(v) && v >= 0) params.numeroQuirofanosMin = v;
    }
    if (filters.anestesiasTotalesMin.trim()) {
      const v = Number(filters.anestesiasTotalesMin);
      if (!isNaN(v) && v >= 0) params.anestesiasTotalesMin = v;
    }
    if (filters.activo !== NONE_VALUE) params.activo = filters.activo === 'true';
    return params;
  }, [filters, busquedaServer]);

  const buscar = useCallback(
    async (pageIndex: number, pageSize: number) => {
      setLoading(true);
      try {
        const response = await educacionMedicaApi.hospitales.getAll(
          buildParams(pageIndex, pageSize)
        );
        if (response.data.success) {
          setHospitales(response.data.data?.items ?? []);
          setTotalCount(response.data.data?.totalCount ?? 0);
        } else {
          toast.error(response.data.message ?? 'Error al cargar hospitales');
          setHospitales([]);
          setTotalCount(0);
        }
      } catch (error: unknown) {
        toast.error(toApiError(error).message ?? 'Error al cargar hospitales');
        setHospitales([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  // Cargar catálogos al montar.
  useEffect(() => {
    fetchTiposGerencia();
    fetchRegiones();
  }, []);

  // Debounce solo para el campo de búsqueda.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.search !== busquedaServer) {
        setBusquedaServer(filters.search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search, busquedaServer]);

  // Disparar búsqueda cuando cambie la página o los filtros ya estén debounced.
  useEffect(() => {
    buscar(pagination.pageIndex, pagination.pageSize);
  }, [pagination, buscar]);

  // Cuando cambian los filtros (excepto paginación), regresar a la primera página.
  const filtersKey = useMemo(() => {
    const { search, ...rest } = filters;
    void search;
    return JSON.stringify(rest);
  }, [filters]);

  useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    );
  }, [filtersKey, busquedaServer]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const limpiar = () => {
    setFilters(initialFilters);
    setBusquedaServer('');
    setPagination({ pageIndex: 0, pageSize: PAGE_SIZE });
  };

  const handleEdit = useCallback((hospital: Hospital) => {
    setSelectedHospital(hospital);
    setSugerencia(null);
    form.reset({
      fecha: hospital.extension?.fecha ?? null,
      idTipoGerencia: hospital.extension?.idTipoGerencia
        ? String(hospital.extension.idTipoGerencia)
        : TIPO_GERENCIA_NONE,
      idRegion: hospital.extension?.idRegion
        ? String(hospital.extension.idRegion)
        : NONE_VALUE,
      conSia: hospital.extension?.conSia ?? false,
      numeroQuirofanos: hospital.extension?.numeroQuirofanos
        ? String(hospital.extension.numeroQuirofanos)
        : '',
    });
    setIsOpen(true);
  }, [form]);

  const cargarUbicaciones = useCallback(
    async (selectedCodigo?: number | null) => {
      setMapLoading(true);
      setMapSelectedCodigo(selectedCodigo ?? null);
      try {
        const response = await educacionMedicaApi.hospitales.getUbicaciones(
          buildMapFilterParams()
        );
        if (response.data.success) {
          setMapHospitales(response.data.data ?? []);
        } else {
          toast.error(response.data.message ?? 'Error al cargar ubicaciones');
          setMapHospitales([]);
        }
      } catch (error: unknown) {
        toast.error(toApiError(error).message ?? 'Error al cargar ubicaciones');
        setMapHospitales([]);
      } finally {
        setMapLoading(false);
      }
    },
    [buildMapFilterParams]
  );

  const handleOpenMap = useCallback(() => {
    setMapOpen(true);
    void cargarUbicaciones(null);
  }, [cargarUbicaciones]);

  const handleOpenUbicacion = useCallback(
    (hospital: Hospital) => {
      if (typeof hospital.latitud !== 'number' || typeof hospital.longitud !== 'number') {
        toast.info('El hospital no tiene coordenadas registradas');
        return;
      }
      setMapOpen(true);
      void cargarUbicaciones(hospital.codigoContacto);
    },
    [cargarUbicaciones]
  );

  const sugerirRegion = async () => {
    if (!selectedHospital) return;
    setCargandoSugerencia(true);
    try {
      const response = await educacionMedicaApi.regiones.getSugerencia(
        selectedHospital.codigoContacto
      );
      if (response.data.success) {
        setSugerencia(response.data.data ?? { porEstado: null, porGps: null });
      } else {
        toast.error(response.data.message ?? 'Error al obtener la sugerencia');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al obtener la sugerencia');
    } finally {
      setCargandoSugerencia(false);
    }
  };

  const handleSave = async (values: ExtensionFormValues) => {
    if (!selectedHospital) return;

    const idTipoGerencia =
      values.idTipoGerencia && values.idTipoGerencia !== TIPO_GERENCIA_NONE
        ? Number(values.idTipoGerencia)
        : null;
    const idRegion =
      values.idRegion && values.idRegion !== NONE_VALUE ? Number(values.idRegion) : null;
    const numeroQuirofanos = values.numeroQuirofanos
      ? Number(values.numeroQuirofanos)
      : null;

    if (numeroQuirofanos !== null && (isNaN(numeroQuirofanos) || numeroQuirofanos < 0)) {
      toast.error('El número de quirófanos debe ser mayor o igual a 0');
      return;
    }

    const payload: UpsertHospitalExtensionRequest = {
      fecha: values.fecha ?? null,
      idTipoGerencia,
      idRegion,
      conSia: values.conSia ?? false,
      numeroQuirofanos,
      // Se preserva la clasificación vigente hasta agregar el control en el formulario
      esZonaMetropolitana: selectedHospital.extension?.esZonaMetropolitana ?? null,
    };

    setSaving(true);
    try {
      const response = await educacionMedicaApi.hospitales.upsertExtension(
        selectedHospital.codigoContacto,
        payload
      );
      if (response.data.success) {
        toast.success('Extensión guardada correctamente');
        setIsOpen(false);
        buscar(pagination.pageIndex, pagination.pageSize);
      } else {
        toast.error(response.data.message ?? 'Error al guardar la extensión');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al guardar la extensión');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<ColumnDef<Hospital>[]>(
    () => [
      {
        id: 'clues',
        accessorKey: 'clues',
        header: 'CLUES',
        cell: ({ row }) => row.original.clues ?? '-',
      },
      {
        id: 'nombreContacto',
        accessorKey: 'nombreContacto',
        header: 'Hospital',
      },
      {
        id: 'institucion',
        header: 'Institución',
        cell: ({ row }) => row.original.institucion ?? '-',
      },
      {
        id: 'gerencia',
        header: 'Gerencia',
        cell: ({ row }) => row.original.extension?.tipoGerencia ?? '-',
      },
      {
        id: 'region',
        header: 'Región',
        cell: ({ row }) => row.original.extension?.regionNombre ?? '-',
      },
      {
        id: 'sia',
        header: 'SIA',
        cell: ({ row }) => (row.original.extension?.conSia ? 'Sí' : 'No'),
      },
      {
        id: 'quirofanos',
        header: 'Quirófanos',
        cell: ({ row }) => row.original.extension?.numeroQuirofanos ?? '-',
      },
      {
        id: 'anestesiasTotales',
        header: 'Anest. Totales',
        cell: ({ row }) => row.original.extension?.anestesiasTotales ?? '-',
      },
      {
        id: 'anestesiasGenerales',
        header: 'Generales',
        cell: ({ row }) => row.original.extension?.anestesiasGenerales ?? '-',
      },
      {
        id: 'anestesiasRegionales',
        header: 'Regionales',
        cell: ({ row }) => row.original.extension?.anestesiasRegionales ?? '-',
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              title="Ver ubicación"
              disabled={
                typeof row.original.latitud !== 'number' ||
                typeof row.original.longitud !== 'number'
              }
              onClick={() => handleOpenUbicacion(row.original)}
            >
              <MapPin className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => handleEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleOpenUbicacion]
  );

  return (
    <div className="w-full space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Institución</label>
              <Select
                value={filters.modoInstitucion}
                onValueChange={(v) => setFilter('modoInstitucion', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {MODO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">SIA</label>
              <Select
                value={filters.conSia}
                onValueChange={(v) => setFilter('conSia', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todos</SelectItem>
                  <SelectItem value="true">Con SIA</SelectItem>
                  <SelectItem value="false">Sin SIA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tipo de gerencia</label>
              <Select
                value={filters.idTipoGerencia}
                onValueChange={(v) => setFilter('idTipoGerencia', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todos</SelectItem>
                  {tiposGerencia.map((tipo) => (
                    <SelectItem key={tipo.idTipoGerencia} value={String(tipo.idTipoGerencia)}>
                      {tipo.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Región</label>
              <Select
                value={filters.idRegion}
                onValueChange={(v) => setFilter('idRegion', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todas</SelectItem>
                  {zonas.map((zona) => (
                    <SelectItem key={zona.idRegion} value={String(zona.idRegion)}>
                      {zona.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <Select
                value={filters.activo}
                onValueChange={(v) => setFilter('activo', v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Activo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Todos</SelectItem>
                  <SelectItem value="true">Activo</SelectItem>
                  <SelectItem value="false">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Quirófanos mín.</label>
              <Input
                type="number"
                min={0}
                className="h-9"
                placeholder="0"
                value={filters.numeroQuirofanosMin}
                onChange={(e) => setFilter('numeroQuirofanosMin', e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Anest. totales mín.</label>
              <Input
                type="number"
                min={0}
                className="h-9"
                placeholder="0"
                value={filters.anestesiasTotalesMin}
                onChange={(e) => setFilter('anestesiasTotalesMin', e.target.value)}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Nombre, CLUES, nombre corto..."
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={limpiar} disabled={loading}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Limpiar filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenMap}
              disabled={loading || mapLoading}
            >
              <Map className="mr-1.5 h-4 w-4" />
              Ver mapa
            </Button>
            <Button
              size="sm"
              onClick={() => buscar(pagination.pageIndex, pagination.pageSize)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={hospitales}
        title="Listado de Hospitales"
        subtitle="Hospitales reales con extensión del módulo"
        showRowCount
        showRefreshButton
        pagination
        manualPagination
        totalCount={totalCount}
        paginationState={pagination}
        onPaginationChange={setPagination}
        pageSizeOverride={PAGE_SIZE}
        onRefresh={() => buscar(pagination.pageIndex, pagination.pageSize)}
        filterConfig={{
          tableId: 'educacion-medica-hospitales',
          searchableColumns: ['clues', 'nombreContacto', 'institucion'],
          defaultSearchColumns: ['clues', 'nombreContacto'],
        }}
        loading={loading}
      />

      <Modal
        id="modal-hospital-extension"
        open={isOpen}
        setOpen={setIsOpen}
        title={`Editar extensión - ${selectedHospital?.nombreContacto ?? ''}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={form.handleSubmit(handleSave)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        }
      >
        <Form {...form}>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Institución
                </label>
                <Input
                  readOnly
                  value={selectedHospital?.institucion ?? 'Sin clasificar'}
                />
              </div>

              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value ?? null}
                        onChange={field.onChange}
                        placeholder="Seleccionar fecha"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="idTipoGerencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Gerencia</FormLabel>
                    <Select
                      value={field.value ?? TIPO_GERENCIA_NONE}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={TIPO_GERENCIA_NONE}>Sin clasificar</SelectItem>
                        {tiposGerencia.map((tipo) => (
                          <SelectItem key={tipo.idTipoGerencia} value={String(tipo.idTipoGerencia)}>
                            {tipo.descripcion}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="idRegion"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Región</FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => void sugerirRegion()}
                        disabled={cargandoSugerencia}
                      >
                        {cargandoSugerencia ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Sugerir
                      </Button>
                    </div>
                    <Select
                      value={field.value ?? NONE_VALUE}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Sin región</SelectItem>
                        {zonas.map((zona) => (
                          <SelectItem key={zona.idRegion} value={String(zona.idRegion)}>
                            {zona.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sugerencia && (
                      <div className="space-y-1.5 rounded-md border bg-muted/40 p-2">
                        {sugerencia.porEstado && (
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span>
                              Por estado:{' '}
                              <span className="font-medium">
                                {sugerencia.porEstado.nombreRegion}
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() =>
                                field.onChange(String(sugerencia.porEstado!.idRegion))
                              }
                            >
                              Usar
                            </Button>
                          </div>
                        )}
                        {sugerencia.porGps && (
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span>
                              Por GPS:{' '}
                              <span className="font-medium">
                                {sugerencia.porGps.nombreRegion}
                              </span>
                              {sugerencia.porGps.distanciaKm != null && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  ({sugerencia.porGps.distanciaKm} km)
                                </span>
                              )}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => field.onChange(String(sugerencia.porGps!.idRegion))}
                            >
                              Usar
                            </Button>
                          </div>
                        )}
                        {!sugerencia.porEstado && !sugerencia.porGps && (
                          <p className="text-xs text-muted-foreground">
                            No hay sugerencia disponible (sin coordenadas GPS ni mapeo del
                            estado).
                          </p>
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium leading-none text-muted-foreground">
                  Coordenadas GPS
                </label>
                <Input
                  readOnly
                  value={
                    typeof selectedHospital?.latitud === 'number' &&
                    typeof selectedHospital?.longitud === 'number'
                      ? `${selectedHospital.latitud.toFixed(6)}, ${selectedHospital.longitud.toFixed(6)}`
                      : 'Sin coordenadas registradas'
                  }
                />
              </div>

              <FormField
                control={form.control}
                name="numeroQuirofanos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de quirófanos</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="conSia"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Con servicio de anestesia integral (SIA)</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Valores calculados
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Anestesias totales" value={selectedHospital?.extension?.anestesiasTotales} />
                <ReadOnlyField label="Generales" value={selectedHospital?.extension?.anestesiasGenerales} />
                <ReadOnlyField label="Regionales" value={selectedHospital?.extension?.anestesiasRegionales} />
                <ReadOnlyField label="Epidurales" value={selectedHospital?.extension?.anestesiasEpidurales} />
                <ReadOnlyField label="Subdurales" value={selectedHospital?.extension?.anestesiasSubdurales} />
                <ReadOnlyField label="Mixtas obesos" value={selectedHospital?.extension?.anestesiasMixtasObesos} />
                <ReadOnlyField label="Mixtas no obesos" value={selectedHospital?.extension?.anestesiasMixtasNoObesos} />
              </div>
            </div>
          </form>
        </Form>
      </Modal>

      <Modal
        id="modal-hospital-ubicaciones"
        open={mapOpen}
        setOpen={setMapOpen}
        title={
          mapSelectedCodigo
            ? 'Ubicación del hospital'
            : 'Ubicaciones de hospitales'
        }
        size="wide"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMapOpen(false)}>
              Cerrar
            </Button>
          </div>
        }
      >
        {mapLoading ? (
          <div className="flex h-[60vh] w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <HospitalesMap
              hospitales={mapHospitales}
              selectedCodigo={mapSelectedCodigo}
            />
          </Suspense>
        )}
      </Modal>
    </div>
  );
}
