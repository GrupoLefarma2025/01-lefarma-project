import { create } from 'zustand';
import { API } from '@/shared/api/apiClient';

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

const HEALTH_URL = '/health';
const HEALTH_TIMEOUT_MS = 5000;

// Backoff: 5s, 10s, 20s, 40s (exponential), then 60s capped.
const BACKOFF_STEPS = [5000, 10000, 20000, 40000];
const CAP_DELAY_MS = 60000;

let timerHandle: ReturnType<typeof setTimeout> | null = null;
let countdownHandle: ReturnType<typeof setInterval> | null = null;
let attempt = 0;
let manualRetry = false;

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

async function probe(): Promise<boolean> {
  try {
    await API.get(HEALTH_URL, { timeout: HEALTH_TIMEOUT_MS });
    return true;
  } catch {
    return false;
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
    // No-op si ya estamos conectados: evita re-renders y resets en cada SSE open.
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
  if (countdownHandle) {
    clearInterval(countdownHandle);
    countdownHandle = null;
  }
  const isUp = await probe();
  if (isUp) {
    get().markConnected();
    return;
  }
  if (!manualRetry) attempt++;
  manualRetry = false;
  set({ retryCount: get().retryCount + 1 });
  scheduleNext(set, get);
}
