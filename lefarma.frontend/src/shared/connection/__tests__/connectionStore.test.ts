import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  startConnectivityWatchers,
  useConnectionStore,
} from '@/shared/connection/connectionStore';

const state = () => useConnectionStore.getState();

const resetConnection = () => {
  state().stopHealthCheck();
  useConnectionStore.setState({
    status: 'connected',
    retryCount: 0,
    nextRetryAt: null,
    secondsUntilRetry: 0,
  });
};

const confirmar = async () => {
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(800);
  await vi.advanceTimersByTimeAsync(1);
};

describe('connectionStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    resetConnection();
  });

  afterEach(() => {
    resetConnection();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('no bloquea la aplicación si /health responde aunque fallen otras peticiones', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    state().markLost();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state().status).toBe('connected');
  });

  it('muestra el aviso cuando /health tampoco responde', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    state().markLost();
    await confirmar();

    expect(state().status).toBe('lost');
    expect(state().secondsUntilRetry).toBe(3);
  });

  it('vuelve a conectado cuando el reintento encuentra el servidor', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true });

    state().markLost();
    await confirmar();
    expect(state().status).toBe('lost');
    expect(state().secondsUntilRetry).toBe(3);

    await vi.advanceTimersByTimeAsync(3000);

    expect(state().status).toBe('connected');
  });

  it('alarga el retraso entre intentos mientras el servidor sigue caído', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    state().markLost();
    await confirmar();
    const sondeosIniciales = fetchMock.mock.calls.length;

    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock.mock.calls.length).toBe(sondeosIniciales + 1);
    expect(state().retryCount).toBe(1);
    expect(state().secondsUntilRetry).toBe(6);

    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock.mock.calls.length).toBe(sondeosIniciales + 2);
    expect(state().retryCount).toBe(2);
    expect(state().secondsUntilRetry).toBe(10);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchMock.mock.calls.length).toBe(sondeosIniciales + 3);
    expect(state().secondsUntilRetry).toBe(15);

    await vi.advanceTimersByTimeAsync(15000);
    expect(fetchMock.mock.calls.length).toBe(sondeosIniciales + 4);
    expect(state().secondsUntilRetry).toBe(15);

    expect(state().status).toBe('lost');
  });

  it('usa fetch directo, sin cabecera de autorización ni interceptores', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    state().markLost();
    await vi.advanceTimersByTimeAsync(0);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/health$/);
    expect(options.cache).toBe('no-store');
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('el reintento manual no espera y limpia la cuenta atrás', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    state().markLost();
    await confirmar();
    const sondeosIniciales = fetchMock.mock.calls.length;

    state().retryNow();

    expect(state().secondsUntilRetry).toBe(0);

    await vi.advanceTimersByTimeAsync(1);

    expect(fetchMock.mock.calls.length).toBe(sondeosIniciales + 1);
    expect(state().retryCount).toBe(1);
  });

  it('reintenta al instante cuando el navegador avisa de que hay red', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true });
    const stopWatchers = startConnectivityWatchers();

    state().markLost();
    await confirmar();

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(1);

    expect(state().status).toBe('connected');

    stopWatchers();
  });

  it('solo consulta el servidor si sigue desconectado', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const stopWatchers = startConnectivityWatchers();

    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(1);

    expect(fetchMock).not.toHaveBeenCalled();

    stopWatchers();
  });

  it('markConnected es idempotente para no resetear en cada respuesta exitosa', () => {
    state().markConnected();

    expect(state().status).toBe('connected');
    expect(vi.getTimerCount()).toBe(0);
  });
});
