/**
 * Hook personalizado para la conexión SSE de notificaciones
 * Maneja la recepción de notificaciones en tiempo real
 */


import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import type { SseEvent, UserNotification } from '@/types/notification.types';

const SSE_NOTIFICATIONS_URL = (() => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5174/api';
  // Remover barra final si existe para evitar doble slash
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  // Agregar /api si no está presente
  const apiPath = cleanUrl.includes('/api') ? cleanUrl : `${cleanUrl}/api`;
  return `${apiPath}/notifications/stream`;
})();

const MAX_RECONNECT_ATTEMPTS = 3; // Máximo 3 reintentos antes de hacer logout
const BASE_RECONNECT_DELAY = 1000; // 1 segundo

export interface UseNotificationsOptions {
  autoConnect?: boolean;
  onNotification?: (notification: UserNotification) => void;
  onConnectionChange?: (isConnected: boolean) => void;
}

export interface UseNotificationsReturn {
  isConnected: boolean;
  error: string | null;
  disconnect: () => void;
  reconnect: () => void;
}

/**
 * Hook para manejar la conexión SSE de notificaciones
 * Conecta automáticamente cuando el usuario está autenticado
 */
export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    autoConnect = true,
    onNotification,
    onConnectionChange,
  } = options;

  const { token, isAuthenticated, user } = useAuthStore();
  const {
    setConnected,
    addNotification,
    setError,
    clearError,
    refreshUnreadCount,
  } = useNotificationStore();

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const connectRef = useRef<(() => void) | null>(null);

  /**
   * Maneja la apertura de la conexión SSE
   */
  const handleOpen = useCallback(() => {
    // Reiniciar contador de reintentos cuando la conexión es exitosa
    reconnectAttemptsRef.current = 0;
    setConnected(true);
    setError(undefined);
    onConnectionChange?.(true);

    // NO llamar a refreshUnreadCount automáticamente para evitar loops infinitos
    // El conteo se actualizará cuando lleguen notificaciones vía SSE
  }, [setConnected, setError, onConnectionChange]);

  /**
   * Maneja errores de la conexión SSE
   * Detecta 401 (token expirado) y hace logout automático para evitar bucles infinitos
   */
  const handleError = useCallback(() => {
    console.error('[Notifications SSE] Error en la conexión');

    reconnectAttemptsRef.current++;

    // Si hay demasiados reintentos seguidos, el token probablemente expiró
    // Hacer logout automático para limpiar la sesión
    if (reconnectAttemptsRef.current > 3) {
      const error = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
      setConnected(false);
      setError(error);
      onConnectionChange?.(false);
      console.warn('[Notifications SSE] Demasiados reintentos fallidos. Cerrando sesión...');

      // Hacer logout automáticamente
      useAuthStore.getState().logout();

      // Redirigir a login
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }

      return;
    }

    const delay = BASE_RECONNECT_DELAY * reconnectAttemptsRef.current;

    const error = 'Error de conexión. Reintentando...';
    setConnected(false);
    setError(error);
    onConnectionChange?.(false);

    // Programar reconexión SOLO si estamos montados y autenticados
    if (isMountedRef.current && isAuthenticated) {
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connectRef.current?.();
        }
      }, delay);
    }
  }, [setConnected, setError, onConnectionChange, isAuthenticated]);

  /**
   * Maneja mensajes recibidos por SSE
   */
  const handleMessage = useCallback((eventType: string, event: MessageEvent) => {
    try {
      const data: SseEvent = JSON.parse(event.data);

      if (data.type === 'notification') {
        const notification = data.data as UserNotification;
        addNotification(notification);
        onNotification?.(notification);

        // Sonido de notificación (opcional)
        playNotificationSound(notification);
      } else if (data.type === 'heartbeat') {
        // Heartbeat recibido, conexión está viva
        console.debug('[Notifications SSE] Heartbeat recibido');
      }
    } catch (error) {
      console.error('[Notifications SSE] Error parseando mensaje:', error);
    }
  }, [addNotification, onNotification]);

  /**
   * Reproduce un sonido de notificación
   */
  const playNotificationSound = useCallback((notification: UserNotification) => {
    // Solo reproducir para notificaciones importantes
    if (notification.notification?.priority === 'high' ||
        notification.notification?.priority === 'urgent') {
      try {
        // Usar Web Audio API para un beep simple
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
      } catch (error) {
        // Silenciar errores de audio
        console.debug('No se pudo reproducir sonido de notificación');
      }
    }
  }, []);

  /**
   * Establece la conexión SSE
   * SIEMPRE lee el token actual del store para evitar usar tokens expirados
   */
  const connect = useCallback(() => {
    // Leer el token actual del store en cada conexión
    const currentToken = useAuthStore.getState().token;
    const currentAuth = useAuthStore.getState().isAuthenticated;

    if (!currentToken || !currentAuth) {
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const url = `${SSE_NOTIFICATIONS_URL}?token=${encodeURIComponent(currentToken)}`;
      eventSourceRef.current = new EventSource(url);

      eventSourceRef.current.onopen = handleOpen;
      eventSourceRef.current.onerror = handleError;

      // Escuchar evento de notificación
      eventSourceRef.current.addEventListener('notification', (event) => {
        handleMessage('notification', event);
      });

      // Escuchar heartbeat
      eventSourceRef.current.addEventListener('heartbeat', (event) => {
        handleMessage('heartbeat', event);
      });

      // Escuchar eventos de prueba (para debug)
      eventSourceRef.current.addEventListener('test', (event) => {
        console.log('[Notifications SSE] Test event received:', event.data);
        handleMessage('test', event);
      });

    } catch (error) {
      console.error('[Notifications SSE] Error creando EventSource:', error);
      handleError();
    }
  }, [handleOpen, handleError, handleMessage]);

  // Guardar la referencia actual de connect para usarla en handleError
  connectRef.current = connect;

  /**
   * Reconecta manualmente
   */
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Efecto principal: conectar/desconectar según autenticación
  // NO incluimos 'token' en las dependencias para evitar reconexiones infinitas
  // connect() ya lee el token actual del store directamente
  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connectRef.current?.();
    }

    return () => {
      // No actualizar estado en cleanup - solo cerrar conexión
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [autoConnect, isAuthenticated]); // Quitar 'token' para evitar bucle infinito

  // Cleanup al desmontar
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // No actualizar estado en cleanup - solo cerrar conexión
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Solicitar permiso para notificaciones del navegador
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log(`Permiso de notificación: ${permission}`);
      });
    }
  }, []);

  // Wrapper público para disconnect
  const publicDisconnect = useCallback(() => {
    console.log('[Notifications SSE] Desconectando (manual)...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnected(false);
  }, [setConnected]);

  return {
    isConnected: useNotificationStore((state) => state.isConnected),
    error: useNotificationStore((state) => state.error) || null,
    disconnect: publicDisconnect,
    reconnect,
  };
}

/**
 * Hook simplificado que solo retorna las notificaciones sin conectar
 */
export function useNotificationList() {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isLoading = useNotificationStore((state) => state.isLoading);
  const error = useNotificationStore((state) => state.error);

  const loadNotifications = useNotificationStore((state) => state.loadNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  };
}
