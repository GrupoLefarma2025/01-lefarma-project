import { create } from 'zustand';

import {
  registrarFalloDeRed,
  registrarFalloHttp,
} from '@/shared/telemetria/capturaErrores';

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

const BACKOFF_STEPS = [3000, 6000, 10000];
const CAP_DELAY_MS = 15000;

let timerHandle: ReturnType<typeof setTimeout> | null = null;
let countdownHandle: ReturnType<typeof setInterval> | null = null;
let attempt = 0;
let manualRetry = false;
let probing = false;
let verifying = false;

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

async function probe(timeoutMs: number = HEALTH_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(HEALTH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      registrarFalloHttp({
        metodo: 'GET',
        url: HEALTH_URL,
        estado: response.status,
      });
    }
    return response.ok;
  } catch (error) {
    registrarFalloDeRed({
      metodo: 'GET',
      url: HEALTH_URL,
      detalle: error instanceof Error ? error.message : undefined,
    });
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
    void confirmarDesconexion(set, get);
  },

  markConnected: () => {
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

async function confirmarDesconexion(
  set: (partial: Partial<ConnectionState>) => void,
  get: () => ConnectionState,
) {
  if (verifying) return;
  verifying = true;
  try {
    if (await probe()) {
      get().markConnected();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (await probe(3000)) {
      get().markConnected();
      return;
    }
    set({ status: 'lost', retryCount: 0 });
    get().startHealthCheck();
  } finally {
    verifying = false;
  }
}

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
