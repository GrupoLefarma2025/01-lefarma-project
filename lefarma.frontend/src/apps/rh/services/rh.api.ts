import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  CalendarioGlobalEvento,
  CalendarioGlobalRequest,
  CalendarioLaboralRequest,
  CalendarioLaboralResponse,
  CreateTipoSolicitudRequest,
  DiasJornadaRequest,
  DiasJornadaResponse,
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
import type { DiaNoHabilFilters, DiaNoHabilResponse } from '@/types/vacaciones.types';
import type {
  EmpleadoJefesConfigListItem,
  EmpleadoJefesConfigResponse,
  EmpleadoJefesCadenaResponse,
  UpdateEmpleadoJefesConfigRequest,
} from '@/types/jefesNiveles.types';

export interface UsuarioCatalogo {
  idUsuario: number;
  samAccountName?: string | null;
  nombreCompleto?: string | null;
  correo?: string | null;
  esActivo: boolean;
}

export interface EmpleadoChecadoResponse {
  checa: boolean;
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

export const misDiasJornadaApi = {
  get: (request: DiasJornadaRequest) =>
    API.get<ApiResponse<DiasJornadaResponse>>('/calendario/mis-dias-jornada', {
      params: request,
    }),
};

export const diasNoHabilesApi = {
  get: (request: DiaNoHabilFilters) =>
    API.get<ApiResponse<DiaNoHabilResponse[]>>('/rh/vacaciones/dias-no-habiles', {
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
    API.get<ApiResponse<IncidenciaChecadoResponse[]>>(
      `/rh/incidencias-checado/empleado/${nomina}`,
      {
        params: { fechaInicio, fechaFin, limite: 1000 },
        signal,
      }
    ),
  getResumen: (request: IncidenciasChecadoResumenEmpleadoRequest, signal?: AbortSignal) =>
    API.get<ApiResponse<PagedResult<IncidenciasChecadoResumenEmpleadoResponse>>>(
      '/rh/incidencias-checado/resumen-empleados',
      {
        params: request,
        signal,
      }
    ),
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
  getDestinatariosDefault: () =>
    API.get<ApiResponse<number[]>>('/auth/usuarios/destinatarios-default').then((res) =>
      res.data.success ? (res.data.data ?? []) : []
    ),
};

export const notificarIncidenciaChecadoApi = {
  getPlantillas: () =>
    API.get<ApiResponse<PlantillaIncidenciaChecado[]>>('/rh/incidencias-checado/plantillas'),
  sendResumen: (payload: NotificarIncidenciasResumenRequest) =>
    API.post<ApiResponse<NotificarIncidenciasResumenResponse>>(
      '/rh/incidencias-checado/notificar-resumen',
      payload
    ),
};

export const empleadoApi = {
  getMiChequeo: () => API.get<ApiResponse<EmpleadoChecadoResponse>>('/rh/empleados/mi-chequeo'),
};

const JEFES_NIVELES_ENDPOINT = '/config/empleados/jefes-config';

export const empleadoJefesConfigApi = {
  getList: () =>
    API.get<ApiResponse<EmpleadoJefesConfigListItem[]>>(`${JEFES_NIVELES_ENDPOINT}/list`),
  getByUsuario: (idUsuario: number) =>
    API.get<ApiResponse<EmpleadoJefesConfigResponse>>(
      `/config/empleados/${idUsuario}/jefes-config`
    ),
  getCadena: (idUsuario: number) =>
    API.get<ApiResponse<EmpleadoJefesCadenaResponse>>(
      `/config/empleados/${idUsuario}/jefes-cadena`
    ),
  update: (idUsuario: number, payload: UpdateEmpleadoJefesConfigRequest) =>
    API.put<ApiResponse<EmpleadoJefesConfigResponse>>(
      `/config/empleados/${idUsuario}/jefes-config`,
      payload
    ),
};

export default {
  misLimitesApi,
  calendarioApi,
  calendarioLaboralApi,
  misDiasJornadaApi,
  diasNoHabilesApi,
  misIncidenciasChecadoApi,
  incidenciasChecadoApi,
  notificarIncidenciaChecadoApi,
  empleadoApi,
  solicitudesPersonalApi,
  tipoSolicitudApi,
  usuariosCatalogoApi,
  empleadoJefesConfigApi,
};
