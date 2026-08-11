import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type {
  DiaHabilResponse,
  DiaHabilFilters,
  CargaDiasHabilesRequest,
  CargaDiasHabilesResultResponse,
  UsuarioAfectadoResponse,
  SaldoVacacionesResponse,
  SaldoVacacionesRequest,
  SaldoVacacionesCreateRequest,
  SincronizarSaldosRequest,
  SincronizarSaldosResponse,
} from '@/types/vacaciones.types';

const BASE = '/rh/vacaciones';

export const vacacionesApi = {
  getDiasHabiles: (filters: DiaHabilFilters) =>
    API.get<ApiResponse<DiaHabilResponse[]>>(`${BASE}/dias-habiles`, { params: filters }),

  createDiasHabiles: (data: CargaDiasHabilesRequest) =>
    API.post<ApiResponse<CargaDiasHabilesResultResponse>>(`${BASE}/dias-habiles`, data),

  deleteDiaHabil: (id: number) =>
    API.delete<ApiResponse<unknown>>(`${BASE}/dias-habiles/${id}`),

  getUsuariosAfectados: (idDiaHabil: number) =>
    API.get<ApiResponse<UsuarioAfectadoResponse[]>>(`${BASE}/dias-habiles/${idDiaHabil}/usuarios`),

  /* getDiasUsuario: (params: DiaUsuarioRequest) =>
    API.get<ApiResponse<DiaUsuarioResponse[]>>(`${BASE}/dias-usuario`, { params }), */

  getSaldos: (filters: SaldoVacacionesRequest) =>
    API.get<ApiResponse<SaldoVacacionesResponse[]>>(`${BASE}/saldos`, { params: filters }),

  createSaldo: (data: SaldoVacacionesCreateRequest) =>
    API.post<ApiResponse<SaldoVacacionesResponse>>(`${BASE}/saldos`, data),

  syncSaldos: (data: SincronizarSaldosRequest) =>
    API.post<ApiResponse<SincronizarSaldosResponse>>(`${BASE}/saldos/sincronizar`, data),
};

export default vacacionesApi;
