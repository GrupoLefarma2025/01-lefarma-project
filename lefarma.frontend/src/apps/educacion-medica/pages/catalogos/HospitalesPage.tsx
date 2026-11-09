import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Search, Pencil, Loader2, MapPin, Sparkles, RefreshCw, MoreHorizontal } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { ResponsiveFilters } from '@/components/common/ResponsiveFilters';
import { CatalogoToolbar } from '@/apps/educacion-medica/components/CatalogoToolbar';
import { ResumenCompacto } from '@/apps/educacion-medica/components/ResumenCompacto';
import { ViewModeToggle } from '@/components/common/ViewModeToggle';
import { ActionMenuItem } from '@/apps/educacion-medica/components/ActionMenuItem';
import { useQueryState } from '@/apps/educacion-medica/hooks/useQueryState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  esAlmacen: z.boolean().optional(),
  esFarmacia: z.boolean().optional(),
  esSedeTaller: z.boolean().optional(),
  mostrarEducacionMedica: z.boolean().optional(),
  motivoClasificacion: z.string().optional(),
  requiereRevision: z.boolean().optional(),
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

const FILTRO_SEDE_SEDES = 'sedes';
const FILTRO_SEDE_LOGISTICOS = 'logisticos';
const FILTRO_SEDE_SIN_CLASIFICAR = 'sin-clasificar';

const FILTRO_SEDE_OPTIONS = [
  { value: NONE_VALUE, label: 'Todas' },
  { value: FILTRO_SEDE_SEDES, label: 'Solo sedes de taller' },
  { value: FILTRO_SEDE_LOGISTICOS, label: 'Solo logísticos (almacén/farmacia)' },
  { value: FILTRO_SEDE_SIN_CLASIFICAR, label: 'Sin clasificar' },
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
  filtroSede: string;
  mostrarEducacionMedica: string;
  requiereRevision: string;
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
  filtroSede: NONE_VALUE,
  mostrarEducacionMedica: 'true',
  requiereRevision: NONE_VALUE,
};

const PAGE_SIZE = 20;

const FILTER_URL_KEYS: Record<keyof Filters, string> = {
  search: 'q',
  modoInstitucion: 'modo',
  conSia: 'conSia',
  idTipoGerencia: 'gerencia',
  idRegion: 'region',
  numeroQuirofanosMin: 'quirofanos',
  anestesiasTotalesMin: 'anestesias',
  activo: 'activo',
  filtroSede: 'sede',
  mostrarEducacionMedica: 'em',
  requiereRevision: 'rev',
};

function oneOf(value: string | null, allowed: readonly string[], fallback: string): string {
  return value && allowed.includes(value) ? value : fallback;
}

function numericText(value: string | null): string {
  if (!value) return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? value : '';
}

function filtersFromQuery(searchParams: URLSearchParams): Filters {
  const parseId = (value: string | null) =>
    value && Number.isFinite(Number(value)) ? value : NONE_VALUE;

  return {
    search: searchParams.get('q') ?? '',
    modoInstitucion: oneOf(
      searchParams.get('modo'),
      MODO_OPTIONS.map((option) => option.value),
      initialFilters.modoInstitucion
    ),
    conSia: oneOf(searchParams.get('conSia'), ['true', 'false', NONE_VALUE], initialFilters.conSia),
    idTipoGerencia: parseId(searchParams.get('gerencia')),
    idRegion: parseId(searchParams.get('region')),
    numeroQuirofanosMin: numericText(searchParams.get('quirofanos')),
    anestesiasTotalesMin: numericText(searchParams.get('anestesias')),
    activo: oneOf(searchParams.get('activo'), ['true', 'false', NONE_VALUE], initialFilters.activo),
    filtroSede: oneOf(
      searchParams.get('sede'),
      FILTRO_SEDE_OPTIONS.map((option) => option.value),
      initialFilters.filtroSede
    ),
    mostrarEducacionMedica: oneOf(
      searchParams.get('em'),
      ['true', 'false', NONE_VALUE],
      initialFilters.mostrarEducacionMedica
    ),
    requiereRevision: oneOf(
      searchParams.get('rev'),
      ['true', 'false', NONE_VALUE],
      initialFilters.requiereRevision
    ),
  };
}

