import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  CrearSolicitudDesdeEducacionMedicaPayload,
  CalculoViaje,
  CrearSolicitudPayload,
  OpcionCotizacion,
  Solicitud,
  SolicitudDesdeEducacionMedicaResponse,
  SolicitudOrigenEmResumen,
} from '../types/solicitud.types';

const BASE = '/viaticos/solicitudes';

/**
 * Total cotizado = suma de las opciones ELEGIDAS con precio, en una sola
 * moneda. Se persiste en `datos.total` (ADR-00014) para que Educación Médica
 * muestre el costo sin recalcular el motor. Si no hay elegidas con precio o
 * mezclan monedas, se omite y la cotización queda "Sin cotización".
 */
const totalDeOpciones = (opciones: OpcionCotizacion[]): number | undefined => {
  const conPrecio = opciones.filter(
    (opcion): opcion is OpcionCotizacion & { precio: number } =>
      opcion.fue_elegida &&
      typeof opcion.precio === 'number' &&
      Number.isFinite(opcion.precio)
  );
  if (conPrecio.length === 0) return undefined;

  const monedas = new Set(
    conPrecio.map((opcion) => (opcion.moneda ?? 'MXN').trim().toUpperCase())
  );
  if (monedas.size > 1) return undefined;

  const total = conPrecio.reduce((suma, opcion) => suma + opcion.precio, 0);
  return Math.round(total * 100) / 100;
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
  /**
   * GET /viaticos/solicitudes/mis
   * Con `todas` pide las de todos los usuarios (exige `viaticos.ver_todos` en
   * el servidor; sin el permiso responde 403).
   */
  misSolicitudes: (opciones?: { todas?: boolean }) =>
    API.get<ApiResponse<Solicitud[]>>(`${BASE}/mis${opciones?.todas ? '?todas=true' : ''}`),
  /** GET /viaticos/solicitudes/por-autorizar: cola de autorización (solo 'enviada'). */
  porAutorizar: () => API.get<ApiResponse<Solicitud[]>>(`${BASE}/por-autorizar`),
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

    guardarOpciones: (id: number, opciones: OpcionCotizacion[], calculo?: CalculoViaje) => {
    const total = totalDeOpciones(opciones);
    return API.put<ApiResponse<Solicitud>>(`${BASE}/${id}/opciones`, {
      cotizacion: {
        opciones,
        ...(total === undefined ? {} : { total }),
      },
      ...(calculo ? { calculo } : {}),
    });
  },
};