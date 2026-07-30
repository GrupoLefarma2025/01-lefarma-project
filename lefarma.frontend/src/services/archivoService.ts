import { API } from '@/shared/api/apiClient';
import type {
  Archivo,
  ArchivoListItem,
  ListarArchivosParams,
  SubirArchivoParams,
  ReemplazarArchivoParams
} from '@/types/archivo.types';
import type { ApiResponse } from '@/types/api.types';

// Full prefix only for raw URL strings (href/download links); axios calls use relative paths because API.baseURL already includes VITE_API_URL
const BASE_URL = `${import.meta.env.VITE_API_URL || '/api'}/archivos`;

export const archivoService = {
  upload: async (file: File, params: SubirArchivoParams): Promise<Archivo> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entidadTipo', params.entidadTipo);
    formData.append('entidadId', params.entidadId.toString());
    formData.append('carpeta', params.carpeta);
    if (params.metadata) {
      formData.append('metadata', JSON.stringify(params.metadata));
    }

    const { data } = await API.post<ApiResponse<Archivo>>(`/archivos/upload`, formData);
    return data.data;
  },

  reemplazar: async (id: number, file: File, params?: ReemplazarArchivoParams): Promise<Archivo> => {
    const formData = new FormData();
    formData.append('file', file);
    if (params?.metadata) {
      formData.append('metadata', JSON.stringify(params.metadata));
    }

    const { data } = await API.post<ApiResponse<Archivo>>(`/archivos/${id}/reemplazar`, formData);
    return data.data;
  },

  getById: async (id: number): Promise<Archivo> => {
    const { data } = await API.get<ApiResponse<Archivo>>(`/archivos/${id}`);
    return data.data;
  },

  getAll: async (params: ListarArchivosParams): Promise<ArchivoListItem[]> => {
  const { data } = await API.get<ApiResponse<ArchivoListItem[]>>('/archivos', { params });
  return data.data ?? [];
  },

  getDownloadUrl: (id: number): string => {
    return `${BASE_URL}/${id}/download`;
  },

  getPreviewUrl: (id: number): string => {
    return `${BASE_URL}/${id}/preview`;
  },

  delete: async (id: number): Promise<void> => {
    await API.delete<ApiResponse<void>>(`/archivos/${id}`);
  }
};
