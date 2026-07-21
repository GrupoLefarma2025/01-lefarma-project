import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  DiaNoHabilResponse,
  DiaNoHabilFilters,
  CargaDiasNoHabilesRequest,
  CargaDiasNoHabilesResultResponse,
  DiaUsuarioResponse,
  DiaUsuarioRequest,
  SaldoVacacionesResponse,
  SaldoVacacionesRequest,
  SaldoVacacionesCreateRequest,
  SincronizarSaldosRequest,
  SincronizarSaldosResponse,
} from '@/types/vacaciones.types';

const BASE = '/rh/vacaciones';

export const vacacionesApi = {
  getDiasNoHabiles: (filters: DiaNoHabilFilters) =>
    API.get<ApiResponse<DiaNoHabilResponse[]>>(`${BASE}/dias-no-habiles`, { params: filters }),

  createDiasNoHabiles: (data: CargaDiasNoHabilesRequest) =>
    API.post<ApiResponse<CargaDiasNoHabilesResultResponse>>(`${BASE}/dias-no-habiles`, data),

  deleteDiaNoHabil: (id: number) =>
    API.delete<ApiResponse<unknown>>(`${BASE}/dias-no-habiles/${id}`),

  getUsuariosAfectados: (idDiaNoHabil: number) =>
    API.get<ApiResponse<DiaUsuarioResponse[]>>(`${BASE}/dias-no-habiles/${idDiaNoHabil}/usuarios`),

  getDiasUsuario: (params: DiaUsuarioRequest) =>
    API.get<ApiResponse<DiaUsuarioResponse[]>>(`${BASE}/dias-usuario`, { params }),

  getSaldos: (filters: SaldoVacacionesRequest) =>
    API.get<ApiResponse<SaldoVacacionesResponse[]>>(`${BASE}/saldos`, { params: filters }),

  createSaldo: (data: SaldoVacacionesCreateRequest) =>
    API.post<ApiResponse<SaldoVacacionesResponse>>(`${BASE}/saldos`, data),

  syncSaldos: (data: SincronizarSaldosRequest) =>
    API.post<ApiResponse<SincronizarSaldosResponse>>(`${BASE}/saldos/sincronizar`, data),
};

export default vacacionesApi;
