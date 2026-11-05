import type { SseEventType, SseConnectionState, SseEvent } from '@/types/sse.types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const SSE_URL = `${API_BASE}/auth/sse`;
const SSE_TICKET_URL = `${API_BASE}/auth/sse-ticket`;

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

/**
 * Pide al backend un ticket de un solo uso. El JWT viaja en el encabezado
 * Authorization (nunca en la URL) y el EventSource solo recibe el ticket.
 */
async function requestSseTicket(token: string): Promise<string> {
  const response = await fetch(SSE_TICKET_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`No se pudo obtener el ticket SSE (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as { ticket?: string };
  if (!payload?.ticket) {
    throw new Error('El servidor no devolvió un ticket SSE.');
  }

  return payload.ticket;
}

class SseService {
  private eventSource: EventSource | null = null;
  private currentToken: string | null = null;
  private pendingToken: string | null = null;
  private connectionGeneration = 0;
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
   *
   * Cada intento pide un ticket nuevo: no se puede reutilizar el de la
   * conexión anterior porque es de un solo uso.
   */
  connect(token: string): void {
    if (!token) {
      return;
    }

    if (this.eventSource && this.currentToken === token) {
      return;
    }

    if (this.pendingToken === token) {
      return;
    }

    this.closeSource();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.currentToken = token;
    this.pendingToken = token;
    const generation = ++this.connectionGeneration;

    void this.openConnection(token, generation);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Invalida cualquier ticket en vuelo para que no abra una conexión
    // después de cerrar sesión.
    this.connectionGeneration++;
    this.pendingToken = null;
    this.closeSource();

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

  private async openConnection(token: string, generation: number): Promise<void> {
    try {
      const ticket = await requestSseTicket(token);

      if (generation !== this.connectionGeneration) {
        return;
      }

      const url = `${SSE_URL}?ticket=${encodeURIComponent(ticket)}`;
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
      if (generation !== this.connectionGeneration) {
        return;
      }

      this.updateState({
        error: error instanceof Error ? error.message : 'SSE ticket request failed',
        isConnected: false,
      });

      // Sin ticket no hay conexión: reintenta con backoff, igual que cuando
      // se cae un EventSource ya abierto.
      this.scheduleReconnect();
    } finally {
      if (generation === this.connectionGeneration && this.pendingToken === token) {
        this.pendingToken = null;
      }
    }
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

    this.closeSource();

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

  private closeSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private updateState(partial: Partial<SseConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...partial };
    this.stateListeners.forEach((listener) => listener(this.connectionState));
  }
}

export const sseService = new SseService();
