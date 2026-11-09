import { useAuthStore } from '@/shared/auth/authStore';
import { configuracionApi } from './configuracionApi';
import { useConfiguracionStore } from './configuracionStore';
import type {
  ConfiguracionConsultaVariable,
  EnsureConfigOptions,
  EnsureConfigResult,
  SyncNowOptions,
  SyncNowResult,
} from './types';

interface EnsureWaiter {
  keys: string[];
  options: EnsureConfigOptions;
  resolve: (result: EnsureConfigResult) => void;
  reject: (error: unknown) => void;
}

/**
 * Claves solicitadas por alguna ruta/pantalla. No se eliminan nunca: aunque la
 * pantalla se desmonte, la clave sigue entrando en el sync global y en el
 * polling para mantener el cache fresco.
 */
const registeredKeys = new Set<string>();

/** Single-flight por clave: dos consumidores de la misma clave comparten request. */
const inFlightByKey = new Map<string, Promise<EnsureConfigResult>>();

/** Waiters del ciclo de microtask actual (batch de hooks del mismo render). */
let queuedWaiters: EnsureWaiter[] = [];

let flushScheduled = false;

/** Single-flight global para syncNow. */
let syncPromise: Promise<SyncNowResult> | null = null;

function hasOwn(target: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function normalizeKeys(keys: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(keys)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const key of keys) {
    if (typeof key !== 'string' || key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }

  return result;
}

/** Solo se consulta con sesión: nunca endpoints protegidos sin token. */
function getSessionToken(): string | null {
  return useAuthStore.getState().token || null;
}

function okResult(fetched: string[] = []): EnsureConfigResult {
  return { ok: true, error: null, fetched, skipped: false };
}

function skippedResult(): EnsureConfigResult {
  return { ok: true, error: null, fetched: [], skipped: true };
}

function skippedSyncResult(): SyncNowResult {
  return { ok: true, error: null, skipped: true };
}

function withEnsureThrowPolicy(
  promise: Promise<EnsureConfigResult>,
  throwOnError?: boolean
): Promise<EnsureConfigResult> {
  if (!throwOnError) {
    return promise;
  }

  return promise.then((result) => {
    if (!result.ok) {
      throw result.error ?? new Error('CONFIG_ENSURE_FAILED');
    }
    return result;
  });
}

function withSyncThrowPolicy(
  promise: Promise<SyncNowResult>,
  throwOnError?: boolean
): Promise<SyncNowResult> {
  if (!throwOnError) {
    return promise;
  }

  return promise.then((result) => {
    if (!result.ok) {
      throw result.error ?? new Error('CONFIG_SYNC_FAILED');
    }
    return result;
  });
}

function settleWaiter(waiter: EnsureWaiter, result: EnsureConfigResult): void {
  if (!result.ok && waiter.options.throwOnError) {
    waiter.reject(result.error ?? new Error('CONFIG_ENSURE_FAILED'));
    return;
  }
  waiter.resolve(result);
}

function scheduleEnsureFlush(): void {
  if (flushScheduled) {
    return;
  }
  flushScheduled = true;

  // Un solo lote por ciclo de microtask: todos los hooks que montan en el
  // mismo render/commit se agrupan en una única petición.
  queueMicrotask(() => {
    flushScheduled = false;
    void flushEnsureQueue();
  });
}

async function flushEnsureQueue(): Promise<void> {
  if (queuedWaiters.length === 0) {
    return;
  }

  const waiters = queuedWaiters;
  queuedWaiters = [];

  if (!getSessionToken()) {
    for (const waiter of waiters) {
      settleWaiter(waiter, skippedResult());
    }
    return;
  }

  const requested = new Set<string>();
  const forced = new Set<string>();

  for (const waiter of waiters) {
    for (const key of waiter.keys) {
      requested.add(key);
      if (waiter.options.force) {
        forced.add(key);
      }
    }
  }

  const state = useConfiguracionStore.getState();
  const newKeys: string[] = [];

  for (const key of requested) {
    if (inFlightByKey.has(key)) {
      continue;
    }
    if (!hasOwn(state.variables, key) || forced.has(key)) {
      newKeys.push(key);
    }
  }

  if (newKeys.length > 0) {
    const payload: ConfiguracionConsultaVariable[] = newKeys.map((clave) => {
      const cached = state.variables[clave];
      return cached ? { clave, revision: cached.revision } : { clave };
    });

    const controller = new AbortController();
    const newKeySet = new Set(newKeys);
    const activeSignals = new Set<AbortSignal>();

    const abortIfAllConsumersGone = () => {
      let allAborted = true;
      for (const signal of activeSignals) {
        if (!signal.aborted) {
          allAborted = false;
          break;
        }
      }
      if (allAborted) {
        controller.abort();
      }
    };

    for (const waiter of waiters) {
      const signal = waiter.options.signal;
      if (!signal) {
        continue;
      }
      if (!waiter.keys.some((key) => newKeySet.has(key))) {
        continue;
      }
      activeSignals.add(signal);
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', abortIfAllConsumersGone, { once: true });
      }
    }

    const batchPromise = (async (): Promise<EnsureConfigResult> => {
      try {
        const snapshot = await configuracionApi.consultar(payload, {
          signal: controller.signal,
        });
        useConfiguracionStore.getState().applyChanges(snapshot);
        return okResult(newKeys);
      } catch (error) {
        return { ok: false, error, fetched: newKeys, skipped: false };
      }
    })().finally(() => {
      // Limpieza garantizada: las promesas nunca se quedan colgadas.
      for (const key of newKeys) {
        inFlightByKey.delete(key);
      }
      for (const signal of activeSignals) {
        signal.removeEventListener('abort', abortIfAllConsumersGone);
      }
    });

    for (const key of newKeys) {
      inFlightByKey.set(key, batchPromise);
    }
  }

  await Promise.all(
    waiters.map(async (waiter) => {
      const results = await Promise.all(
        waiter.keys.map((key) => inFlightByKey.get(key) ?? Promise.resolve(okResult()))
      );

      const failed = results.find((result) => !result.ok);
      if (failed) {
        settleWaiter(waiter, {
          ok: false,
          error: failed.error,
          fetched: [],
          skipped: false,
        });
        return;
      }

      settleWaiter(waiter, okResult());
    })
  );
}

