/* eslint-disable react-refresh/only-export-components -- el provider y su hook de estado comparten contexto */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { sseService } from '@/services/sseService';
import type { SseConfiguracionChangedEvent } from '@/types/sse.types';
import { hydrateConfigStore } from './configuracionStore';
import { ensureMissingConfigKeys, syncNow } from './configRuntime';
import { installLefarmaConfigConsole } from './configConsole';

/** Polling de respaldo aunque SSE se vea conectado. */
const POLL_INTERVAL_MS = 10 * 60 * 1000;

/** Backoff de reintentos ante fallos de sync (sin tormenta de peticiones). */
const RETRY_DELAYS_MS = [2000, 5000, 15000, 30000];

/** Ventana de coalescing para ráfagas de eventos SSE. */
const EVENT_COALESCE_MS = 250;

export interface ConfigSyncStatus {
  /** navigator.onLine. */
  online: boolean;
  /** Hay un sync fallando / pendiente de reintento. */
  stale: boolean;
  lastSyncAt: number | null;
  error: string | null;
}

const INITIAL_STATUS: ConfigSyncStatus = {
  online: true,
  stale: false,
  lastSyncAt: null,
  error: null,
};

const ConfigSyncContext = createContext<ConfigSyncStatus>(INITIAL_STATUS);

/** Estado opcional (online/stale) para pantallas que quieran mostrarlo. */
export function useConfigSyncStatus(): ConfigSyncStatus {
  return useContext(ConfigSyncContext);
}

interface ConfigSyncProviderProps {
  children: ReactNode;
}

/**
 * Runtime global de configuración de frontend.
 *
 * Vive por encima de las rutas: mantiene cache, SSE, polling y reintentos
 * mientras haya sesión autenticada. No dibuja overlays ni bloquea la UI.
 */
export function ConfigSyncProvider({ children }: ConfigSyncProviderProps) {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasSession = Boolean(token) && isAuthenticated;

  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [stale, setStale] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Idempotente: el store ya se hidrata al cargar el módulo, pero el provider
  // garantiza la hidratación al iniciar la app.
  useEffect(() => {
    hydrateConfigStore();
    installLefarmaConfigConsole();
  }, []);

  // Conexión SSE: solo con sesión. Al perderla se cierra la conexión para no
  // dejar un EventSource autenticado huérfano.
  useEffect(() => {
    if (!hasSession) {
      sseService.disconnect();
      return;
    }

    const currentToken = useAuthStore.getState().token;
    if (currentToken) {
      sseService.connect(currentToken);
    }
  }, [hasSession]);

  useEffect(() => {
    if (!hasSession) {
      return;
    }

    let disposed = false;
    let retryAttempt = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let coalesceTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRetryTimer = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const clearCoalesceTimer = () => {
      if (coalesceTimer) {
        clearTimeout(coalesceTimer);
        coalesceTimer = null;
      }
    };

    // Si otro consumidor del singleton cerró la conexión, el provider la
    // recupera en los mismos puntos donde ya resincroniza (sin duplicarla:
    // connect es idempotente por token).
    function ensureSseConnected(): void {
      if (sseService.getState().isConnected) {
        return;
      }
      const currentToken = useAuthStore.getState().token;
      if (currentToken) {
        sseService.connect(currentToken);
      }
    }

    const registerSuccess = () => {
      retryAttempt = 0;
      clearRetryTimer();
      setStale(false);
      setError(null);
      setLastSyncAt(Date.now());
      ensureSseConnected();
    };

    async function runSync(): Promise<void> {
      if (disposed) {
        return;
      }

      const result = await syncNow();

      if (disposed) {
        return;
      }

      if (result.ok) {
        registerSuccess();
        return;
      }

      if (result.skipped) {
        return;
      }

      setStale(true);
      setError('No se pudo sincronizar la configuración.');
      scheduleRetry();
    }

    function scheduleRetry(): void {
      if (disposed || retryTimer) {
        return;
      }

      const delay =
        RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
      retryAttempt += 1;

      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (!disposed) {
          void runSync();
        }
      }, delay);
    }

    const requestSync = (immediate: boolean) => {
      if (disposed) {
        return;
      }

      if (immediate) {
        clearCoalesceTimer();
        void runSync();
        return;
      }

      // Ráfaga de eventos SSE => una sola petición.
      if (coalesceTimer) {
        return;
      }

      coalesceTimer = setTimeout(() => {
        coalesceTimer = null;
        if (!disposed) {
          void runSync();
        }
      }, EVENT_COALESCE_MS);
    };

    // Recuperación de red: no esperar al siguiente polling ni al backoff.
    const handleOnline = () => {
      setOnline(true);
      retryAttempt = 0;
      clearRetryTimer();
      ensureSseConnected();
      requestSync(true);
    };

    const handleOffline = () => {
      setOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        retryAttempt = 0;
        clearRetryTimer();
        ensureSseConnected();
        requestSync(true);
      }
    };

    const unsubscribeConfig = sseService.on<SseConfiguracionChangedEvent>(
      'configuracion.changed',
      () => {
        requestSync(false);
      }
    );

    const unsubscribeConnected = sseService.on('connected', () => {
      requestSync(false);
    });

    let wasConnected = sseService.getState().isConnected;

    const unsubscribeState = sseService.onStateChange((state) => {
      if (disposed) {
        return;
      }

      const becameConnected = state.isConnected && !wasConnected;
      wasConnected = state.isConnected;

      if (becameConnected) {
        retryAttempt = 0;
        clearRetryTimer();
        requestSync(true);
      }
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Hooks que montaron antes del login: se recuperan solo sus claves, nunca
    // el catálogo completo.
    void ensureMissingConfigKeys();
    void runSync();

    // Polling SIEMPRE con sesión, aunque SSE se vea conectado.
    pollTimer = setInterval(() => {
      void runSync();
    }, POLL_INTERVAL_MS);

    return () => {
      disposed = true;

      unsubscribeConfig();
      unsubscribeConnected();
      unsubscribeState();

      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }

      clearRetryTimer();
      clearCoalesceTimer();
    };
  }, [hasSession]);

  // Al perder sesión no se borra el cache (son variables globales no
  // sensibles); el estado expuesto se neutraliza sin setState en efectos.
  const value = useMemo<ConfigSyncStatus>(
    () => ({
      online,
      stale: hasSession ? stale : false,
      lastSyncAt,
      error: hasSession ? error : null,
    }),
    [online, hasSession, stale, lastSyncAt, error]
  );

  return <ConfigSyncContext.Provider value={value}>{children}</ConfigSyncContext.Provider>;
}
