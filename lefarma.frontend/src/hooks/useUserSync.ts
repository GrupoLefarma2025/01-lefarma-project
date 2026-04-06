import { useEffect, useRef, useCallback } from 'react';
import { sseService } from '@/services/sseService';
import { useAuthStore } from '@/store/authStore';
import type { SseUserUpdatedEvent, SseConnectionState } from '@/types/sse.types';


export interface UseUserSyncOptions {
  onUserUpdate?: (event: SseUserUpdatedEvent) => void;
  onConnectionChange?: (isConnected: boolean) => void;
  autoConnect?: boolean;
}

export interface UseUserSyncReturn {
  isConnected: boolean;
  reconnectAttempts: number;
  error: string | null;
  disconnect: () => void;
  reconnect: () => void;
}

export function useUserSync(options: UseUserSyncOptions = {}): UseUserSyncReturn {
  const { onUserUpdate, onConnectionChange, autoConnect = true } = options;
  const { token, updateUserFromSse, isAuthenticated } = useAuthStore();
  const stateRef = useRef<SseConnectionState>({
    isConnected: false,
    lastConnected: null,
    reconnectAttempts: 0,
    error: null,
  });

  const handleUserUpdate = useCallback((event: SseUserUpdatedEvent) => {
    if (event.user) {
      updateUserFromSse(event.user);
    }
    onUserUpdate?.(event);
  }, [updateUserFromSse, onUserUpdate]);

  const handleStateChange = useCallback((state: SseConnectionState) => {
    stateRef.current = state;
    onConnectionChange?.(state.isConnected);
  }, [onConnectionChange]);

  useEffect(() => {
    if (!autoConnect || !token || !isAuthenticated) {
      return;
    }

    const unsubscribeUpdate = sseService.on<SseUserUpdatedEvent>('user.updated', handleUserUpdate);
    const unsubscribeState = sseService.onStateChange(handleStateChange);

    sseService.connect(token);

    return () => {
      unsubscribeUpdate();
      unsubscribeState();
      sseService.disconnect();
    };
  }, [token, isAuthenticated, autoConnect, handleUserUpdate, handleStateChange]);

  const disconnect = useCallback(() => {
    sseService.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    if (token) {
      sseService.connect(token);
    }
  }, [token]);

  return {
    isConnected: stateRef.current.isConnected,
    reconnectAttempts: stateRef.current.reconnectAttempts,
    error: stateRef.current.error,
    disconnect,
    reconnect,
  };
}
