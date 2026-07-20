import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  CalendarioGlobalEvento,
  CalendarioGlobalRequest,
  CalendarioLaboralRequest,
  CalendarioLaboralResponse,
  CreateTipoSolicitudRequest,
  IncidenciaChecadoResponse,
  IncidenciasChecadoConsultaRequest,
  IncidenciasChecadoResumenEmpleadoRequest,
  IncidenciasChecadoResumenEmpleadoResponse,
  MisLimitesResponse,
  NotificarIncidenciasResumenRequest,
  NotificarIncidenciasResumenResponse,
  PagedResult,
  PlantillaIncidenciaChecado,
  SolicitudPersonalFilterParams,
  SolicitudPersonalResponse,
  TipoSolicitudRequest,
  TipoSolicitudResponse,
  UpdateTipoSolicitudRequest,
} from '@/types/solicitudPersonal.types';

export interface UsuarioCatalogo {
  idUsuario: number;
  samAccountName?: string | null;
  nombreCompleto?: string | null;
  correo?: string | null;
  esActivo: boolean;
}

const LIMITES_ENDPOINT = '/solicitudes-personal/limites-solicitudes';
const TIPOS_SOLICITUD_ENDPOINT = '/rh/TiposSolicitud';

export const misLimitesApi = {
  get: (idUsuario?: number) =>
    API.get<ApiResponse<MisLimitesResponse>>(LIMITES_ENDPOINT, {
      params: idUsuario ? { idUsuario } : undefined,
    }),
};

export const calendarioApi = {
  get: (request: CalendarioGlobalRequest) =>
    API.get<ApiResponse<CalendarioGlobalEvento[]>>('/solicitudes-personal/calendario', {
      params: request,
    }),
};

export const calendarioLaboralApi = {
  get: (request: CalendarioLaboralRequest) =>
    API.get<ApiResponse<CalendarioLaboralResponse[]>>('/calendario/laboral', {
      params: request,
    }),
};

export const misIncidenciasChecadoApi = {
  get: (request: { anio: number; mes: number }) =>
    API.get<ApiResponse<IncidenciaChecadoResponse[]>>('/rh/mis-incidencias-checado', {
      params: request,
    }),
};

export const incidenciasChecadoApi = {
  get: (request: IncidenciasChecadoConsultaRequest, signal?: AbortSignal) =>
    API.get<ApiResponse<PagedResult<IncidenciaChecadoResponse>>>('/rh/incidencias-checado', {
      params: request,
      signal,
    }),
  getByEmpleado: (nomina: number, fechaInicio: string, fechaFin: string, signal?: AbortSignal) =>
    API.get<ApiResponse<IncidenciaChecadoResponse[]>>(`/rh/incidencias-checado/empleado/${nomina}`, {
      params: { fechaInicio, fechaFin, limite: 1000 },
      signal,
    }),
  getResumen: (request: IncidenciasChecadoResumenEmpleadoRequest, signal?: AbortSignal) =>
    API.get<ApiResponse<PagedResult<IncidenciasChecadoResumenEmpleadoResponse>>>('/rh/incidencias-checado/resumen-empleados', {
      params: request,
      signal,
    }),
};

export const solicitudesPersonalApi = {
  getAll: (params: SolicitudPersonalFilterParams = { verTodas: true }) =>
    API.get<ApiResponse<PagedResult<SolicitudPersonalResponse>>>('/solicitudes-personal', {
      params,
    }),
  getById: (id: number) =>
    API.get<ApiResponse<SolicitudPersonalResponse>>(`/solicitudes-personal/${id}`),
};

export const tipoSolicitudApi = {
  getAll: (query: TipoSolicitudRequest) =>
    API.get<ApiResponse<TipoSolicitudResponse[]>>(TIPOS_SOLICITUD_ENDPOINT, { params: query }),
  getActivos: () =>
    API.get<ApiResponse<TipoSolicitudResponse[]>>(`${TIPOS_SOLICITUD_ENDPOINT}/activos`),
  getById: (id: number) =>
    API.get<ApiResponse<TipoSolicitudResponse>>(`${TIPOS_SOLICITUD_ENDPOINT}/${id}`),
  create: (payload: CreateTipoSolicitudRequest) =>
    API.post<ApiResponse<TipoSolicitudResponse>>(TIPOS_SOLICITUD_ENDPOINT, payload),
  update: (id: number, payload: UpdateTipoSolicitudRequest) =>
    API.put<ApiResponse<TipoSolicitudResponse>>(`${TIPOS_SOLICITUD_ENDPOINT}/${id}`, payload),
  remove: (id: number) => API.delete<ApiResponse<void>>(`${TIPOS_SOLICITUD_ENDPOINT}/${id}`),
};

export const usuariosCatalogoApi = {
  getAll: () =>
    API.get<ApiResponse<UsuarioCatalogo[]>>('/admin/usuarios').then((res) =>
      res.data.success ? (res.data.data ?? []) : []
    ),
};

export const notificarIncidenciaChecadoApi = {
  getPlantillas: () =>
    API.get<ApiResponse<PlantillaIncidenciaChecado[]>>(
      '/rh/incidencias-checado/plantillas'
    ),
  sendResumen: (payload: NotificarIncidenciasResumenRequest) =>
    API.post<ApiResponse<NotificarIncidenciasResumenResponse>>(
      '/rh/incidencias-checado/notificar-resumen',
      payload
    ),
};

export default {
  misLimitesApi,
  calendarioApi,
  calendarioLaboralApi,
  misIncidenciasChecadoApi,
  incidenciasChecadoApi,
  notificarIncidenciaChecadoApi,
  solicitudesPersonalApi,
  tipoSolicitudApi,
  usuariosCatalogoApi,
};
