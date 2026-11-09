import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  consultar: vi.fn(),
  sync: vi.fn(),
}));

vi.mock('../configuracionApi', () => ({
  configuracionApi: apiMocks,
}));

import { useAuthStore } from '@/shared/auth/authStore';
import type { ConfiguracionSnapshot } from '../types';
import {
  resetConfiguracionStoreForTests,
  useConfiguracionStore,
} from '../configuracionStore';
import {
  ensureConfig,
  registerConfigKeys,
  resetConfigRuntimeForTests,
  syncNow,
} from '../configRuntime';

function snapshot(
  revisionActual: number,
  variables: ConfiguracionSnapshot['variables'] = [],
  eliminadas: string[] = []
): ConfiguracionSnapshot {
  return { revisionActual, variables, eliminadas };
}

function seedCache(): void {
  useConfiguracionStore.getState().applyChanges(
    snapshot(1, [
      { clave: 'tema', tipoDato: 'string', valor: 'dark', revision: 1 },
    ])
  );
}

beforeEach(() => {
  localStorage.clear();
  resetConfiguracionStoreForTests();
  resetConfigRuntimeForTests();

  apiMocks.consultar.mockReset();
  apiMocks.sync.mockReset();

  useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
});

afterEach(() => {
  resetConfigRuntimeForTests();
  resetConfiguracionStoreForTests();
  useAuthStore.setState({ token: null, isAuthenticated: false });
});

describe('ensureConfig', () => {
  it('agrupa hooks del mismo microtask en un único lote', async () => {
    apiMocks.consultar.mockResolvedValue(
      snapshot(1, [
        { clave: 'a', tipoDato: 'string', valor: 'A', revision: 1 },
        { clave: 'b', tipoDato: 'number', valor: 2, revision: 1 },
      ])
    );

    const [ra, rb, raDuplicada] = await Promise.all([
      ensureConfig(['a']),
      ensureConfig(['b']),
      ensureConfig(['a']),
    ]);

    expect(apiMocks.consultar).toHaveBeenCalledTimes(1);

    const payload = apiMocks.consultar.mock.calls[0][0] as Array<{ clave: string }>;
    expect(payload.map((item) => item.clave)).toEqual(['a', 'b']);

    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    expect(raDuplicada.ok).toBe(true);

    const state = useConfiguracionStore.getState();
    expect(state.variables.a.valor).toBe('A');
    expect(state.variables.b.valor).toBe(2);
  });

  it('hace single-flight por clave aunque la segunda llamada llegue después del lanzamiento', async () => {
    let resolveConsultar!: (value: ConfiguracionSnapshot) => void;

    apiMocks.consultar.mockImplementation(
      () =>
        new Promise<ConfiguracionSnapshot>((resolve) => {
          resolveConsultar = resolve;
        })
    );

    const first = ensureConfig(['x']);

    // Deja correr el microtask que lanza el lote.
    await Promise.resolve();

    const second = ensureConfig(['x']);
    await Promise.resolve();

    expect(apiMocks.consultar).toHaveBeenCalledTimes(1);

    resolveConsultar(
      snapshot(1, [{ clave: 'x', tipoDato: 'string', valor: 'X', revision: 1 }])
    );

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(useConfiguracionStore.getState().variables.x.valor).toBe('X');
  });

  it('no consulta sin sesión y registra las claves para después', async () => {
    useAuthStore.setState({ token: null, isAuthenticated: false });

    const result = await ensureConfig(['tema']);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(apiMocks.consultar).not.toHaveBeenCalled();
  });

  it('conserva el cache si la petición falla', async () => {
    seedCache();
    apiMocks.consultar.mockRejectedValue(new Error('offline'));

    const result = await ensureConfig(['tema'], { force: true });

    expect(result.ok).toBe(false);
    expect(useConfiguracionStore.getState().variables.tema.valor).toBe('dark');
  });

  it('no llama al backend si la clave ya está en cache', async () => {
    seedCache();

    const result = await ensureConfig(['tema']);

    expect(result.skipped).toBe(true);
    expect(apiMocks.consultar).not.toHaveBeenCalled();
  });

  it('respeta throwOnError cuando el llamador lo pide', async () => {
    apiMocks.consultar.mockRejectedValue(new Error('boom'));

    await expect(ensureConfig(['k'], { throwOnError: true })).rejects.toThrow('boom');
  });
});

describe('syncNow', () => {
  it('hace single-flight global y envía todas las claves cacheadas', async () => {
    seedCache();

    let resolveSync!: (value: ConfiguracionSnapshot) => void;
    apiMocks.sync.mockImplementation(
      () =>
        new Promise<ConfiguracionSnapshot>((resolve) => {
          resolveSync = resolve;
        })
    );

    const first = syncNow();
    const second = syncNow();

    expect(apiMocks.sync).toHaveBeenCalledTimes(1);
    expect(apiMocks.sync.mock.calls[0][0]).toBe(1);
    expect(apiMocks.sync.mock.calls[0][1]).toEqual(['tema']);

    resolveSync(
      snapshot(2, [{ clave: 'tema', tipoDato: 'string', valor: 'light', revision: 2 }])
    );

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(useConfiguracionStore.getState().revision).toBe(2);
    expect(useConfiguracionStore.getState().variables.tema.valor).toBe('light');
  });

  it('no llama si no hay claves cacheadas ni registradas', async () => {
    const result = await syncNow();

    expect(result.skipped).toBe(true);
    expect(apiMocks.sync).not.toHaveBeenCalled();
  });

  it('incluye claves registradas aunque no tengan cache', async () => {
    registerConfigKeys(['solo-registrada']);
    apiMocks.sync.mockResolvedValue(snapshot(1));

    await syncNow();

    expect(apiMocks.sync).toHaveBeenCalledTimes(1);
    expect(apiMocks.sync.mock.calls[0][1]).toEqual(['solo-registrada']);
  });

  it('no llama sin sesión', async () => {
    seedCache();
    useAuthStore.setState({ token: null, isAuthenticated: false });

    const result = await syncNow();

    expect(result.skipped).toBe(true);
    expect(apiMocks.sync).not.toHaveBeenCalled();
  });
});
