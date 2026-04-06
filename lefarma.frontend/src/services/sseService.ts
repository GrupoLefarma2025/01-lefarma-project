import type { SseEventType, SseConnectionState, SseEvent } from '@/types/sse.types';


const SSE_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/auth/sse`
  : 'http://localhost:5174/api/auth/sse';

const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 1000;

type EventCallback<T = SseEvent> = (data: T) => void;

class SseService {
  private eventSource: EventSource | null = null;
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
    if (this.eventSource) {
      this.disconnect();
    }

    const url = `${SSE_URL}?token=${encodeURIComponent(token)}`;
    
    try {
      this.eventSource = new EventSource(url);
      
      this.eventSource.onopen = () => {
        this.handleOpen();
      };

      this.eventSource.onerror = () => {
        this.handleError();
      };

      this.eventSource.addEventListener('connected', (event: MessageEvent) => {
        this.handleMessage('connected', event);
      });

      this.eventSource.addEventListener('user.updated', (event: MessageEvent) => {
        this.handleMessage('user.updated', event);
      });

    } catch (error) {
      this.updateState({ 
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false 
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

    this.updateState({
      isConnected: false,
      error: null,
    });
  }

  on<T extends SseEvent>(event: SseEventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const callbacks = this.listeners.get(event)!;
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
    const wasConnected = this.connectionState.isConnected;
    
    this.updateState({
      isConnected: false,
      error: 'Connection lost',
    });

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (wasConnected) {
      this.scheduleReconnect();
    }
  }

  private handleMessage(eventType: SseEventType, event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as SseEvent;
      const callbacks = this.listeners.get(eventType);
      
      if (callbacks) {
        callbacks.forEach(callback => callback(data));
      }
    } catch {
      // Ignore parse errors
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
      const token = localStorage.getItem('token');
      if (token) {
        this.connect(token);
      }
    }, delay);
  }

  private updateState(partial: Partial<SseConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...partial };
    this.stateListeners.forEach(listener => listener(this.connectionState));
  }
}

export const sseService = new SseService();
