import { create } from 'zustand';
import type { HelpArticle } from '@/types/help.types';
import { helpService } from '@/services/helpService';


interface HelpState {
  articles: HelpArticle[];
  selectedArticle: HelpArticle | null;
  selectedModule: string;
  selectedType: string;
  isLoading: boolean;
  error: string | null;

  fetchAllArticles: () => Promise<void>;
  fetchArticlesByModule: (modulo: string, tipo?: string) => Promise<void>;
  fetchArticlesByType: (tipo: string) => Promise<void>;
  fetchForUser: () => Promise<void>;
  fetchArticleById: (id: number) => Promise<void>;
  setSelectedModule: (modulo: string) => void;
  setSelectedType: (tipo: string) => void;
  clearSelectedArticle: () => void;
}

export const useHelpStore = create<HelpState>((set, get) => ({
  articles: [],
  selectedArticle: null,
  selectedModule: '',
  selectedType: 'usuario',
  isLoading: false,
  error: null,

  fetchAllArticles: async () => {
    set({ isLoading: true, error: null, selectedModule: '' });
    try {
      const articles = await helpService.getAll();
      set({ articles, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículos', isLoading: false });
    }
  },

  fetchArticlesByModule: async (modulo: string, tipo?: string) => {
    set({ isLoading: true, error: null, selectedModule: modulo });
    if (tipo) {
      set({ selectedType: tipo });
    }
    try {
      const articles = await helpService.getByModule(modulo);
      // Filtrar por tipo si se especifica
      const filtered = tipo 
        ? articles.filter(a => a.tipo === tipo || a.tipo === 'ambos')
        : articles;
      set({ articles: filtered, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículos', isLoading: false });
    }
  },

  fetchArticlesByType: async (tipo: string) => {
    set({ isLoading: true, error: null, selectedType: tipo });
    try {
      const articles = await helpService.getByType(tipo);
      set({ articles, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículos', isLoading: false });
    }
  },

  fetchForUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const articles = await helpService.getForUser();
      set({ articles, selectedType: 'usuario', isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículos', isLoading: false });
    }
  },

  fetchArticleById: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const article = await helpService.getById(id);
      set({ selectedArticle: article, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar artículo', isLoading: false });
    }
  },

  setSelectedModule: (modulo: string) => set({ selectedModule: modulo }),
  setSelectedType: (tipo: string) => set({ selectedType: tipo }),
  clearSelectedArticle: () => set({ selectedArticle: null }),
}));
