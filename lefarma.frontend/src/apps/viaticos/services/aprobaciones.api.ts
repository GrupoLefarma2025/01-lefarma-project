import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  AjusteSolicitudPayload,
  FiltrosBandeja,
  SolicitudBandeja,
} from '../types/aprobaciones.types';

const BASE = '/viaticos/solicitudes';

/** Serializa los filtros a query string omitiendo los vacios. */
function query(filtros: FiltrosBandeja): string {
  const params = new URLSearchParams();
  if (filtros.periodo) params.set('periodo', filtros.periodo);
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.gerencia) params.set('gerencia', filtros.gerencia);
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

/**
 * Acciones del admin sobre solicitudes de viaticos ya enviadas. El detalle de
 * la solicitud no vive aqui: lo expone `solicitudesApi.detalle`.
 */
export const aprobacionesApi = {
  /**
   * GET /viaticos/solicitudes: bandeja del admin. Sin `viaticos.ver_todos` el
   * backend recorta el resultado a las solicitudes del propio usuario.
   */
  bandeja: (filtros: FiltrosBandeja = {}) =>
    API.get<ApiResponse<SolicitudBandeja[]>>(`${BASE}${query(filtros)}`),
  /** POST /viaticos/solicitudes/{id}/autorizar: 'enviada' -> 'autorizada'. */
  autorizar: (id: number) => API.post<ApiResponse<object>>(`${BASE}/${id}/autorizar`),
  /** POST /viaticos/solicitudes/{id}/rechazar: 'enviada' -> 'rechazada'. */
  rechazar: (id: number, motivo: string) =>
    API.post<ApiResponse<object>>(`${BASE}/${id}/rechazar`, { motivo }),
  /** POST /viaticos/solicitudes/{id}/ajustes: registra el ajuste y su evento. */
  registrarAjuste: (id: number, payload: AjusteSolicitudPayload) =>
    API.post<ApiResponse<object>>(`${BASE}/${id}/ajustes`, payload),
};