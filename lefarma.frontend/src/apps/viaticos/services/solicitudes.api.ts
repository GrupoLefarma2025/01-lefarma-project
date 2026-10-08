import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
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
  /** GET /viaticos/solicitudes/{id} */
  detalle: (id: number) => API.get<ApiResponse<Solicitud>>(`${BASE}/${id}`),
  /** PUT /viaticos/solicitudes/{id}/opciones: persiste la cotización elegida. */
  guardarOpciones: (id: number, opciones: OpcionCotizacion[]) =>
    API.put<ApiResponse<Solicitud>>(`${BASE}/${id}/opciones`, {
      cotizacion: { opciones },
    }),
};