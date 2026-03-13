import { API } from './api';
import {
  LoginStepOneRequest,
  LoginStepOneResponse,
  LoginStepTwoRequest,
  LoginStepTwoResponse,
  RefreshTokenRequest,
  UserInfo,
  Empresa,
  Sucursal,
} from '@/types/auth.types';
import { ApiResponse } from '@/types/api.types';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';
const EMPRESA_KEY = 'empresa';
const SUCURSAL_KEY = 'sucursal';

export const authService = {
  loginStepOne: async (username: string): Promise<LoginStepOneResponse> => {
    const response = await API.post<ApiResponse<LoginStepOneResponse>>(
      '/auth/login-step-one',
      { username } as LoginStepOneRequest
    );
    return response.data.data;
  },

  loginStepTwo: async (request: LoginStepTwoRequest): Promise<LoginStepTwoResponse> => {
    const response = await API.post<ApiResponse<LoginStepTwoResponse>>(
      '/auth/login-step-two',
      request
    );

    const { accessToken, refreshToken, user } = response.data.data;

    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    return response.data.data;
  },

  refreshToken: async (refreshToken: string): Promise<LoginStepTwoResponse> => {
    const response = await API.post<ApiResponse<LoginStepTwoResponse>>(
      '/auth/refresh',
      { refreshToken } as RefreshTokenRequest
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;

    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

    return response.data.data;
  },

  logout: async (): Promise<void> => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await API.post('/auth/logout', { refreshToken });
      }
    } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(EMPRESA_KEY);
      localStorage.removeItem(SUCURSAL_KEY);
    }
  },

  getAccessToken: (): string | null => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  getCurrentUser: (): UserInfo | null => {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as UserInfo;
    } catch {
      return null;
    }
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  setEmpresa: (empresa: Empresa) => {
    localStorage.setItem(EMPRESA_KEY, JSON.stringify(empresa));
  },

  getEmpresa: (): Empresa | null => {
    const empresaStr = localStorage.getItem(EMPRESA_KEY);
    if (!empresaStr) return null;
    try {
      return JSON.parse(empresaStr) as Empresa;
    } catch {
      return null;
    }
  },

  setSucursal: (sucursal: Sucursal) => {
    localStorage.setItem(SUCURSAL_KEY, JSON.stringify(sucursal));
  },

  getSucursal: (): Sucursal | null => {
    const sucursalStr = localStorage.getItem(SUCURSAL_KEY);
    if (!sucursalStr) return null;
    try {
      return JSON.parse(sucursalStr) as Sucursal;
    } catch {
      return null;
    }
  },

  getEmpresas: async (): Promise<Empresa[]> => {
    const response = await API.get<ApiResponse<Empresa[]>>('/auth/empresas');
    return response.data.data;
  },

  getSucursales: async (empresaId: string): Promise<Sucursal[]> => {
    const response = await API.get<ApiResponse<Sucursal[]>>(
      `/empresas/${empresaId}/sucursales`
    );
    return response.data.data;
  },
};

export default authService;
