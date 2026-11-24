import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authService } from '@/shared/auth/authService';
import { useAuthStore } from '@/shared/auth/authStore';
import { ApiError } from '@/types/api.types';
import { navigateTo } from '@/lib/navigation';
import { useConnectionStore } from '@/shared/connection/connectionStore';
import {
  registrarFalloDeRed,
  registrarFalloHttp,
} from '@/shared/telemetria/capturaErrores';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let consecutiveConnectionFailures = 0;
const CONNECTION_FAILURE_THRESHOLD = 2;

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = authService.getAccessToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.data && ['get', 'delete', 'head'].includes((config.method ?? '').toLowerCase())) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    consecutiveConnectionFailures = 0;
    useConnectionStore.getState().markConnected();
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    if (axios.isCancel(error)) {
      return Promise.reject({ message: 'REQUEST_CANCELED', statusCode: 0 } as ApiError);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const isConnectionFailure =
      !error.response || [502, 503, 504].includes(error.response.status);
    if (isConnectionFailure) {
      consecutiveConnectionFailures++;
      if (consecutiveConnectionFailures === CONNECTION_FAILURE_THRESHOLD) {
        useConnectionStore.getState().markLost();
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = authService.getRefreshToken();

        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await authService.refreshToken(refreshToken);
        const newToken = response.accessToken;

        onTokenRefreshed(newToken);
        useAuthStore.getState().setToken(newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        if (authService.getRefreshToken()) {
          registrarFalloHttp({
            metodo: originalRequest?.method ?? 'get',
            url: `${originalRequest?.baseURL ?? ''}${originalRequest?.url ?? ''}`,
            estado: 401,
          });
        }

        useAuthStore.getState().logout();
        refreshSubscribers = [];

        if (!window.location.pathname.endsWith('/login')) {
          navigateTo('/login');
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const estado = error.response?.status;
    const urlPeticion = originalRequest?.url ?? '';
    const esTelemetria = urlPeticion.includes('/telemetria/');
    if (!estado && !esTelemetria) {
      registrarFalloDeRed({
        metodo: originalRequest?.method ?? 'get',
        url: `${originalRequest?.baseURL ?? ''}${urlPeticion}`,
        detalle: error.code || error.message,
      });
    }
    if (estado && estado >= 400 && !urlPeticion.includes('/telemetria/')) {
      registrarFalloHttp({
        metodo: originalRequest?.method ?? 'get',
        url: `${originalRequest?.baseURL ?? ''}${urlPeticion}`,
        estado,
        requestId: error.response?.headers?.['x-request-id'] as
          | string
          | undefined,
      });
    }

    const apiError: ApiError = {
      message:
        error.response?.data?.message || 'Error al comunicarse con el servidor',
      errors: error.response?.data?.errors,
      statusCode: error.response?.status || 500,
    };

    return Promise.reject(apiError);
  }
);

export const API = {
  get: apiClient.get,
  post: apiClient.post,
  put: apiClient.put,
  patch: apiClient.patch,
  delete: apiClient.delete,
};

export const proveedorApi = {
  autorizar: (id: number) => apiClient.post(`/catalogos/Proveedores/${id}/autorizar`),
  rechazar: (id: number, motivo: string) =>
    apiClient.post(`/catalogos/Proveedores/${id}/rechazar`, { motivo }),
  bulkUpload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/catalogos/Proveedores/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadCuentaCaratula: (id: number, idCuenta: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(
      `/catalogos/Proveedores/${id}/cuentas/${idCuenta}/caratula`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
  getCaratulas: (id: number) =>
    apiClient.get(`/catalogos/Proveedores/${id}/caratulas`),
  uploadConstanciaFiscal: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(
      `/catalogos/Proveedores/${id}/constancia-fiscal`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
};

export default apiClient;
