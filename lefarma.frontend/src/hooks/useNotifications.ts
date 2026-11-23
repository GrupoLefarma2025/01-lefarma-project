import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/shared/auth/authStore';
import { useConnectionStore } from '@/shared/connection/connectionStore';
import {
  registrarFalloDeRed,
  registrarFalloHttp,
} from '@/shared/telemetria/capturaErrores';
import { navigateTo } from '@/lib/navigation';
import type { SseEvent, UserNotification, NotificationFilter } from '@/types/notification.types';

const SSE_NOTIFICATIONS_URL = (() => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5174/api';
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const apiPath = cleanUrl.includes('/api') ? cleanUrl : `${cleanUrl}/api`;
  return `${apiPath}/notifications/stream`;
})();

const MAX_RECONNECT_ATTEMPTS = 10; 
const BASE_RECONNECT_DELAY = 1000; 

const SSE_NETWORK_FAILURE_THRESHOLD = 2;
let sseNetworkFailures = 0;

interface TicketResponse {
  ticket?: string;
}

async function fetchSseTicket(token: string): Promise<string | null> {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5174/api';
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const ticketUrl = `${cleanUrl}/notifications/ticket`;

  try {
    const response = await fetch(ticketUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      registrarFalloHttp({
        metodo: 'POST',
        url: ticketUrl,
        estado: response.status,
      });
      sseNetworkFailures = 0;
      return null;
    }

    const data = (await response.json()) as TicketResponse;
    sseNetworkFailures = 0;
    return data.ticket ?? null;
  } catch (error) {
    registrarFalloDeRed({
      metodo: 'POST',
      url: ticketUrl,
      detalle: error instanceof Error ? error.message : undefined,
    });
    sseNetworkFailures++;
    if (sseNetworkFailures >= SSE_NETWORK_FAILURE_THRESHOLD) {
      useConnectionStore.getState().markLost();
    }
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

  const handleOpen = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    sseNetworkFailures = 0;
    useConnectionStore.getState().markConnected();
    setConnected(true);
    setError(undefined);
    onConnectionChange?.(true);
  }, [setConnected, setError, onConnectionChange]);

  const handleError = useCallback(() => {
    const es = eventSourceRef.current;
    if (!es) return;

    registrarFalloDeRed({
      metodo: 'GET',
      url: SSE_NOTIFICATIONS_URL,
      detalle:
        es.readyState === EventSource.CLOSED
          ? 'el servidor cerró el stream'
          : 'el navegador reintenta el stream',
      contexto: JSON.stringify({
        reintentos: reconnectAttemptsRef.current,
        estado: es.readyState,
      }),
    });

    if (es.readyState === EventSource.CLOSED) {
      reconnectAttemptsRef.current++;
    }

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

    if (es.readyState === EventSource.CONNECTING) {
      es.close();
      setConnected(false);
      onConnectionChange?.(false);
    } else {
      setConnected(false);
      setError('Error de conexion. Reintentando...');
      onConnectionChange?.(false);
    }

    const delay = BASE_RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current, 30);

    if (isMountedRef.current && isAuthenticated) {
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connectRef.current?.();
        }
      }, delay);
    }
  }, [setConnected, setError, onConnectionChange, isAuthenticated]);

  const handleMessage = useCallback((eventType: string, event: MessageEvent) => {
    try {
      const data: SseEvent = JSON.parse(event.data);

      if (data.type === 'notification') {
        const notification = data.data;
        addNotification(notification);
        onNotification?.(notification);

        playNotificationSound(notification);
      }
    } catch {
    }
  }, [addNotification, onNotification]);

  const playNotificationSound = useCallback((notification: UserNotification) => {
    if (notification.notification?.priority === 'high' ||
        notification.notification?.priority === 'urgent') {
      try {
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
      }
    }
  }, []);

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

      eventSourceRef.current.addEventListener('notification', (event) => {
        handleMessage('notification', event);
      });

      eventSourceRef.current.addEventListener('heartbeat', (event) => {
        handleMessage('heartbeat', event);
      });

      eventSourceRef.current.addEventListener('test', (event) => {
        handleMessage('test', event);
      });

    } catch {
      handleError();
    }
  }, [handleOpen, handleError, handleMessage]);

  connectRef.current = connect;

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connectRef.current?.();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [autoConnect, isAuthenticated]); 

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(() => {
      });
    }
  }, []);

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
