import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SseConfiguracionChangedEvent, SseConnectionState } from '@/types/sse.types';

type MockListener = (event: { data: string }) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;

  private listeners = new Map<string, Set<MockListener>>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: MockListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown): void {
    this.listeners.get(type)?.forEach((listener) => {
      listener({ data: JSON.stringify(data) });
    });
  }
}

async function loadSseService() {
  const module = await import('@/services/sseService');
  return module.sseService;
}

beforeEach(() => {
  vi.resetModules();
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sseService', () => {
  it('connect es idempotente con el mismo token (no duplica EventSource)', async () => {
    const service = await loadSseService();

    service.connect('token-a');
    service.connect('token-a');
    service.connect('token-a');

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('token-a');
  });

  it('reemplaza la conexión cuando cambia el token', async () => {
    const service = await loadSseService();

    service.connect('token-a');
    service.connect('token-b');

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(MockEventSource.instances[1].url).toContain('token-b');
  });

  it('entrega configuracion.changed con la revisión', async () => {
    const service = await loadSseService();
    const received: SseConfiguracionChangedEvent[] = [];

    service.on<SseConfiguracionChangedEvent>('configuracion.changed', (event) => {
      received.push(event);
    });

    service.connect('token-a');
    MockEventSource.instances[0].emit('configuracion.changed', { revision: 7 });

    expect(received).toEqual([{ revision: 7 }]);
  });

  it('actualiza el estado de conexión al abrir', async () => {
    const service = await loadSseService();
    const states: SseConnectionState[] = [];

    service.onStateChange((state) => states.push(state));

    service.connect('token-a');
    MockEventSource.instances[0].onopen?.();

    expect(service.getState().isConnected).toBe(true);
    expect(states[states.length - 1].isConnected).toBe(true);
  });
});
