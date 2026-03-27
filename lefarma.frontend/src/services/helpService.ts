import { API } from './api';
import type {
  HelpArticle,
  HelpModule,
  CreateHelpArticleRequest,
  UpdateHelpArticleRequest,
  CreateHelpModuleRequest,
  UpdateHelpModuleRequest,
  HelpImageUploadResponse,
} from '@/types/help.types';
import type { ApiResponse } from '@/types/api.types';

const HELP_URL = '/help/articles';
const MODULES_URL = '/help/modules';

export const helpService = {
  getAll: async (): Promise<HelpArticle[]> => {
    const response = await API.get<ApiResponse<HelpArticle[]>>(HELP_URL);
    return response.data.data;
  },

  getById: async (id: number): Promise<HelpArticle> => {
    const response = await API.get<ApiResponse<HelpArticle>>(`${HELP_URL}/${id}`);
    return response.data.data;
  },

  getByModule: async (modulo: string): Promise<HelpArticle[]> => {
    const response = await API.get<ApiResponse<HelpArticle[]>>(`${HELP_URL}/by-module/${modulo}`);
    return response.data.data;
  },

  getByType: async (tipo: string): Promise<HelpArticle[]> => {
    const response = await API.get<ApiResponse<HelpArticle[]>>(`${HELP_URL}/by-type/${tipo}`);
    return response.data.data;
  },

  create: async (article: CreateHelpArticleRequest): Promise<HelpArticle> => {
    const response = await API.post<ApiResponse<HelpArticle>>(HELP_URL, article);
    return response.data.data;
  },

  update: async (article: UpdateHelpArticleRequest): Promise<HelpArticle> => {
    const response = await API.put<ApiResponse<HelpArticle>>(`${HELP_URL}/${article.id}`, article);
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await API.delete(`${HELP_URL}/${id}`);
  },

  getForUser: async (modulo?: string): Promise<HelpArticle[]> => {
    const params = modulo ? { modulo } : {};
    const response = await API.get<ApiResponse<HelpArticle[]>>(
      `${HELP_URL}/for-user`,
      { params }
    );
    return response.data.data;
  },

  uploadImage: async (file: File): Promise<HelpImageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post<ApiResponse<HelpImageUploadResponse>>(
      '/help/images',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  },

  getModules: async (): Promise<HelpModule[]> => {
    const response = await API.get<ApiResponse<HelpModule[]>>(MODULES_URL);
    return response.data.data;
  },

  createModule: async (module: CreateHelpModuleRequest): Promise<HelpModule> => {
    const response = await API.post<ApiResponse<HelpModule>>(MODULES_URL, module);
    return response.data.data;
  },

  updateModule: async (module: UpdateHelpModuleRequest): Promise<HelpModule> => {
    const response = await API.put<ApiResponse<HelpModule>>(`${MODULES_URL}/${module.id}`, module);
    return response.data.data;
  },

  deleteModule: async (id: number): Promise<void> => {
    await API.delete(`${MODULES_URL}/${id}`);
  },

  migrateArticles: async (): Promise<{ modulesProcessed: number; articlesCreated: number; details: string[] }> => {
    const response = await API.post<ApiResponse<{ modulesProcessed: number; articlesCreated: number; details: string[] }>>(
      `${MODULES_URL}/migrate-articles`
    );
    return response.data.data;
  },
};

export default helpService;
