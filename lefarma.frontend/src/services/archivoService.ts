import { API } from './api';
import type { 
  Archivo, 
  ArchivoListItem, 
  ListarArchivosParams, 
  SubirArchivoParams,
  ReemplazarArchivoParams 
} from '@/types/archivo.types';


const BASE_URL = '/archivos';

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

    const { data } = await API.post<{ success: boolean; message: string; data: Archivo }>(`${BASE_URL}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data.data;
  },

  reemplazar: async (id: number, file: File, params?: ReemplazarArchivoParams): Promise<Archivo> => {
    const formData = new FormData();
    formData.append('file', file);
    if (params?.metadata) {
      formData.append('metadata', JSON.stringify(params.metadata));
    }

    const { data } = await API.post<{ success: boolean; message: string; data: Archivo }>(`${BASE_URL}/${id}/reemplazar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data.data;
  },

  getById: async (id: number): Promise<Archivo> => {
    const { data } = await API.get<{ success: boolean; message: string; data: Archivo }>(`${BASE_URL}/${id}`);
    return data.data;
  },

  getAll: async (params: ListarArchivosParams): Promise<ArchivoListItem[]> => {
    const { data } = await API.get<{ success: boolean; message: string; data: ArchivoListItem[] }>(BASE_URL, { params });
    return data.data;
  },

  getDownloadUrl: (id: number): string => {
    return `/api${BASE_URL}/${id}/download`;
  },

  getPreviewUrl: (id: number): string => {
    return `/api${BASE_URL}/${id}/preview`;
  },

  delete: async (id: number): Promise<void> => {
    await API.delete(`${BASE_URL}/${id}`);
  }
};
