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

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

let ticketCounter = 0;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  MockEventSource.instances = [];
  ticketCounter = 0;

  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ticket: `ticket-${++ticketCounter}` }),
  }));

  vi.stubGlobal('EventSource', MockEventSource);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sseService', () => {
  it('connect es idempotente con el mismo token y usa un ticket, no el JWT', async () => {
    const service = await loadSseService();

    service.connect('token-a');
    service.connect('token-a');
    service.connect('token-a');
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('ticket=ticket-1');
    expect(MockEventSource.instances[0].url).not.toContain('token-a');
  });

  it('envía el JWT en el encabezado al pedir el ticket', async () => {
    const service = await loadSseService();

    service.connect('token-a');
    await settle();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/sse-ticket'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-a' }),
      })
    );
  });

  it('reemplaza la conexión cuando cambia el token', async () => {
    const service = await loadSseService();

    service.connect('token-a');
    await settle();
    service.connect('token-b');
    await settle();

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(MockEventSource.instances[1].url).toContain('ticket=ticket-2');
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-b' }),
      })
    );
  });

  it('pide un ticket nuevo al reconectar', async () => {
    vi.useFakeTimers();
    const service = await loadSseService();

    service.connect('token-a');
    await vi.advanceTimersByTimeAsync(0);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('ticket=ticket-1');

    MockEventSource.instances[0].onerror?.();
    await vi.advanceTimersByTimeAsync(1000);

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].url).toContain('ticket=ticket-2');
  });

  it('entrega configuracion.changed con la revisión', async () => {
    const service = await loadSseService();
    const received: SseConfiguracionChangedEvent[] = [];

    service.on<SseConfiguracionChangedEvent>('configuracion.changed', (event) => {
      received.push(event);
    });

    service.connect('token-a');
    await settle();
    MockEventSource.instances[0].emit('configuracion.changed', { revision: 7 });

    expect(received).toEqual([{ revision: 7 }]);
  });

  it('actualiza el estado de conexión al abrir', async () => {
    const service = await loadSseService();
    const states: SseConnectionState[] = [];

    service.onStateChange((state) => states.push(state));

    service.connect('token-a');
    await settle();
    MockEventSource.instances[0].onopen?.();

    expect(service.getState().isConnected).toBe(true);
    expect(states[states.length - 1].isConnected).toBe(true);
  });

  it('disconnect cancela un ticket en vuelo y no abre conexión', async () => {
    const service = await loadSseService();

    service.connect('token-a');
    service.disconnect();
    await settle();

    expect(MockEventSource.instances).toHaveLength(0);
  });
});
