import { useCallback, useMemo, useRef, useState } from 'react';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type { EmpleadoJefesConfigResponse } from '@/types/jefesNiveles.types';
import type {
  PagedResult,
  SolicitudPersonalResponse,
  SolicitudPersonalFilterParams,
} from '@/types/solicitudPersonal.types';
import { toApiError } from '@/utils/errors';
import { pasoSeOmitira, responsablesJefePaso } from '@/utils/flujoJefes';
import { toast } from 'sonner';
import type {
  AccionDisponibleResponse,
  FirmarRequest,
  FirmarResponse,
  HistorialWorkflowItemResponse,
  WorkflowFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';

const ESTADOS_TERMINALES = ['cerrada', 'cancelada', 'rechazada'];

interface JefesExcluidosResponse {
  idWorkflow: number;
  idUsuariosJefe: number[];
}

interface FiltroFlujo {
  config: EmpleadoJefesConfigResponse | null;
  excluidos: Set<number>;
}

function isEstadoTerminal(estadoNombre?: string | null): boolean {
  if (!estadoNombre) return false;
  const normalized = estadoNombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return ESTADOS_TERMINALES.some((e) => normalized.includes(e));
}

export interface UseSolicitudesAutorizacionesReturn {
  solicitudesPropias: SolicitudPersonalResponse[];
  solicitudesTodas: SolicitudPersonalResponse[];
  loading: boolean;
  error: string | null;
  fetchAll: (puedeVerTodas: boolean, filters?: SolicitudPersonalFilterParams) => Promise<void>;
  refresh: (puedeVerTodas: boolean, filters?: SolicitudPersonalFilterParams) => Promise<void>;

  selectedId: number | null;
  selectedSolicitud: SolicitudPersonalResponse | null;
  selectSolicitud: (id: number | null, fallback?: SolicitudPersonalResponse | null) => void;

  loadingDetalle: boolean;
  fetchDetalleCompleto: (id: number) => Promise<void>;

  loadingAcciones: boolean;
  fetchAcciones: (id: number) => Promise<void>;
  acciones: AccionDisponibleResponse[];

  loadingHistorial: boolean;
  fetchHistorial: (id: number) => Promise<void>;
  historial: HistorialWorkflowItemResponse[];

  workflowsMap: Map<number, WorkflowFlowResponse>;
  pasosWorkflow: import('@/types/solicitudPersonalWorkflow.types').WorkflowPasoFlowResponse[];
  /** Nombres de los jefes que se esperan en cada paso (para la línea de tiempo). */
  responsablesPorPaso: Map<number, string[]>;
  getEstadoInfo: (
    solicitud:
      | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
      | null
      | undefined
  ) => { nombre: string; color: string };

  firmar: (
    request: FirmarRequest,
    puedeVerTodas: boolean,
    filters?: SolicitudPersonalFilterParams
  ) => Promise<boolean>;
  enviarDirector: (
    request: FirmarRequest,
    pdfBlob: Blob,
    archivoSoporte?: File | null
  ) => Promise<boolean>;
  isSubmittingFirma: boolean;
}

export function useSolicitudesAutorizaciones(): UseSolicitudesAutorizacionesReturn {
  const [solicitudesPropias, setSolicitudesPropias] = useState<SolicitudPersonalResponse[]>([]);
  const [solicitudesTodas, setSolicitudesTodas] = useState<SolicitudPersonalResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudPersonalResponse | null>(
    null
  );

  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [loadingAcciones, setLoadingAcciones] = useState(false);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [acciones, setAcciones] = useState<AccionDisponibleResponse[]>([]);
  const [historial, setHistorial] = useState<HistorialWorkflowItemResponse[]>([]);

  const [workflowsMap, setWorkflowsMap] = useState<Map<number, WorkflowFlowResponse>>(new Map());
  const [workflowsLoaded, setWorkflowsLoaded] = useState(false);
  const [isSubmittingFirma, setIsSubmittingFirma] = useState(false);

  // Configuración de jefes del solicitante y exclusiones del workflow de la
  // solicitud seleccionada: sirven para no pintar en la línea de tiempo los
  // pasos de jefe que el motor omitirá (p. ej. niveles 4-5 sin cuenta).
  const [jefesConfig, setJefesConfig] = useState<EmpleadoJefesConfigResponse | null>(null);
  const [jefesExcluidos, setJefesExcluidos] = useState<Set<number>>(() => new Set());
  const filtroFlujoCache = useRef(new Map<string, FiltroFlujo>());

  const cargarFiltroFlujo = useCallback(async (solicitud: SolicitudPersonalResponse) => {
    if (!solicitud.idWorkflow) {
      setJefesConfig(null);
      setJefesExcluidos(new Set());
      return;
    }

    const idUsuario = solicitud.idUsuarioSolicitante ?? solicitud.idUsuarioCreador;
    const clave = `${solicitud.idWorkflow}:${idUsuario}`;
    const cache = filtroFlujoCache.current.get(clave);
    if (cache) {
      setJefesConfig(cache.config);
      setJefesExcluidos(cache.excluidos);
      return;
    }

    try {
      const [configRes, excluidosRes] = await Promise.all([
        API.get<ApiResponse<EmpleadoJefesConfigResponse>>(
          `/config/empleados/${idUsuario}/jefes-config`
        ),
        API.get<ApiResponse<JefesExcluidosResponse>>(
          `/config/workflows/${solicitud.idWorkflow}/jefes-excluidos`
        ),
      ]);

      const config = configRes.data?.success ? (configRes.data.data ?? null) : null;
      const excluidos = new Set(
        excluidosRes.data?.success ? (excluidosRes.data.data?.idUsuariosJefe ?? []) : []
      );

      filtroFlujoCache.current.set(clave, { config, excluidos });
      setJefesConfig(config);
      setJefesExcluidos(excluidos);
    } catch {
      // Sin datos se muestra el flujo completo (comportamiento anterior).
      setJefesConfig(null);
      setJefesExcluidos(new Set());
    }
  }, []);

  const fetchWorkflowsFlow = useCallback(async () => {
    try {
      const res = await API.get<ApiResponse<WorkflowFlowResponse[]>>('/config/workflows/flow');
      if (res.data?.success && res.data.data) {
        const map = new Map<number, WorkflowFlowResponse>();
        for (const w of res.data.data) {
          map.set(w.idWorkflow, w);
        }
        setWorkflowsMap(map);
      }
    } catch {
      setWorkflowsMap(new Map());
    } finally {
      setWorkflowsLoaded(true);
    }
  }, []);

  const fetchPropias = useCallback(async (filters?: SolicitudPersonalFilterParams) => {
    const res = await API.get<ApiResponse<PagedResult<SolicitudPersonalResponse>>>(
      '/solicitudes-personal',
      { params: { verTodas: false, pageSize: 100, ...filters } }
    );
    if (res.data?.success) {
      setSolicitudesPropias(res.data.data?.items ?? []);
    }
  }, []);

  const fetchTodas = useCallback(async (filters?: SolicitudPersonalFilterParams) => {
    const res = await API.get<ApiResponse<PagedResult<SolicitudPersonalResponse>>>(
      '/solicitudes-personal',
      { params: { verTodas: true, pageSize: 100, ...filters } }
    );
    if (res.data?.success) {
      setSolicitudesTodas(res.data.data?.items ?? []);
    }
  }, []);

  const fetchAll = useCallback(
    async (puedeVerTodas: boolean, filters?: SolicitudPersonalFilterParams) => {
      setLoading(true);
      setError(null);
      try {
        const promises: Promise<void>[] = [fetchPropias(filters)];
        if (puedeVerTodas) {
          promises.push(fetchTodas(filters));
        }
        await Promise.all(promises);
      } catch (err: unknown) {
        const apiErr = toApiError(err);
        setError(apiErr.message ?? 'Error al cargar solicitudes');
        toast.error(apiErr.message ?? 'Error al cargar solicitudes');
      } finally {
        setLoading(false);
      }
    },
    [fetchPropias, fetchTodas]
  );

  const refresh = useCallback(
    async (puedeVerTodas: boolean, filters?: SolicitudPersonalFilterParams) => {
      await fetchAll(puedeVerTodas, filters);
    },
    [fetchAll]
  );

  const fetchDetalleCompleto = useCallback(async (id: number) => {
    setLoadingDetalle(true);
    try {
      const res = await API.get<ApiResponse<SolicitudPersonalResponse>>(
        `/solicitudes-personal/${id}`
      );
      if (res.data?.success && res.data.data) {
        setSelectedSolicitud(res.data.data);
      } else {
        setSelectedSolicitud(null);
        toast.error(res.data.message ?? 'No se pudo cargar el detalle');
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toast.error(apiErr.message ?? 'Error al cargar el detalle');
      setSelectedSolicitud(null);
    } finally {
      setLoadingDetalle(false);
    }
  }, []);

  const fetchAcciones = useCallback(async (id: number) => {
    setLoadingAcciones(true);
    try {
      const res = await API.get<ApiResponse<AccionDisponibleResponse[]>>(
        `/solicitudes-personal/${id}/acciones-disponibles`
      );
      if (res.data?.success) {
        setAcciones(res.data.data || []);
      } else {
        setAcciones([]);
        toast.error(res.data.message ?? 'No se pudieron cargar las acciones');
      }
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      toast.error(apiErr.message ?? 'Error al cargar las acciones disponibles');
      setAcciones([]);
    } finally {
      setLoadingAcciones(false);
    }
  }, []);

  const fetchHistorial = useCallback(
    async (id: number) => {
      setLoadingHistorial(true);
      try {
        const [res] = await Promise.all([
          API.get<ApiResponse<HistorialWorkflowItemResponse[]>>(
            `/solicitudes-personal/${id}/historial`
          ),
          ...(workflowsLoaded ? [] : [fetchWorkflowsFlow()]),
        ]);
        if (res.data?.success) {
          setHistorial(res.data.data || []);
        } else {
          setHistorial([]);
          toast.error(res.data.message ?? 'No se pudo cargar el historial');
        }
      } catch (err: unknown) {
        const apiErr = toApiError(err);
        toast.error(apiErr.message ?? 'Error al cargar el historial');
        setHistorial([]);
      } finally {
        setLoadingHistorial(false);
      }
    },
    [workflowsLoaded, fetchWorkflowsFlow]
  );

  const selectSolicitud = useCallback(
    (id: number | null, fallback?: SolicitudPersonalResponse | null) => {
      setSelectedId(id);
      if (id != null) {
        const fromList =
          fallback ??
          solicitudesPropias.find((s) => s.idSolicitud === id) ??
          solicitudesTodas.find((s) => s.idSolicitud === id) ??
          null;
        setSelectedSolicitud(fromList);
        setAcciones([]);
        setHistorial([]);
        if (fromList) {
          void cargarFiltroFlujo(fromList);
        } else {
          setJefesConfig(null);
          setJefesExcluidos(new Set());
        }
      } else {
        setSelectedSolicitud(null);
        setAcciones([]);
        setHistorial([]);
        setJefesConfig(null);
        setJefesExcluidos(new Set());
      }
    },
    [solicitudesPropias, solicitudesTodas, cargarFiltroFlujo]
  );

  const firmar = useCallback(
    async (
      request: FirmarRequest,
      puedeVerTodas: boolean,
      filters?: SolicitudPersonalFilterParams
    ): Promise<boolean> => {
      if (!selectedSolicitud) return false;
      setIsSubmittingFirma(true);
      try {
        const res = await API.post<ApiResponse<FirmarResponse>>(
          `/solicitudes-personal/${selectedSolicitud.idSolicitud}/firmar`,
          request
        );
        if (res.data?.success) {
          toast.success(res.data.data?.mensaje ?? 'Acción ejecutada correctamente');
          await fetchAcciones(selectedSolicitud.idSolicitud);
          if (selectedId != null) {
            await fetchDetalleCompleto(selectedId);
          }
          return true;
        }
        toast.error(res.data.message ?? 'No fue posible procesar la acción');
        return false;
      } catch (err: unknown) {
        const apiErr = toApiError(err);
        const message = apiErr.errors?.[0]?.description ?? apiErr.message ?? 'Error al firmar';
        toast.error(message);
        return false;
      } finally {
        setIsSubmittingFirma(false);
      }
    },
    [selectedSolicitud, selectedId, fetchAcciones, fetchDetalleCompleto]
  );

  const enviarDirector = useCallback(
    async (
      request: FirmarRequest,
      pdfBlob: Blob,
      archivoSoporte?: File | null
    ): Promise<boolean> => {
      if (!selectedSolicitud) return false;
      setIsSubmittingFirma(true);
      try {
        const formData = new FormData();
        formData.append('IdAccion', String(request.idAccion));
        if (request.comentario) {
          formData.append('Comentario', request.comentario);
        }
        formData.append('ArchivoPdf', pdfBlob, `${selectedSolicitud.folio}.pdf`);
        formData.append('Correo', "");
        formData.append('CorreoCC', "6@grupolefarma.com.mx");
        formData.append('TieneDocumentoSoporte', archivoSoporte ? 'true' : 'false');
        if (archivoSoporte) {
          formData.append('ArchivoSoporte', archivoSoporte, archivoSoporte.name);
        }

        const res = await API.post<ApiResponse<FirmarResponse>>(
          `/solicitudes-personal/${selectedSolicitud.idSolicitud}/enviar-director`,
          formData
        );
        if (res.data?.success) {
          toast.success(res.data.data?.mensaje ?? 'Solicitud enviada al director correctamente');
          await fetchAcciones(selectedSolicitud.idSolicitud);
          if (selectedId != null) {
            await fetchDetalleCompleto(selectedId);
          }
          return true;
        }
        toast.error(res.data.message ?? 'No fue posible enviar la solicitud al director');
        return false;
      } catch (err: unknown) {
        const apiErr = toApiError(err);
        const message =
          apiErr.errors?.[0]?.description ?? apiErr.message ?? 'Error al enviar al director';
        toast.error(message);
        return false;
      } finally {
        setIsSubmittingFirma(false);
      }
    },
    [selectedSolicitud, selectedId, fetchAcciones, fetchDetalleCompleto]
  );

  const getEstadoInfo = useCallback(
    (
      solicitud:
        | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
        | null
        | undefined
    ) => {
      if (!solicitud) return { nombre: 'Sin estado', color: '#94a3b8' };
      return {
        nombre: solicitud.estadoNombre ?? 'Sin estado',
        color: solicitud.estadoColor ?? '#94a3b8',
      };
    },
    []
  );

  const pasosWorkflow = useMemo(() => {
    if (!selectedSolicitud?.idWorkflow) return [];
    const workflow = workflowsMap.get(selectedSolicitud.idWorkflow);
    if (!workflow) return [];
    const pasos = (workflow.pasos || [])
      .filter((p) => p.activo)
      .sort((a, b) => a.orden - b.orden);

    // Oculta los pasos de jefe que el motor omitirá para este solicitante. Se
    // conservan el paso actual y los ya visitados para no perder su historial.
    if (!jefesConfig) return pasos;
    const pasosConEventos = new Set(historial.map((h) => h.idPaso));
    return pasos.filter(
      (paso) =>
        paso.idPaso === selectedSolicitud.idPasoActual ||
        pasosConEventos.has(paso.idPaso) ||
        !pasoSeOmitira(paso, jefesConfig, jefesExcluidos)
    );
  }, [selectedSolicitud, workflowsMap, jefesConfig, jefesExcluidos, historial]);

  // Jefe esperado por paso: se muestra en la línea de tiempo aunque el paso
  // todavía no tenga firma, para que se vea quién debe atenderlo.
  const responsablesPorPaso = useMemo(() => {
    const map = new Map<number, string[]>();
    if (!jefesConfig) return map;
    for (const paso of pasosWorkflow) {
      const nombres = responsablesJefePaso(paso, jefesConfig, jefesExcluidos);
      if (nombres.length > 0) map.set(paso.idPaso, nombres);
    }
    return map;
  }, [pasosWorkflow, jefesConfig, jefesExcluidos]);

  return {
    solicitudesPropias,
    solicitudesTodas,
    loading,
    error,
    fetchAll,
    refresh,
    selectedId,
    selectedSolicitud,
    selectSolicitud,
    loadingDetalle,
    fetchDetalleCompleto,
    loadingAcciones,
    fetchAcciones,
    acciones,
    loadingHistorial,
    fetchHistorial,
    historial,
    workflowsMap,
    pasosWorkflow,
    responsablesPorPaso,
    getEstadoInfo,
    firmar,
    enviarDirector,
    isSubmittingFirma,
  };
}

export { isEstadoTerminal };
