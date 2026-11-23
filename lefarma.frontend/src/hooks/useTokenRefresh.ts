import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { authService } from '@/shared/auth/authService';

export function useTokenRefresh(): void {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const REFRESH_INTERVAL = 50 * 60 * 1000; 

    if (isAuthenticated) {
      intervalRef.current = setInterval(async () => {
        try {
          const refreshToken = authService.getRefreshToken();
          if (!refreshToken) {
            console.warn('No refresh token available');
            return;
          }

          const response = await authService.refreshToken(refreshToken);
          useAuthStore.getState().setToken(response.accessToken);

        } catch (error) {
          console.error('❌ Error refrescando token:', error);
          await useAuthStore.getState().logout();
        }
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated]);
}
