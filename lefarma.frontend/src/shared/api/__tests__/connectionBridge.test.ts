import { beforeEach, describe, expect, it } from 'vitest';
import apiClient from '@/shared/api/apiClient';
import { useConnectionStore } from '@/shared/connection/connectionStore';

const state = () => useConnectionStore.getState();

const marcarDesconectado = () => {
  state().stopHealthCheck();
  useConnectionStore.setState({
    status: 'lost',
    retryCount: 4,
    nextRetryAt: null,
    secondsUntilRetry: 10,
  });
};

describe('puente entre las respuestas de la API y el aviso de conexión', () => {
  beforeEach(marcarDesconectado);

  it('una respuesta correcta quita el aviso aunque no sea el sondeo', () => {
    const responseInterceptor = (
      apiClient.interceptors.response as unknown as {
        handlers: Array<{ fulfilled: (response: unknown) => unknown }>;
      }
    ).handlers[0];

    responseInterceptor.fulfilled({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });

    expect(state().status).toBe('connected');
  });

  it('un fallo de red sigue dejando el aviso', async () => {
    apiClient.defaults.adapter = async () => {
      throw new Error('Network Error');
    };

    await expect(apiClient.get('/cualquier-pantalla')).rejects.toBeDefined();

    expect(state().status).toBe('lost');
  });
});
