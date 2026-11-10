import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

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
import { resetConfigRuntimeForTests } from '../configRuntime';
import { useConfig } from '../useConfig';

const SNAPSHOT: ConfiguracionSnapshot = {
  revisionActual: 1,
  variables: [
    { clave: 'a', tipoDato: 'string', valor: 'A', revision: 1 },
    { clave: 'b', tipoDato: 'string', valor: 'B', revision: 1 },
  ],
  eliminadas: [],
};

function Probe() {
  const a = useConfig<string>('a', 'default-a');
  const b = useConfig<string>('b', 'default-b');
  return (
    <div>
      {a}|{b}
    </div>
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
  cleanup();
  resetConfigRuntimeForTests();
  resetConfiguracionStoreForTests();
  useAuthStore.setState({ token: null, isAuthenticated: false });
});

describe('useConfig', () => {
  it('agrupa varios hooks del mismo render en una sola petición', async () => {
    apiMocks.consultar.mockResolvedValue(SNAPSHOT);

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByText('A|B')).toBeInTheDocument();
    });

    expect(apiMocks.consultar).toHaveBeenCalledTimes(1);
    const payload = apiMocks.consultar.mock.calls[0][0] as Array<{ clave: string }>;
    expect(payload.map((item) => item.clave)).toEqual(['a', 'b']);
  });

  it('con cache devuelve el valor de inmediato sin consultar', () => {
    useConfiguracionStore.getState().applyChanges(SNAPSHOT);

    render(<Probe />);

    expect(screen.getByText('A|B')).toBeInTheDocument();
    expect(apiMocks.consultar).not.toHaveBeenCalled();
  });
});
