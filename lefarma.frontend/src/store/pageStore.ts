import { create } from 'zustand';

interface PageState {
  title: string;
  subtitle: string;
  setPage: (title: string, subtitle?: string) => void;
  clearPage: () => void;
}

export const usePageStore = create<PageState>((set) => ({
  title: '',
  subtitle: '',
  setPage: (title, subtitle = '') => set({ title, subtitle }),
  clearPage: () => set({ title: '', subtitle: '' }),
}));
