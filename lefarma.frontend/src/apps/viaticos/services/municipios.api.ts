import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type { Municipio } from '../types/municipios.types';

const BASE = '/viaticos';

export const municipiosApi = {
  getMunicipios: (codigoEstado?: number) =>
    API.get<ApiResponse<Municipio[]>>(`${BASE}/municipios`, {
      params: { codigoEstado },
    }),
};
