import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

const sseMocks = vi.hoisted(() => {
  const handlers = new Map<string, Set<(data: unknown) => void>>();
  const stateHandlers = new Set<(state: unknown) => void>();

  return {
    handlers,
    stateHandlers,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, callback: (data: unknown) => void) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)?.add(callback);
      return () => {
        handlers.get(event)?.delete(callback);
      };
    }),
    onStateChange: vi.fn((callback: (state: unknown) => void) => {
      stateHandlers.add(callback);
      callback({
        isConnected: false,
        lastConnected: null,
        reconnectAttempts: 0,
        error: null,
      });
      return () => {
        stateHandlers.delete(callback);
      };
    }),
    getState: vi.fn(() => ({
      isConnected: false,
      lastConnected: null,
      reconnectAttempts: 0,
      error: null,
    })),
  };
});

vi.mock('@/services/sseService', () => ({
  sseService: {
    connect: sseMocks.connect,
    disconnect: sseMocks.disconnect,
    on: sseMocks.on,
    onStateChange: sseMocks.onStateChange,
    getState: sseMocks.getState,
  },
}));

const apiMocks = vi.hoisted(() => ({
  consultar: vi.fn(),
  sync: vi.fn(),
}));

vi.mock('../configuracionApi', () => ({
  configuracionApi: apiMocks,
}));

import { ConfigSyncProvider } from '../ConfigSyncProvider';
import { useAuthStore } from '@/shared/auth/authStore';
import type { ConfiguracionSnapshot } from '../types';
import {
  resetConfiguracionStoreForTests,
  useConfiguracionStore,
} from '../configuracionStore';
import { resetConfigRuntimeForTests } from '../configRuntime';

const EMPTY_SNAPSHOT: ConfiguracionSnapshot = {
  revisionActual: 1,
  variables: [],
  eliminadas: [],
};

function seedCache(): void {
  useConfiguracionStore.getState().applyChanges({
    revisionActual: 1,
    variables: [
      { clave: 'tema', tipoDato: 'string', valor: 'dark', revision: 1 },
    ],
    eliminadas: [],
  });
}

function setupSession(authenticated = true): void {
  useAuthStore.setState({
    token: authenticated ? 'test-token' : null,
    isAuthenticated: authenticated,
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    // Varios turnos de microtask: syncNow -> respuesta -> applyChanges ->
    // setState del provider.
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

async function renderProvider() {
  let result!: ReturnType<typeof render>;

  await act(async () => {
    result = render(
      <ConfigSyncProvider>
        <div />
      </ConfigSyncProvider>
    );
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });

  return result;
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

function emitEvent(event: string, data: unknown): void {
  act(() => {
    sseMocks.handlers.get(event)?.forEach((callback) => callback(data));
  });
}

function emitConnectionState(isConnected: boolean): void {
  act(() => {
    sseMocks.stateHandlers.forEach((callback) =>
      callback({
        isConnected,
        lastConnected: isConnected ? new Date() : null,
        reconnectAttempts: 0,
        error: null,
      })
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();

  localStorage.clear();
  resetConfiguracionStoreForTests();
  resetConfigRuntimeForTests();

  sseMocks.handlers.clear();
  sseMocks.stateHandlers.clear();
  sseMocks.connect.mockClear();
  sseMocks.disconnect.mockClear();
  sseMocks.on.mockClear();
  sseMocks.onStateChange.mockClear();

  apiMocks.consultar.mockReset();
  apiMocks.sync.mockReset();
  apiMocks.consultar.mockResolvedValue(EMPTY_SNAPSHOT);
  apiMocks.sync.mockResolvedValue(EMPTY_SNAPSHOT);

  setupSession(true);
  seedCache();
});

afterEach(() => {
  // Desmontar ANTES de tocar los stores: si el provider sigue suscrito a
  // authStore, los setState del reset disparan renders fuera de act().
  cleanup();
  resetConfigRuntimeForTests();
  resetConfiguracionStoreForTests();
  useAuthStore.setState({ token: null, isAuthenticated: false });
  vi.useRealTimers();
});

describe('ConfigSyncProvider', () => {
  it('conecta SSE con la sesión y hace sync inicial + polling cada 10 minutos', async () => {
    await renderProvider();

    expect(sseMocks.connect).toHaveBeenCalledWith('test-token');
    expect(apiMocks.sync).toHaveBeenCalledTimes(1);

    await advance(10 * 60 * 1000);
    await flush();

    expect(apiMocks.sync).toHaveBeenCalledTimes(2);
  });

  it('coalesce una ráfaga de eventos configuracion.changed en un solo sync', async () => {
    await renderProvider();
    apiMocks.sync.mockClear();

    emitEvent('configuracion.changed', { revision: 2 });
    emitEvent('configuracion.changed', { revision: 3 });
    emitEvent('configuracion.changed', { revision: 4 });

    expect(apiMocks.sync).not.toHaveBeenCalled();

    await advance(250);
    await flush();

    expect(apiMocks.sync).toHaveBeenCalledTimes(1);
  });

  it('sincroniza al reconectar SSE', async () => {
    await renderProvider();
    apiMocks.sync.mockClear();

    emitConnectionState(true);
    await flush();

    expect(apiMocks.sync).toHaveBeenCalledTimes(1);
  });

  it('reintenta con backoff sin esperar al polling', async () => {
    apiMocks.sync.mockRejectedValueOnce(new Error('down'));

    await renderProvider();
    expect(apiMocks.sync).toHaveBeenCalledTimes(1);

    // Primer reintento programado a 2 s.
    await advance(2000);
    await flush();

    expect(apiMocks.sync).toHaveBeenCalledTimes(2);
  });

  it('no conecta ni consulta sin sesión', async () => {
    setupSession(false);

    await renderProvider();

    expect(sseMocks.connect).not.toHaveBeenCalled();
    expect(apiMocks.sync).not.toHaveBeenCalled();
    expect(apiMocks.consultar).not.toHaveBeenCalled();
  });

  it('limpia el polling al desmontar', async () => {
    const { unmount } = await renderProvider();
    expect(apiMocks.sync).toHaveBeenCalledTimes(1);

    unmount();

    await advance(30 * 60 * 1000);
    await flush();

    expect(apiMocks.sync).toHaveBeenCalledTimes(1);
  });

  it('se suscribe a los eventos requeridos sin duplicar listeners', async () => {
    await renderProvider();

    expect(sseMocks.on).toHaveBeenCalledWith(
      'configuracion.changed',
      expect.any(Function)
    );
    expect(sseMocks.on).toHaveBeenCalledWith('connected', expect.any(Function));
    expect(sseMocks.onStateChange).toHaveBeenCalledTimes(1);
  });
});
