import { API } from './api';
import type {
  HelpArticle,
  CreateHelpArticleRequest,
  UpdateHelpArticleRequest,
} from '@/types/help.types';

const HELP_URL = '/help/articles';

export const helpService = {
  // Get all articles
  getAll: async (): Promise<HelpArticle[]> => {
    const response = await API.get<HelpArticle[]>(HELP_URL);
    return response.data;
  },

  // Get by ID
  getById: async (id: number): Promise<HelpArticle> => {
    const response = await API.get<HelpArticle>(`${HELP_URL}/${id}`);
    return response.data;
  },

  // Get by module
  getByModule: async (modulo: string): Promise<HelpArticle[]> => {
    const response = await API.get<HelpArticle[]>(`${HELP_URL}/by-module/${modulo}`);
    return response.data;
  },

  // Get by type
  getByType: async (tipo: string): Promise<HelpArticle[]> => {
    const response = await API.get<HelpArticle[]>(`${HELP_URL}/by-type/${tipo}`);
    return response.data;
  },

  // Create article
  create: async (article: CreateHelpArticleRequest): Promise<HelpArticle> => {
    const response = await API.post<HelpArticle>(HELP_URL, article);
    return response.data;
  },

  // Update article
  update: async (article: UpdateHelpArticleRequest): Promise<HelpArticle> => {
    const response = await API.put<HelpArticle>(`${HELP_URL}/${article.id}`, article);
    return response.data;
  },

  // Delete article (soft delete)
  delete: async (id: number): Promise<void> => {
    await API.delete(`${HELP_URL}/${id}`);
  },
};

export default helpService;
