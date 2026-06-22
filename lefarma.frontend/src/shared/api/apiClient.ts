import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authService } from '@/shared/auth/authService';
import { useAuthStore } from '@/shared/auth/authStore';
import { ApiError } from '@/types/api.types';
import { navigateTo } from '@/lib/navigation';


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

    // Let axios set Content-Type automatically for FormData (includes boundary)
    // Remove Content-Type for requests without a body (GET, DELETE, HEAD)
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
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

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

    if (error.response?.status === 403) {
      // Permiso denegado - el backend ya responde con el mensaje apropiado
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
};

export default apiClient;
