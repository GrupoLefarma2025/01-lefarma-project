import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'lost';

interface ConnectionState {
  status: ConnectionStatus;
  retryCount: number;
  nextRetryAt: number | null;
  secondsUntilRetry: number;
  markLost: () => void;
  markConnected: () => void;
  startHealthCheck: () => void;
  stopHealthCheck: () => void;
  retryNow: () => void;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const HEALTH_URL = `${API_BASE_URL}/health`;
const HEALTH_TIMEOUT_MS = 5000;

// Backoff: 3s, 6s, 10s y luego 15s fijo. La espera se mantiene corta a propósito:
// el usuario está bloqueado mirando el aviso y lo normal es que el servidor
// vuelva en segundos, así que el mensaje debe desaparecer cuanto antes.
const BACKOFF_STEPS = [3000, 6000, 10000];
const CAP_DELAY_MS = 15000;

let timerHandle: ReturnType<typeof setTimeout> | null = null;
let countdownHandle: ReturnType<typeof setInterval> | null = null;
let attempt = 0;
let manualRetry = false;
let probing = false;

function getNextDelay(): number {
  return attempt < BACKOFF_STEPS.length ? BACKOFF_STEPS[attempt] : CAP_DELAY_MS;
}

function clearTimers() {
  if (timerHandle) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
  if (countdownHandle) {
    clearInterval(countdownHandle);
    countdownHandle = null;
  }
}

// El probe usa fetch a propósito: no pasa por los interceptores de axios (auth,
// refresh, cancelación). Si dependiera de ellos, un fallo del propio cliente
// HTTP dejaría el overlay pegado aunque el servidor ya estuviera respondiendo.
async function probe(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'connected',
  retryCount: 0,
  nextRetryAt: null,
  secondsUntilRetry: 0,

  markLost: () => {
    if (get().status === 'lost') return;
    set({ status: 'lost', retryCount: 0 });
    get().startHealthCheck();
  },

  markConnected: () => {
    // No-op si ya estamos conectados: evita re-renders y resets en cada SSE open
    // y en cada respuesta exitosa que pasa por el interceptor de axios.
    if (get().status === 'connected') return;
    clearTimers();
    attempt = 0;
    manualRetry = false;
    set({ status: 'connected', retryCount: 0, nextRetryAt: null, secondsUntilRetry: 0 });
  },

  startHealthCheck: () => {
    clearTimers();
    attempt = 0;
    manualRetry = false;
    scheduleNext(set, get);
  },

  stopHealthCheck: () => {
    clearTimers();
    attempt = 0;
    manualRetry = false;
  },

  retryNow: () => {
    manualRetry = true;
    clearTimers();
    // Sin esto la línea "Reintentando en Xs" seguía mostrando la cuenta atrás
    // vieja mientras el reintento manual ya estaba en vuelo.
    set({ nextRetryAt: null, secondsUntilRetry: 0 });
    void runProbe(set, get);
  },
}));

function scheduleNext(set: (partial: Partial<ConnectionState>) => void, get: () => ConnectionState) {
  const delay = getNextDelay();
  const nextAt = Date.now() + delay;
  set({ nextRetryAt: nextAt, secondsUntilRetry: Math.ceil(delay / 1000) });

  countdownHandle = setInterval(() => {
    const remaining = Math.max(0, Math.ceil(((get().nextRetryAt ?? Date.now()) - Date.now()) / 1000));
    set({ secondsUntilRetry: remaining });
  }, 1000);

  timerHandle = setTimeout(() => {
    void runProbe(set, get);
  }, delay);
}

async function runProbe(set: (partial: Partial<ConnectionState>) => void, get: () => ConnectionState) {
  // Un solo probe en vuelo: los eventos del navegador pueden disparar retryNow
  // varias veces seguidas y no queremos sondas duplicadas.
  if (probing) return;
  probing = true;
  if (countdownHandle) {
    clearInterval(countdownHandle);
    countdownHandle = null;
  }
  if (timerHandle) {
    clearTimeout(timerHandle);
    timerHandle = null;
  }
  try {
    const isUp = await probe();
    if (isUp) {
      get().markConnected();
      return;
    }
    if (!manualRetry) attempt++;
    manualRetry = false;
    set({ retryCount: get().retryCount + 1 });
    scheduleNext(set, get);
  } finally {
    probing = false;
  }
}

/**
 * Escucha los avisos del navegador de que la red puede haber vuelto.
 * Sin esto la recuperación dependía solo de los timers del overlay: si el
 * navegador estrangula los timers de una pestaña en segundo plano, el reintento
 * puede tardar hasta 60s en darse cuenta de que el servidor ya responde.
 */
export function startConnectivityWatchers(): () => void {
  if (typeof window === 'undefined') return () => {};

  const checkNow = () => {
    if (useConnectionStore.getState().status !== 'lost') return;
    useConnectionStore.getState().retryNow();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') checkNow();
  };

  window.addEventListener('online', checkNow);
  window.addEventListener('focus', checkNow);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.removeEventListener('online', checkNow);
    window.removeEventListener('focus', checkNow);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
