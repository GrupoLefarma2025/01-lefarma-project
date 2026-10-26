import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  CalculoViaje,
  CrearSolicitudPayload,
  OpcionCotizacion,
  Solicitud,
} from '../types/solicitud.types';

const BASE = '/viaticos/solicitudes';

export const solicitudesApi = {
  /** POST /viaticos/solicitudes: crea el borrador de la solicitud. */
  crear: (payload: CrearSolicitudPayload) =>
    API.post<ApiResponse<Solicitud>>(BASE, payload),
  /** GET /viaticos/solicitudes/mis */
  misSolicitudes: () => API.get<ApiResponse<Solicitud[]>>(`${BASE}/mis`),
  /** GET /viaticos/solicitudes/gerencia-sugerida: última gerencia del usuario. */
  gerenciaSugerida: () =>
    API.get<ApiResponse<{ gerencia: string | null }>>(`${BASE}/gerencia-sugerida`),
  /** GET /viaticos/solicitudes/{id} */
  detalle: (id: number) => API.get<ApiResponse<Solicitud>>(`${BASE}/${id}`),
  /** PUT /viaticos/solicitudes/{id}: reemplaza el snapshot de un borrador. */
  actualizar: (id: number, payload: CrearSolicitudPayload) =>
    API.put<ApiResponse<Solicitud>>(`${BASE}/${id}`, payload),
  /** DELETE /viaticos/solicitudes/{id}: soft delete de un borrador. */
  eliminar: (id: number) => API.delete<ApiResponse<object>>(`${BASE}/${id}`),
  /** POST /viaticos/solicitudes/{id}/enviar: borrador -> concentrado. */
  enviar: (id: number, calculo?: CalculoViaje) =>
    API.post<ApiResponse<Solicitud>>(`${BASE}/${id}/enviar`, calculo ? { calculo } : {}),
  /** PUT /viaticos/solicitudes/{id}/opciones: persiste la cotización elegida. */
  guardarOpciones: (id: number, opciones: OpcionCotizacion[], calculo?: CalculoViaje) =>
    API.put<ApiResponse<Solicitud>>(`${BASE}/${id}/opciones`, {
      cotizacion: { opciones },
      ...(calculo ? { calculo } : {}),
    }),
};