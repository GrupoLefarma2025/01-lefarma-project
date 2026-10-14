import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type { CostosRutaRequest, CostosRutaResponse } from '../types/costosRuta.types';

const BASE = '/viaticos/costos-ruta';

export const costosRutaApi = {
  calcular: (payload: CostosRutaRequest) =>
    API.post<ApiResponse<CostosRutaResponse>>(`${BASE}/calcular`, payload),
};
