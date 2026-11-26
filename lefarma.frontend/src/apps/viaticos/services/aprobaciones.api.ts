import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  AjusteSolicitudPayload,
  FiltrosBandeja,
  SolicitudBandeja,
} from '../types/aprobaciones.types';
import type {
  CalculoViaje,
  OpcionCotizacion,
  OrigenPropuesta,
  ResumenCostosRuta,
} from '../types/solicitud.types';

const BASE = '/viaticos/solicitudes';

export interface AutorizarSolicitudPayload {
  calculo?: CalculoViaje;
  opciones?: OpcionCotizacion[];
}

export interface GuardarPropuestaPayload {
  origen: Exclude<OrigenPropuesta, 'calculo'>;
  calculo: CalculoViaje;
  opciones: OpcionCotizacion[];
  resumen: ResumenCostosRuta;
}

function query(filtros: FiltrosBandeja): string {
  const params = new URLSearchParams();
  if (filtros.periodo) params.set('periodo', filtros.periodo);
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.gerencia) params.set('gerencia', filtros.gerencia);
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

export const aprobacionesApi = {
  bandeja: (filtros: FiltrosBandeja = {}) =>
    API.get<ApiResponse<SolicitudBandeja[]>>(`${BASE}${query(filtros)}`),
  autorizar: (id: number, payload?: AutorizarSolicitudPayload) =>
    payload
      ? API.post<ApiResponse<object>>(`${BASE}/${id}/autorizar`, payload)
      : API.post<ApiResponse<object>>(`${BASE}/${id}/autorizar`),
  rechazar: (id: number, motivo: string) =>
    API.post<ApiResponse<object>>(`${BASE}/${id}/rechazar`, { motivo }),
  devolver: (id: number, motivo: string) =>
    API.post<ApiResponse<object>>(`${BASE}/${id}/devolver`, { motivo }),
  registrarAjuste: (id: number, payload: AjusteSolicitudPayload) =>
    API.post<ApiResponse<object>>(`${BASE}/${id}/ajustes`, payload),
  guardarPropuesta: (id: number, payload: GuardarPropuestaPayload) =>
    API.post<ApiResponse<{ numero: number; creado_en: string }>>(
      `${BASE}/${id}/propuestas`,
      payload,
    ),
};