import { useCallback, useMemo, useState } from 'react';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type { PagedResult, SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import { toApiError } from '@/utils/errors';
import { toast } from 'sonner';
import type {
  AccionDisponibleResponse,
  FirmarRequest,
  FirmarResponse,
  HistorialWorkflowItemResponse,
  WorkflowFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';

const ESTADOS_TERMINALES = ['cerrada', 'cancelada', 'rechazada'];

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
  fetchAll: (puedeVerTodas: boolean) => Promise<void>;
  refresh: (puedeVerTodas: boolean) => Promise<void>;

  selectedId: number | null;
  selectedSolicitud: SolicitudPersonalResponse | null;
  selectSolicitud: (id: number | null) => void;

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
  getEstadoInfo: (
    solicitud:
      | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
      | null
      | undefined
  ) => { nombre: string; color: string };

  firmar: (request: FirmarRequest, puedeVerTodas: boolean) => Promise<boolean>;
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

  const fetchPropias = useCallback(async () => {
    const res = await API.get<ApiResponse<PagedResult<SolicitudPersonalResponse>>>(
      '/solicitudes-personal',
      { params: { verTodas: false, pageSize: 100 } }
    );
    if (res.data?.success) {
      setSolicitudesPropias(res.data.data?.items ?? []);
    }
  }, []);

  const fetchTodas = useCallback(async () => {
    const res = await API.get<ApiResponse<PagedResult<SolicitudPersonalResponse>>>(
      '/solicitudes-personal',
      { params: { verTodas: true, pageSize: 100 } }
    );
    if (res.data?.success) {
      setSolicitudesTodas(res.data.data?.items ?? []);
    }
  }, []);

  const fetchAll = useCallback(
    async (puedeVerTodas: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const promises: Promise<void>[] = [fetchPropias()];
        if (puedeVerTodas) {
          promises.push(fetchTodas());
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
    async (puedeVerTodas: boolean) => {
      await fetchAll(puedeVerTodas);
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
    (id: number | null) => {
      setSelectedId(id);
      if (id != null) {
        const fromList =
          solicitudesPropias.find((s) => s.idSolicitud === id) ??
          solicitudesTodas.find((s) => s.idSolicitud === id) ??
          null;
        setSelectedSolicitud(fromList);
        setAcciones([]);
        setHistorial([]);
      } else {
        setSelectedSolicitud(null);
        setAcciones([]);
        setHistorial([]);
      }
    },
    [solicitudesPropias, solicitudesTodas]
  );

  const firmar = useCallback(
    async (request: FirmarRequest, puedeVerTodas: boolean): Promise<boolean> => {
      if (!selectedSolicitud) return false;
      setIsSubmittingFirma(true);
      try {
        const res = await API.post<ApiResponse<FirmarResponse>>(
          `/solicitudes-personal/${selectedSolicitud.idSolicitud}/firmar`,
          request
        );
        if (res.data?.success) {
          toast.success(res.data.data?.mensaje ?? 'Acción ejecutada correctamente');
          await fetchAll(puedeVerTodas);
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
    [selectedSolicitud, selectedId, fetchAll, fetchAcciones, fetchDetalleCompleto]
  );

  const getEstadoInfo = useCallback(
    (
      solicitud:
        | Pick<SolicitudPersonalResponse, 'estadoNombre' | 'estadoColor' | 'idEstado'>
        | null
        | undefined
    ) => {
      if (!solicitud) return { nombre: 'Desconocido', color: '#94a3b8' };
      return {
        nombre: solicitud.estadoNombre ?? `Estado ${solicitud.idEstado ?? '?'}`,
        color: solicitud.estadoColor ?? '#94a3b8',
      };
    },
    []
  );

  const pasosWorkflow = useMemo(() => {
    if (!selectedSolicitud?.idWorkflow) return [];
    const workflow = workflowsMap.get(selectedSolicitud.idWorkflow);
    if (!workflow) return [];
    return (workflow.pasos || []).filter((p) => p.activo).sort((a, b) => a.orden - b.orden);
  }, [selectedSolicitud, workflowsMap]);

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
    getEstadoInfo,
    firmar,
    isSubmittingFirma,
  };
}

export { isEstadoTerminal };
