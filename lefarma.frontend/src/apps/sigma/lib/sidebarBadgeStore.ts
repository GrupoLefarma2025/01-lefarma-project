import { create } from "zustand";

export const SIDEBAR_BADGE_KEYS = {
  bandeja: "documents.bandeja",
} as const;

export type SidebarBadgeKey = (typeof SIDEBAR_BADGE_KEYS)[keyof typeof SIDEBAR_BADGE_KEYS] | string;

type SidebarBadgeState = {
  badges: Record<SidebarBadgeKey, number>;
  setBadgeCount: (key: SidebarBadgeKey, count: number) => void;
  clearBadge: (key: SidebarBadgeKey) => void;
  resetBadges: () => void;
};

export const useSidebarBadgeStore = create<SidebarBadgeState>((set) => ({
  badges: {},
  setBadgeCount: (key, count) =>
    set((state) => {
      const nextBadges = { ...state.badges };
      if (count > 0) {
        nextBadges[key] = count;
      } else {
        delete nextBadges[key];
      }
      return { badges: nextBadges };
    }),
  clearBadge: (key) =>
    set((state) => {
      const nextBadges = { ...state.badges };
      delete nextBadges[key];
      return { badges: nextBadges };
    }),
  resetBadges: () => set({ badges: {} }),
}));
