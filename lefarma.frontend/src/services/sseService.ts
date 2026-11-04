import type { SseEventType, SseConnectionState, SseEvent } from '@/types/sse.types';

const SSE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/auth/sse`
  : 'http://localhost:5174/api/auth/sse';

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

/**
 * Registro centralizado de eventos. Al agregar un tipo nuevo en
 * `SseEventType`, basta con añadirlo aquí para que el listener quede instalado
 * en cada conexión (no se olvida ningún evento).
 */
const SSE_EVENT_TYPES: readonly SseEventType[] = [
  'connected',
  'user.updated',
  'configuracion.changed',
];

const ACCESS_TOKEN_KEY = 'accessToken';
const LEGACY_TOKEN_KEY = 'token';

type EventCallback<T = SseEvent> = (data: T) => void;

function getStoredToken(): string | null {
  try {
    return (
      localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || null
    );
  } catch {
    return null;
  }
}

class SseService {
  private eventSource: EventSource | null = null;
  private currentToken: string | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private listeners: Map<SseEventType, Set<EventCallback>> = new Map();
  private connectionState: SseConnectionState = {
    isConnected: false,
    lastConnected: null,
    reconnectAttempts: 0,
    error: null,
  };
  private stateListeners: Set<(state: SseConnectionState) => void> = new Set();

  /**
   * Idempotente: si ya hay un EventSource abierto/conectando con el mismo token
   * no crea otro. Con un token distinto (relogin) reemplaza la conexión.
   */
  connect(token: string): void {
    if (!token) {
      return;
    }

    if (this.eventSource && this.currentToken === token) {
      return;
    }

    if (this.eventSource) {
      this.disconnect();
    } else if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    const url = `${SSE_URL}?token=${encodeURIComponent(token)}`;

    this.currentToken = token;

    try {
      const eventSource = new EventSource(url);
      this.eventSource = eventSource;

      eventSource.onopen = () => {
        if (this.eventSource !== eventSource) {
          return;
        }
        this.handleOpen();
      };

      eventSource.onerror = () => {
        if (this.eventSource !== eventSource) {
          return;
        }
        this.handleError();
      };

      for (const eventType of SSE_EVENT_TYPES) {
        eventSource.addEventListener(eventType, (event: MessageEvent) => {
          if (this.eventSource !== eventSource) {
            return;
          }
          this.handleMessage(eventType, event);
        });
      }
    } catch (error) {
      this.currentToken = null;
      this.updateState({
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false,
      });
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.currentToken = null;
    this.reconnectAttempts = 0;

    this.updateState({
      isConnected: false,
      reconnectAttempts: 0,
      error: null,
    });
  }

  on<T extends SseEvent>(event: SseEventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      return () => {
        /* no-op */
      };
    }
    callbacks.add(callback as EventCallback);

    return () => {
      callbacks.delete(callback as EventCallback);
    };
  }

  onStateChange(callback: (state: SseConnectionState) => void): () => void {
    this.stateListeners.add(callback);
    callback(this.connectionState);

    return () => {
      this.stateListeners.delete(callback);
    };
  }

  getState(): SseConnectionState {
    return { ...this.connectionState };
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.updateState({
      isConnected: true,
      lastConnected: new Date(),
      reconnectAttempts: 0,
      error: null,
    });
  }

  private handleError(): void {
    this.updateState({
      isConnected: false,
      error: 'Connection lost',
    });

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Reconecta también si la conexión inicial nunca abrió; el callback
    // valida que siga habiendo token.
    this.scheduleReconnect();
  }

  private handleMessage(eventType: SseEventType, event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as SseEvent; // Data del endpoint SSE confiable del backend
      const callbacks = this.listeners.get(eventType);

      if (callbacks) {
        callbacks.forEach((callback) => callback(data));
      }
    } catch {
      // Ignorar errores de parseo
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );

    this.updateState({
      reconnectAttempts: this.reconnectAttempts,
    });

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;

      if (this.eventSource) {
        return;
      }

      // authService guarda el token en `accessToken`; `token` es la clave legacy.
      const token = getStoredToken() ?? this.currentToken;
      if (token) {
        this.connect(token);
      }
    }, delay);
  }

  private updateState(partial: Partial<SseConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...partial };
    this.stateListeners.forEach((listener) => listener(this.connectionState));
  }
}

export const sseService = new SseService();
