import { useAuthStore } from '@/shared/auth/authStore';

export function getUserId(): number | null {
  return useAuthStore.getState().user?.id ?? null;
}
