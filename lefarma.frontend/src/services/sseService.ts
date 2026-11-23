import type { SseEventType, SseConnectionState, SseEvent } from '@/types/sse.types';

import {
  registrarFalloDeRed,
  registrarFalloHttp,
} from '@/shared/telemetria/capturaErrores';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const SSE_URL = `${API_BASE}/auth/sse`;
const SSE_TICKET_URL = `${API_BASE}/auth/sse-ticket`;

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

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

async function requestSseTicket(token: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(SSE_TICKET_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch (error) {
    registrarFalloDeRed({
      metodo: 'POST',
      url: SSE_TICKET_URL,
      detalle: error instanceof Error ? error.message : undefined,
    });
    throw error;
  }

  if (!response.ok) {
    registrarFalloHttp({
      metodo: 'POST',
      url: SSE_TICKET_URL,
      estado: response.status,
    });
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
    registrarFalloDeRed({
      metodo: 'GET',
      url: SSE_URL,
      detalle: 'el navegador perdió la conexión del stream',
      contexto: JSON.stringify({ intento: this.reconnectAttempts + 1 }),
    });

    this.updateState({
      isConnected: false,
      error: 'Connection lost',
    });

    this.closeSource();

    this.scheduleReconnect();
  }

  private handleMessage(eventType: SseEventType, event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as SseEvent; 
      const callbacks = this.listeners.get(eventType);

      if (callbacks) {
        callbacks.forEach((callback) => callback(data));
      }
    } catch {
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