function ReadOnlyField({ label, value }: { label: string; value: number | null | undefined }) {
  const formatted =
    value === null || value === undefined ? '-' : Number(value).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="h-9 rounded-lg bg-muted/50 px-3 py-2 text-sm">{formatted}</div>
    </div>
  );
}

export default function HospitalesPage() {
  usePageTitle('Hospitales', 'Catálogo de Educación Médica');

  const { searchParams, setParams } = useQueryState();
  const filters = useMemo(() => filtersFromQuery(searchParams), [searchParams]);
  const vista = searchParams.get('vista') === 'mapa' ? 'mapa' : 'tabla';

  const [hospitales, setHospitales] = useState<Hospital[]>([]);
  const [tiposGerencia, setTiposGerencia] = useState<TipoGerencia[]>([]);
  const [loadingTipos, setLoadingTipos] = useState(true);
  const [zonas, setRegiones] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [busquedaServer, setBusquedaServer] = useState(() => filters.search);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [sugerencia, setSugerencia] = useState<SugerenciaRegionResponse | null>(null);
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false);
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
      esAlmacen: false,
      esFarmacia: false,
      esSedeTaller: true,
      mostrarEducacionMedica: true,
      motivoClasificacion: '',
      requiereRevision: false,
    },
  });

  // Las regiones son por gerencia: el select de región del formulario solo
  // muestra las de la gerencia elegida (o todas si aún no se elige).
  const gerenciaFormulario = useWatch({ control: form.control, name: 'idTipoGerencia' });
  const mostrarFormulario = useWatch({
    control: form.control,
    name: 'mostrarEducacionMedica',
  });

  const fetchTiposGerencia = async () => {
    setLoadingTipos(true);
    try {
      const response = await educacionMedicaApi.tipoGerencia.getAll();
      if (response.data.success) {
        setTiposGerencia(response.data.data ?? []);
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al cargar tipos de gerencia');
    } finally {
      setLoadingTipos(false);
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
      if (filters.filtroSede !== NONE_VALUE) params.filtroSede = filters.filtroSede;
      if (filters.mostrarEducacionMedica !== NONE_VALUE) {
        params.mostrarEducacionMedica = filters.mostrarEducacionMedica === 'true';
      }
      if (filters.requiereRevision !== NONE_VALUE) {
        params.requiereRevision = filters.requiereRevision === 'true';
      }
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
    if (filters.filtroSede !== NONE_VALUE) params.filtroSede = filters.filtroSede;
    if (filters.mostrarEducacionMedica !== NONE_VALUE) {
      params.mostrarEducacionMedica = filters.mostrarEducacionMedica === 'true';
    }
    if (filters.requiereRevision !== NONE_VALUE) {
      params.requiereRevision = filters.requiereRevision === 'true';
    }
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; los setState ocurren tras el await
    fetchTiposGerencia();
    fetchRegiones();
  }, []);

  // Sincroniza extensiones: solo crea las faltantes, nunca modifica las existentes.
  const sincronizarExtensiones = async () => {
    const confirmado = window.confirm(
      'Se crearán las extensiones faltantes de los hospitales del catálogo (activos, sin Privado/Distribuidor).\n\nLas extensiones existentes NO se insertan ni actualizan. ¿Continuar?'
    );
    if (!confirmado) return;

    setSincronizando(true);
    try {
      const response = await educacionMedicaApi.hospitales.sincronizar();
      if (response.data.success && response.data.data) {
        const { creadas, yaExistian, ocultasNoHospital, pendientesRevision } = response.data.data;
        toast.success(
          `Sincronización completada: ${creadas} extensión(es) creada(s), ${yaExistian} ya existían, ${ocultasNoHospital} oculta(s) del catálogo y ${pendientesRevision} pendiente(s) de revisión.`
        );
        void buscar(pagination.pageIndex, pagination.pageSize);
      } else {
        toast.error(response.data.message ?? 'No se pudo sincronizar');
      }
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'No se pudo sincronizar');
    } finally {
      setSincronizando(false);
    }
  };

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- los setState ocurren tras el await
    buscar(pagination.pageIndex, pagination.pageSize);
  }, [pagination, buscar]);

  // Cuando cambian los filtros (excepto paginación), regresar a la primera página.
  const filtersKey = useMemo(() => {
    const { search, ...rest } = filters;
    void search;
    return JSON.stringify(rest);
  }, [filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset de página al cambiar filtros
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    );
  }, [filtersKey, busquedaServer]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const updates: Record<string, string | null> = {
      [FILTER_URL_KEYS[key]]: value === initialFilters[key] ? null : value,
    };
    if (key === 'idTipoGerencia') {
      updates[FILTER_URL_KEYS.idRegion] = null;
    }
    setParams(updates);
  };

  const limpiar = () => {
    setParams(
      Object.fromEntries(Object.values(FILTER_URL_KEYS).map((key) => [key, null]))
    );
    setBusquedaServer('');
    setPagination({ pageIndex: 0, pageSize: PAGE_SIZE });
  };

  const quitarFiltro = (id: string) => {
    const defaultByChip: Record<string, string> = {
      search: initialFilters.search,
      modoInstitucion: initialFilters.modoInstitucion,
      conSia: initialFilters.conSia,
      gerencia: initialFilters.idTipoGerencia,
      region: initialFilters.idRegion,
      activo: initialFilters.activo,
      filtroSede: initialFilters.filtroSede,
      mostrar: initialFilters.mostrarEducacionMedica,
      revision: initialFilters.requiereRevision,
      quirofanos: initialFilters.numeroQuirofanosMin,
      anestesias: initialFilters.anestesiasTotalesMin,
    };
    const keyByChip: Record<string, keyof Filters> = {
      search: 'search',
      modoInstitucion: 'modoInstitucion',
      conSia: 'conSia',
      gerencia: 'idTipoGerencia',
      region: 'idRegion',
      activo: 'activo',
      filtroSede: 'filtroSede',
      mostrar: 'mostrarEducacionMedica',
      revision: 'requiereRevision',
      quirofanos: 'numeroQuirofanosMin',
      anestesias: 'anestesiasTotalesMin',
    };
    const key = keyByChip[id];
    if (key) setFilter(key, defaultByChip[id]);
  };

  const extraFilters = useMemo(() => {
    const chips: Array<{ id: string; label: string }> = [];
    if (filters.search.trim()) {
      chips.push({ id: 'search', label: `Buscar: ${filters.search.trim()}` });
    }
    if (filters.modoInstitucion !== MODO_TODAS) {
      chips.push({
        id: 'modoInstitucion',
        label:
          MODO_OPTIONS.find((option) => option.value === filters.modoInstitucion)?.label ??
          filters.modoInstitucion,
      });
    }
    if (filters.conSia !== NONE_VALUE) {
      chips.push({
        id: 'conSia',
        label: filters.conSia === 'true' ? 'Con SIA' : 'Sin SIA',
      });
    }
    if (filters.idTipoGerencia !== NONE_VALUE) {
      chips.push({
        id: 'gerencia',
        label:
          tiposGerencia.find(
            (tipo) => String(tipo.idTipoGerencia) === filters.idTipoGerencia
          )?.descripcion ?? `Gerencia ${filters.idTipoGerencia}`,
      });
    }
    if (filters.idRegion !== NONE_VALUE) {
      chips.push({
        id: 'region',
        label:
          zonas.find((zona) => String(zona.idRegion) === filters.idRegion)?.nombre ??
          `Región ${filters.idRegion}`,
      });
    }
    if (filters.activo !== initialFilters.activo) {
      chips.push({
        id: 'activo',
        label:
          filters.activo === 'false'
            ? 'Solo inactivos'
            : filters.activo === NONE_VALUE
              ? 'Todos los estados'
              : 'Activos',
      });
    }
    if (filters.filtroSede !== NONE_VALUE) {
      chips.push({
        id: 'filtroSede',
        label:
          FILTRO_SEDE_OPTIONS.find((option) => option.value === filters.filtroSede)?.label ??
          filters.filtroSede,
      });
    }
    if (filters.mostrarEducacionMedica !== initialFilters.mostrarEducacionMedica) {
      chips.push({
        id: 'mostrar',
        label:
          filters.mostrarEducacionMedica === 'false'
            ? 'Solo ocultos'
            : filters.mostrarEducacionMedica === NONE_VALUE
              ? 'Ver todos'
              : 'Solo visibles',
      });
    }
    if (filters.requiereRevision !== NONE_VALUE) {
      chips.push({
        id: 'revision',
        label: filters.requiereRevision === 'true' ? 'Pendientes de revisión' : 'Revisados',
      });
    }
    if (filters.numeroQuirofanosMin) {
      chips.push({
        id: 'quirofanos',
        label: `Quirófanos ≥ ${filters.numeroQuirofanosMin}`,
      });
    }
    if (filters.anestesiasTotalesMin) {
      chips.push({
        id: 'anestesias',
        label: `Anestesias ≥ ${filters.anestesiasTotalesMin}`,
      });
    }
    return chips;
  }, [filters, tiposGerencia, zonas]);

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
      esAlmacen: hospital.extension?.esAlmacen ?? false,
      esFarmacia: hospital.extension?.esFarmacia ?? false,
      esSedeTaller: hospital.extension?.esSedeTaller ?? true,
      mostrarEducacionMedica: hospital.extension?.mostrarEducacionMedica ?? true,
      motivoClasificacion: hospital.extension?.motivoClasificacion ?? '',
      requiereRevision: hospital.extension?.requiereRevision ?? false,
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

  useEffect(() => {
    if (vista === 'mapa') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de la vista mapa
      void cargarUbicaciones(mapSelectedCodigo);
    }
  }, [vista, mapSelectedCodigo, cargarUbicaciones]);

  const cambiarVista = (nueva: 'tabla' | 'mapa') => {
    setMapSelectedCodigo(null);
    setParams({ vista: nueva === 'mapa' ? 'mapa' : null });
  };

  const verUbicacion = useCallback(
    (hospital: Hospital) => {
      if (typeof hospital.latitud !== 'number' || typeof hospital.longitud !== 'number') {
        toast.info('El hospital no tiene coordenadas registradas');
        return;
      }
      setMapSelectedCodigo(hospital.codigoContacto);
      setParams({ vista: 'mapa' });
    },
    [setParams]
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

    const mostrarEducacionMedica = values.mostrarEducacionMedica ?? true;
    const esSedeTaller = mostrarEducacionMedica ? (values.esSedeTaller ?? true) : false;

    const payload: UpsertHospitalExtensionRequest = {
      fecha: values.fecha ?? null,
      idTipoGerencia,
      idRegion,
      conSia: values.conSia ?? false,
      numeroQuirofanos,
      // Se preserva la clasificación vigente hasta agregar el control en el formulario
      esZonaMetropolitana: selectedHospital.extension?.esZonaMetropolitana ?? null,
      esAlmacen: values.esAlmacen ?? false,
      esFarmacia: values.esFarmacia ?? false,
      esSedeTaller,
      mostrarEducacionMedica,
      motivoClasificacion: values.motivoClasificacion?.trim() || null,
      requiereRevision: values.requiereRevision ?? false,
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
        id: 'nombreContacto',
        accessorKey: 'nombreContacto',
        header: 'Hospital',
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <p className="text-sm font-semibold leading-snug text-foreground">
              {row.original.nombreContacto}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.institucion ?? 'Sin institución'}
            </p>
            {row.original.clues && (
              <p className="text-[10px] text-muted-foreground/80">CLUES: {row.original.clues}</p>
            )}
          </div>
        ),
      },
      {
        id: 'ubicacion',
        header: 'Ubicación',
        cell: ({ row }) => (
          <div>
            <p className="text-sm text-foreground">
              {row.original.extension?.regionNombre ?? 'Sin región'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.extension?.tipoGerencia ?? 'Sin gerencia'}
            </p>
          </div>
        ),
      },
      {
        id: 'clasificacion',
        header: 'Clasificación',
        cell: ({ row }) => {
          const ext = row.original.extension;
          if (!ext) return '-';
          const etiquetas: string[] = [];
          if (ext.esAlmacen) etiquetas.push('Almacén');
          if (ext.esFarmacia) etiquetas.push('Farmacia');
          if (ext.esSedeTaller === true) etiquetas.push('Sede');
          return (
            <div className="flex flex-wrap items-center gap-1">
              {etiquetas.length === 0 && (
                <span className="text-xs text-muted-foreground">Sin clasificar</span>
              )}
              {etiquetas.map((etiqueta) => (
                <Badge
                  key={etiqueta}
                  variant={etiqueta === 'Sede' ? 'default' : 'outline'}
                  className="text-[10px]"
                >
                  {etiqueta}
                </Badge>
              ))}
              {ext.requiereRevision && (
                <Badge
                  variant="destructive"
                  className="text-[10px]"
                  title={ext.motivoClasificacion ?? 'Pendiente de revisión manual'}
                >
                  Revisión
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'capacidad',
        header: 'Capacidad',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.original.extension?.numeroQuirofanos ?? '-'} quirófanos
            </p>
            <p className="text-[11px] text-muted-foreground">
              SIA: {row.original.extension?.conSia ? 'Sí' : 'No'}
            </p>
          </div>
        ),
      },
      {
        id: 'anestesias',
        header: 'Anestesias',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {row.original.extension?.anestesiasTotales ?? '-'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Gral {row.original.extension?.anestesiasGenerales ?? '-'} · Reg{' '}
              {row.original.extension?.anestesiasRegionales ?? '-'}
            </p>
          </div>
        ),
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  aria-label="Acciones del hospital"
                  title="Acciones"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <ActionMenuItem
                  label="Editar"
                  icon={Pencil}
                  onClick={() => handleEdit(row.original)}
                />
                <ActionMenuItem
                  label="Ver ubicación"
                  icon={MapPin}
                  disabled={
                    typeof row.original.latitud !== 'number' ||
                    typeof row.original.longitud !== 'number'
                  }
                  onClick={() => verUbicacion(row.original)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [handleEdit, verUbicacion]
  );

  const emptyStateHospitales = (
    <EmptyState
      icon={<Search className="h-8 w-8" />}
      title="Sin hospitales"
      description={
        extraFilters.length > 0
          ? 'Ajusta o limpia los filtros para ver más resultados.'
          : 'No hay hospitales que coincidan con la configuración actual.'
      }
      action={
        extraFilters.length > 0 ? (
          <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={limpiar}>
            Limpiar filtros
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg"
            onClick={() => buscar(pagination.pageIndex, pagination.pageSize)}
          >
            Actualizar
          </Button>
        )
      }
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-8">
      <CatalogoToolbar
        left={<ViewModeToggle value={vista} onChange={cambiarVista} />}
        right={
          <>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 rounded-lg border-slate-200 bg-slate-50/60 pl-8 text-xs dark:border-slate-800 dark:bg-slate-900/40"
                placeholder="Buscar nombre, CLUES, nombre corto..."
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
              />
            </div>
            <ResponsiveFilters
              activeCount={extraFilters.length}
              onClear={limpiar}
              title="Filtros de hospitales"
              description="Acota el catálogo por institución, gerencia, región, clasificación y revisión."
              desktopWidthClassName="w-[560px]"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Institución</label>
                  <Select
                    value={filters.modoInstitucion}
                    onValueChange={(v) => setFilter('modoInstitucion', v)}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
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
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
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
                  <label className="text-xs font-medium text-muted-foreground">
                    Tipo de gerencia
                  </label>
                  <Select
                    value={filters.idTipoGerencia}
                    onValueChange={(v) => setFilter('idTipoGerencia', v)}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
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
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Todas</SelectItem>
                      {zonas
                        .filter(
                          (zona) =>
                            filters.idTipoGerencia === NONE_VALUE ||
                            String(zona.idTipoGerencia) === filters.idTipoGerencia
                        )
                        .map((zona) => (
                          <SelectItem key={zona.idRegion} value={String(zona.idRegion)}>
                            {filters.idTipoGerencia === NONE_VALUE && zona.nombreGerencia
                              ? `${zona.nombre} (${zona.nombreGerencia})`
                              : zona.nombre}
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
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                      <SelectValue placeholder="Activo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Todos</SelectItem>
                      <SelectItem value="true">Activo</SelectItem>
                      <SelectItem value="false">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Clasificación
                  </label>
                  <Select
                    value={filters.filtroSede}
                    onValueChange={(v) => setFilter('filtroSede', v)}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTRO_SEDE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Educación Médica
                  </label>
                  <Select
                    value={filters.mostrarEducacionMedica}
                    onValueChange={(v) => setFilter('mostrarEducacionMedica', v)}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                      <SelectValue placeholder="Visibles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Todos</SelectItem>
                      <SelectItem value="true">Solo visibles</SelectItem>
                      <SelectItem value="false">Solo ocultos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Revisión</label>
                  <Select
                    value={filters.requiereRevision}
                    onValueChange={(v) => setFilter('requiereRevision', v)}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Todos</SelectItem>
                      <SelectItem value="true">Pendientes</SelectItem>
                      <SelectItem value="false">Revisados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Quirófanos mín.
                  </label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40"
                    placeholder="0"
                    value={filters.numeroQuirofanosMin}
                    onChange={(e) => setFilter('numeroQuirofanosMin', e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Anest. totales mín.
                  </label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 rounded-lg border-slate-200 bg-slate-50/60 text-xs dark:border-slate-800 dark:bg-slate-900/40"
                    placeholder="0"
                    value={filters.anestesiasTotalesMin}
                    onChange={(e) => setFilter('anestesiasTotalesMin', e.target.value)}
                  />
                </div>
              </div>
            </ResponsiveFilters>

            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg px-3 text-xs"
              onClick={sincronizarExtensiones}
              disabled={loading || sincronizando}
              title="Crea las extensiones faltantes; no modifica las existentes"
            >
              {sincronizando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sincronizar
            </Button>
          </>
        }
        onRefresh={() => buscar(pagination.pageIndex, pagination.pageSize)}
        refreshing={loading}
        refreshLabel="Actualizar hospitales"
      />

      <ResumenCompacto
        loading={loadingTipos}
        items={tiposGerencia
          .filter((tipo) => tipo.totalHospitales > 0)
          .map((tipo, index) => ({
            label: tipo.descripcion,
            value: tipo.totalHospitales.toLocaleString('es-MX'),
            dotClassName: ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'][
              index % 5
            ],
          }))}
      />

      {vista === 'tabla' ? (
        <DataTable
          columns={columns}
          data={hospitales}
          title="Listado de Hospitales"
          subtitle="Hospitales reales con extensión del módulo"
          showRowCount
          pagination
          manualPagination
          totalCount={totalCount}
          paginationState={pagination}
          onPaginationChange={setPagination}
          pageSizeOverride={PAGE_SIZE}
          extraFilters={extraFilters}
          onRemoveExtraFilter={quitarFiltro}
          onClearExtraFilters={limpiar}
          emptyState={emptyStateHospitales}
          showDensityToggle
          showColumnToggle
          loading={loading}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {mapSelectedCodigo
                  ? (mapHospitales.find((h) => h.codigoContacto === mapSelectedCodigo)
                      ?.nombreContacto ?? `Hospital ${mapSelectedCodigo}`)
                  : `${mapHospitales.length} hospitales en el mapa`}
              </span>
            </div>
            {mapSelectedCodigo != null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => setMapSelectedCodigo(null)}
              >
                Quitar selección
              </Button>
            )}
          </div>
          <div className="p-3">
            {mapLoading ? (
              <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando hospitales...
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
          </div>
        </div>
      )}

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
                        {zonas
                          .filter(
                            (zona) =>
                              !gerenciaFormulario ||
                              gerenciaFormulario === TIPO_GERENCIA_NONE ||
                              String(zona.idTipoGerencia) === gerenciaFormulario
                          )
                          .map((zona) => (
                            <SelectItem key={zona.idRegion} value={String(zona.idRegion)}>
                              {gerenciaFormulario === TIPO_GERENCIA_NONE && zona.nombreGerencia
                                ? `${zona.nombre} (${zona.nombreGerencia})`
                                : zona.nombre}
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
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
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

              <FormField
                control={form.control}
                name="esSedeTaller"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? true}
                        disabled={mostrarFormulario === false}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked === true) {
                            form.setValue('mostrarEducacionMedica', true);
                          }
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Es sede de taller (seleccionable en Selección Mensual y ranking)
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mostrarEducacionMedica"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? true}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked !== true) {
                            form.setValue('esSedeTaller', false);
                          }
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Mostrar en Educación Médica (catálogo, mapas y conteos)
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requiereRevision"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Requiere revisión manual</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="motivoClasificacion"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Motivo de clasificación</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Opcional: explica por qué se oculta o clasifica así"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Al guardar se marca la clasificación como manual y se limpia la revisión
                      pendiente, salvo que marques "Requiere revisión manual".
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="esAlmacen"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Es almacén (contacto logístico)</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="esFarmacia"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Es farmacia (contacto logístico)</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
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
    </div>
  );
}
