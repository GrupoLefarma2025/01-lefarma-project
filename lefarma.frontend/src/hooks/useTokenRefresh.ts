import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';


/**
 * Hook que refresca el token de acceso proactivamente antes de que expire.
 *
 * El access token expira en 60 minutos. Este hook refresca el token
 * cada 50 minutos (10 minutos antes de la expiración) para evitar
 * que el usuario encuentre errores 401.
 *
 * Solo funciona cuando el usuario está autenticado y se limpia
 * automáticamente al hacer logout o desmontar el componente.
 */
export function useTokenRefresh() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Refrescar token cada 50 minutos (300,000 ms)
    // El token expira a los 60 minutos, así que esto da 10 min de margen
    const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutos

    if (isAuthenticated) {
      // Refrescar inmediatamente al montar (opcional, para asegurar token fresco)
      // Y luego cada 50 minutos
      intervalRef.current = setInterval(async () => {
        try {
          const refreshToken = authService.getRefreshToken();
          if (!refreshToken) {
            console.warn('No refresh token available');
            return;
          }

          const response = await authService.refreshToken(refreshToken);
          useAuthStore.getState().setToken(response.accessToken);

          console.log('✅ Token refrescado proactivamente');
        } catch (error) {
          console.error('❌ Error refrescando token:', error);
          // Si falla el refresh, hacer logout
          await useAuthStore.getState().logout();
        }
      }, REFRESH_INTERVAL);
    }

    // Cleanup al desmontar o cuando isAuthenticated cambia
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated]);
}
