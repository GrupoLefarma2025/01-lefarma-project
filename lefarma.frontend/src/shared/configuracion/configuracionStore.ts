import { create } from 'zustand';
import type {
  ConfiguracionPersistedState,
  ConfiguracionState,
  ConfiguracionStore,
  ConfiguracionVariable,
} from './types';
import {
  CONFIGURACION_SCHEMA_VERSION,
  CONFIGURACION_STORAGE_KEY,
} from './types';

const PERSIST_DEBOUNCE_MS = 500;

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeKey(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !BLOCKED_KEYS.has(value);
}

function isValidRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function removePersistedState(storage: Storage): void {
  try {
    storage.removeItem(CONFIGURACION_STORAGE_KEY);
  } catch {
  }
}

function normalizeVariable(value: unknown): ConfiguracionVariable | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (!isValidRevision(value.revision) || typeof value.tipoDato !== 'string') {
    return null;
  }

  const valor = Object.prototype.hasOwnProperty.call(value, 'valor') ? value.valor : null;

  return {
    valor,
    tipoDato: value.tipoDato,
    revision: value.revision,
  };
}

function readPersistedState(): ConfiguracionPersistedState | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  let raw: string | null;
  try {
    raw = storage.getItem(CONFIGURACION_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      !isPlainObject(parsed) ||
      parsed.schemaVersion !== CONFIGURACION_SCHEMA_VERSION ||
      !isValidRevision(parsed.revision) ||
      !isPlainObject(parsed.variables)
    ) {
      throw new Error('INVALID_CONFIG_CACHE');
    }

    const variables: Record<string, ConfiguracionVariable> = {};

    for (const [clave, value] of Object.entries(parsed.variables)) {
      if (!isSafeKey(clave)) {
        throw new Error('INVALID_CONFIG_CACHE');
      }
      const variable = normalizeVariable(value);
      if (!variable) {
        throw new Error('INVALID_CONFIG_CACHE');
      }
      variables[clave] = variable;
    }

    return {
      schemaVersion: CONFIGURACION_SCHEMA_VERSION,
      revision: parsed.revision,
      variables,
    };
  } catch {
    removePersistedState(storage);
    return null;
  }
}

function createInitialState(): ConfiguracionState {
  const persisted = readPersistedState();

  return {
    schemaVersion: CONFIGURACION_SCHEMA_VERSION,
    revision: persisted?.revision ?? 0,
    variables: persisted?.variables ?? {},
    hydrated: true,
  };
}

function writePersistedState(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const { revision, variables } = useConfiguracionStore.getState();
  const payload: ConfiguracionPersistedState = {
    schemaVersion: CONFIGURACION_SCHEMA_VERSION,
    revision,
    variables,
  };

  try {
    storage.setItem(CONFIGURACION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
  }
}

export function scheduleConfiguracionPersistence(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    writePersistedState();
  }, PERSIST_DEBOUNCE_MS);
}

export function flushConfiguracionPersistence(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  writePersistedState();
}

export function hydrateConfigStore(force = false): void {
  useConfiguracionStore.getState().hydrate(force);
}

export const useConfiguracionStore = create<ConfiguracionStore>()((set, get) => ({
  ...createInitialState(),

  hydrate: (force = false) => {
    if (get().hydrated && !force) {
      return;
    }

    const persisted = readPersistedState();
    if (!persisted) {
      set({ hydrated: true });
      return;
    }

    set({
      revision: persisted.revision,
      variables: persisted.variables,
      hydrated: true,
    });
  },

  applyChanges: (snapshot) => {
    if (
      !snapshot ||
      !isValidRevision(snapshot.revisionActual) ||
      typeof snapshot.revisionActual !== 'number'
    ) {
      return false;
    }

    const state = get();

    if (snapshot.revisionActual < state.revision) {
      return false;
    }

    const incoming = Array.isArray(snapshot.variables) ? snapshot.variables : [];
    const eliminadas = Array.isArray(snapshot.eliminadas) ? snapshot.eliminadas : [];

    let variables: Record<string, ConfiguracionVariable> = state.variables;
    let copied = false;
    let nextRevision = state.revision;

    const ensureCopy = () => {
      if (!copied) {
        variables = { ...state.variables };
        copied = true;
      }
    };

    for (const clave of eliminadas) {
      if (!isSafeKey(clave)) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(variables, clave)) {
        ensureCopy();
        delete variables[clave];
      }
    }

    for (const item of incoming) {
      if (!item || !isSafeKey(item.clave) || !isValidRevision(item.revision)) {
        continue;
      }

      const current = Object.prototype.hasOwnProperty.call(variables, item.clave)
        ? variables[item.clave]
        : undefined;

      if (current && item.revision <= current.revision) {
        continue;
      }

      ensureCopy();
      variables[item.clave] = {
        valor: item.valor,
        tipoDato: typeof item.tipoDato === 'string' ? item.tipoDato : 'desconocido',
        revision: item.revision,
      };

      nextRevision = Math.max(nextRevision, item.revision);
    }

    nextRevision = Math.max(nextRevision, snapshot.revisionActual);

    if (!copied && nextRevision === state.revision) {
      return false;
    }

    set({
      revision: nextRevision,
      variables: copied ? variables : state.variables,
    });

    scheduleConfiguracionPersistence();
    return true;
  },
}));

export function resetConfiguracionStoreForTests(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  useConfiguracionStore.setState({
    schemaVersion: CONFIGURACION_SCHEMA_VERSION,
    revision: 0,
    variables: {},
    hydrated: false,
  });
}
