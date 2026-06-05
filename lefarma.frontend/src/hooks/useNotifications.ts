/**
 * Hook personalizado para la conexión SSE de notificaciones
 * Maneja la recepción de notificaciones en tiempo real
 */


import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { navigateTo } from '@/lib/navigation';
import type { SseEvent, UserNotification, NotificationFilter } from '@/types/notification.types';

const SSE_NOTIFICATIONS_URL = (() => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5174/api';
  // Remover barra final si existe para evitar doble slash
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  // Agregar /api si no está presente
  const apiPath = cleanUrl.includes('/api') ? cleanUrl : `${cleanUrl}/api`;
  return `${apiPath}/notifications/stream`;
})();

const MAX_RECONNECT_ATTEMPTS = 10; // Solo contamos errores reales (CLOSED), no reconexiones automaticas
const BASE_RECONNECT_DELAY = 1000; // 1 segundo

interface TicketResponse {
  ticket?: string;
}

async function fetchSseTicket(token: string): Promise<string | null> {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5174/api';
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const response = await fetch(`${cleanUrl}/notifications/ticket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as TicketResponse;
    return data.ticket ?? null;
  } catch {
    return null;
  }
}

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

  const { token, isAuthenticated } = useAuthStore();
  const {
    setConnected,
    addNotification,
    setError,
    clearError,
  } = useNotificationStore();

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const connectRef = useRef<(() => void) | null>(null);

  /**
   * Maneja la apertura exitosa de la conexion SSE.
   * Reinicia el contador de errores porque ya tenemos conexion estable.
   */
  const handleOpen = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setConnected(true);
    setError(undefined);
    onConnectionChange?.(true);
  }, [setConnected, setError, onConnectionChange]);

  /**
   * Maneja errores de la conexion SSE.
   *
   * IMPORTANTE: EventSource.onerror se dispara para TODO tipo de error:
   *  - readyState === CONNECTING (0): el navegador esta reintentando automaticamente.
   *    NO es un error real. Sucede en microcortes de red, WiFi inestable, etc.
   *    NO contamos estos como fallos.
   *  - readyState === CLOSED (2): el servidor cerro la conexion definitivamente.
   *    Esto SI es un error real (401 token expirado, 500 del servidor, etc.)
   *    SOLO estos los contamos para decidir si hacer logout.
   *
   * Antes el contador acumulaba TODOS los errores sin distinguir, causando que
   * cualquier microcorte de red (4 reconexiones del navegador) forzara logout.
   */
  const handleError = useCallback(() => {
    const es = eventSourceRef.current;
    if (!es) return;

    // Solo contar si el servidor CERRÓ la conexion (error real, no reconexion automatica)
    if (es.readyState === EventSource.CLOSED) {
      reconnectAttemptsRef.current++;
    }

    // Solo hacer logout si se acumulan demasiados errores REALES (CLOSED)
    if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
      setConnected(false);
      setError('Tu sesion ha expirado. Por favor, inicia sesion nuevamente.');
      onConnectionChange?.(false);

      if (es.readyState !== EventSource.CLOSED) {
        es.close();
      }

      useAuthStore.getState().logout();

      if (!window.location.pathname.endsWith('/login')) {
        navigateTo('/login');
      }
      return;
    }

    // Si es un error de red/tiempo (CONNECTING), dejar que el navegador reintente
    // EventSource tiene su propio backoff de reconexion (~3s)
    if (es.readyState === EventSource.CONNECTING) {
      setConnected(false);
      onConnectionChange?.(false);
      // No programamos reconexion manual, el navegador lo hace solo
      return;
    }

    // Si llego a CLOSED pero aun no excede el limite, marcar desconectado
    // y programar reconexion manual con backoff exponencial
    setConnected(false);
    setError('Error de conexion. Reintentando...');
    onConnectionChange?.(false);

    const delay = BASE_RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current, 30);

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
        const notification = data.data;
        addNotification(notification);
        onNotification?.(notification);

        // Sonido de notificación (opcional)
        playNotificationSound(notification);
      } else if (data.type === 'heartbeat') {
        // Heartbeat recibido, conexión está viva
      }
    } catch {
      // Ignorar errores de parseo
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AudioContextCtor = window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext;
        const audioContext = new AudioContextCtor();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
      } catch {
        // Silenciar errores de audio
      }
    }
  }, []);

  /**
   * Establece la conexión SSE
   * SIEMPRE lee el token actual del store para evitar usar tokens expirados
   */
  const connect = useCallback(async () => {
    const currentToken = useAuthStore.getState().token;
    const currentAuth = useAuthStore.getState().isAuthenticated;

    if (!currentToken || !currentAuth) {
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const ticket = await fetchSseTicket(currentToken);
      const url = ticket
        ? `${SSE_NOTIFICATIONS_URL}?ticket=${encodeURIComponent(ticket)}`
        : `${SSE_NOTIFICATIONS_URL}?token=${encodeURIComponent(currentToken)}`;

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
        handleMessage('test', event);
      });

    } catch {
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
    };
  }, []);

  // Solicitar permiso para notificaciones del navegador
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(() => {
        // Permiso solicitado
      });
    }
  }, []);

  // Wrapper público para disconnect
  const publicDisconnect = useCallback(() => {
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
export function useNotificationList(): {
  notifications: UserNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | undefined;
  loadNotifications: (userId?: number, filter?: NotificationFilter) => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
} {
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
