import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  CrearSolicitudDesdeEducacionMedicaPayload,
  CrearSolicitudPayload,
  OpcionCotizacion,
  Solicitud,
  SolicitudDesdeEducacionMedicaResponse,
  SolicitudOrigenEmResumen,
} from '../types/solicitud.types';

const BASE = '/viaticos/solicitudes';

/**
 * Total cotizado = suma de las opciones elegidas con precio. Se persiste en
 * `datos.total` (ADR-00014) para que Educación Médica muestre el costo sin
 * recalcular el motor. Si todas las opciones son estimadas (precio null), se
 * omite y la cotización queda "Sin cotización".
 */
const totalDeOpciones = (opciones: OpcionCotizacion[]): number | undefined => {
  const precios = opciones
    .map((opcion) => opcion.precio)
    .filter(
      (precio): precio is number =>
        typeof precio === 'number' && Number.isFinite(precio)
    );

  return precios.length > 0 ? precios.reduce((suma, precio) => suma + precio, 0) : undefined;
};

export const solicitudesApi = {
  /** POST /viaticos/solicitudes: crea el borrador de la solicitud. */
  crear: (payload: CrearSolicitudPayload) =>
    API.post<ApiResponse<Solicitud>>(BASE, payload),
  /** POST /viaticos/solicitudes/desde-educacion-medica: crea o reutiliza por ruta. */
  crearDesdeEducacionMedica: (payload: CrearSolicitudDesdeEducacionMedicaPayload) =>
    API.post<ApiResponse<SolicitudDesdeEducacionMedicaResponse>>(
      `${BASE}/desde-educacion-medica`,
      payload
    ),
  /** GET /viaticos/solicitudes/por-ruta/{idRuta}: todas las cotizaciones de la ruta. */
  porRuta: (idRuta: number) =>
    API.get<ApiResponse<SolicitudOrigenEmResumen[]>>(`${BASE}/por-ruta/${idRuta}`),
  /** GET /viaticos/solicitudes/mis */
  misSolicitudes: () => API.get<ApiResponse<Solicitud[]>>(`${BASE}/mis`),
  /** GET /viaticos/solicitudes/{id} */
  detalle: (id: number) => API.get<ApiResponse<Solicitud>>(`${BASE}/${id}`),
  /** PUT /viaticos/solicitudes/{id}: reemplaza el snapshot de un borrador. */
  actualizar: (id: number, payload: CrearSolicitudPayload) =>
    API.put<ApiResponse<Solicitud>>(`${BASE}/${id}`, payload),
  /** DELETE /viaticos/solicitudes/{id}: soft delete de un borrador. */
  eliminar: (id: number) => API.delete<ApiResponse<object>>(`${BASE}/${id}`),
  /** POST /viaticos/solicitudes/{id}/enviar: borrador -> concentrado. */
  enviar: (id: number) => API.post<ApiResponse<Solicitud>>(`${BASE}/${id}/enviar`, {}),
  /** PUT /viaticos/solicitudes/{id}/opciones: persiste la cotización elegida. */
  guardarOpciones: (id: number, opciones: OpcionCotizacion[]) => {
    const total = totalDeOpciones(opciones);
    return API.put<ApiResponse<Solicitud>>(`${BASE}/${id}/opciones`, {
      cotizacion: {
        opciones,
        ...(total === undefined ? {} : { total }),
      },
    });
  },
};