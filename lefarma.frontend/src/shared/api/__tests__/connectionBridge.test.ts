import { beforeEach, describe, expect, it } from 'vitest';
import apiClient from '@/shared/api/apiClient';
import { useConnectionStore } from '@/shared/connection/connectionStore';

const state = () => useConnectionStore.getState();

// Simula que el aviso de "sin conexión" lleva un rato en pantalla. El caso real
// que motivó estas pruebas: el servidor vuelve y la petición que llega primero
// no es el sondeo de /health, así que el aviso se quedaba pegado.
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
    // Se invoca el interceptor de respuestas registrado por apiClient, que es
    // justo el que ve cualquier pantalla que carga datos con éxito.
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