/** Registra claves para que sigan sincronizándose aunque la ruta se desmonte. */
export function registerConfigKeys(keys: readonly string[]): void {
  for (const key of normalizeKeys(keys)) {
    registeredKeys.add(key);
  }
}

export function getRegisteredConfigKeys(): string[] {
  return [...registeredKeys];
}

/** Claves registradas que todavía no están en el cache. */
export function getMissingConfigKeys(): string[] {
  const { variables } = useConfiguracionStore.getState();
  return [...registeredKeys].filter((key) => !hasOwn(variables, key));
}

/**
 * Asegura que las claves indicadas estén en el store.
 * - Solo pide las que faltan (o todas si `force`).
 * - Un lote por microtask + single-flight por clave.
 * - Nunca lanza salvo `throwOnError`.
 */
export function ensureConfig(
  keys: readonly string[],
  options: EnsureConfigOptions = {}
): Promise<EnsureConfigResult> {
  const unique = normalizeKeys(keys);
  registerConfigKeys(unique);

  if (unique.length === 0) {
    return Promise.resolve(skippedResult());
  }

  const { variables } = useConfiguracionStore.getState();
  const needed = options.force
    ? unique
    : unique.filter((key) => !hasOwn(variables, key));

  if (needed.length === 0) {
    return Promise.resolve(skippedResult());
  }

  // Sin token no se consulta el endpoint protegido. Las claves quedan
  // registradas y el provider las recupera al autenticarse.
  if (!getSessionToken()) {
    return Promise.resolve(skippedResult());
  }

  const promise = new Promise<EnsureConfigResult>((resolve, reject) => {
    queuedWaiters.push({ keys: needed, options, resolve, reject });
    scheduleEnsureFlush();
  });

  return withEnsureThrowPolicy(promise, options.throwOnError);
}

/**
 * Pide únicamente claves registradas que aún no tienen valor (p. ej. hooks que
 * montaron antes del login). No descarga el catálogo completo.
 */
export function ensureMissingConfigKeys(
  options: EnsureConfigOptions = {}
): Promise<EnsureConfigResult> {
  return ensureConfig(getMissingConfigKeys(), options);
}

/**
 * Sincroniza desde la revisión local TODAS las claves cacheadas + registradas.
 * Si no hay claves no llama al backend. Single-flight global.
 */
export function syncNow(options: SyncNowOptions = {}): Promise<SyncNowResult> {
  if (syncPromise) {
    return withSyncThrowPolicy(syncPromise, options.throwOnError);
  }

  const state = useConfiguracionStore.getState();
  const claves = [...new Set([...Object.keys(state.variables), ...registeredKeys])];

  if (claves.length === 0) {
    return Promise.resolve(skippedSyncResult());
  }

  if (!getSessionToken()) {
    return Promise.resolve(skippedSyncResult());
  }

  const promise = (async (): Promise<SyncNowResult> => {
    try {
      const snapshot = await configuracionApi.sync(state.revision, claves, {
        signal: options.signal,
      });
      useConfiguracionStore.getState().applyChanges(snapshot);
      return { ok: true, error: null, skipped: false };
    } catch (error) {
      return { ok: false, error, skipped: false };
    }
  })();

  syncPromise = promise;

  void promise.finally(() => {
    if (syncPromise === promise) {
      syncPromise = null;
    }
  });

  return withSyncThrowPolicy(promise, options.throwOnError);
}

/** Solo para tests. */
export function resetConfigRuntimeForTests(): void {
  registeredKeys.clear();
  inFlightByKey.clear();
  queuedWaiters = [];
  flushScheduled = false;
  syncPromise = null;
}
