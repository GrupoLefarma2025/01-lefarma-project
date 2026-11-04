import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIGURACION_STORAGE_KEY } from '../types';
import type { ConfiguracionSnapshot, ConfiguracionVariableDto } from '../types';
import {
  flushConfiguracionPersistence,
  hydrateConfigStore,
  resetConfiguracionStoreForTests,
  useConfiguracionStore,
} from '../configuracionStore';

function variable(
  clave: string,
  valor: unknown,
  revision: number
): ConfiguracionVariableDto {
  return { clave, tipoDato: 'string', valor, revision };
}

function snapshot(
  revisionActual: number,
  variables: ConfiguracionVariableDto[] = [],
  eliminadas: string[] = []
): ConfiguracionSnapshot {
  return { revisionActual, variables, eliminadas };
}

describe('configuracionStore.applyChanges', () => {
  beforeEach(() => {
    localStorage.clear();
    resetConfiguracionStoreForTests();
  });

  afterEach(() => {
    resetConfiguracionStoreForTests();
  });

  it('aplica revisiones mayores y nunca retrocede', () => {
    const store = useConfiguracionStore.getState();

    expect(store.applyChanges(snapshot(3, [variable('tema', 'dark', 3)]))).toBe(true);

    let state = useConfiguracionStore.getState();
    expect(state.revision).toBe(3);
    expect(state.variables.tema).toEqual({
      valor: 'dark',
      tipoDato: 'string',
      revision: 3,
    });

    // Respuesta vieja (revisión global menor): se ignora completa.
    expect(store.applyChanges(snapshot(2, [variable('tema', 'light', 2)]))).toBe(false);

    // Misma revisión global pero revisión de clave menor: no pisa el valor.
    expect(store.applyChanges(snapshot(3, [variable('tema', 'light', 1)]))).toBe(false);

    state = useConfiguracionStore.getState();
    expect(state.revision).toBe(3);
    expect(state.variables.tema.valor).toBe('dark');
  });

  it('elimina claves y conserva la revisión global monótona', () => {
    const store = useConfiguracionStore.getState();

    store.applyChanges(
      snapshot(1, [variable('a', 'A', 1), variable('b', 'B', 1)])
    );

    expect(
      store.applyChanges(snapshot(2, [variable('b', 'B2', 2)], ['a']))
    ).toBe(true);

    const state = useConfiguracionStore.getState();
    expect(state.revision).toBe(2);
    expect(state.variables.a).toBeUndefined();
    expect(state.variables.b.valor).toBe('B2');
  });

  it('no toca el estado ni notifica si no hay cambios', () => {
    const store = useConfiguracionStore.getState();
    store.applyChanges(snapshot(1, [variable('a', 'A', 1)]));

    const variablesBefore = useConfiguracionStore.getState().variables;

    expect(store.applyChanges(snapshot(1))).toBe(false);
    expect(store.applyChanges(snapshot(1, [variable('a', 'otro', 1)]))).toBe(false);

    expect(useConfiguracionStore.getState().variables).toBe(variablesBefore);
  });

  it('ignora snapshots inválidos sin lanzar', () => {
    const store = useConfiguracionStore.getState();

    expect(store.applyChanges(null)).toBe(false);
    expect(store.applyChanges(undefined)).toBe(false);
    expect(
      store.applyChanges({
        revisionActual: Number.NaN,
        variables: [],
        eliminadas: [],
      })
    ).toBe(false);
  });

  it('persiste de forma debounced y tolera QuotaExceeded', () => {
    vi.useFakeTimers();

    try {
      const store = useConfiguracionStore.getState();
      store.applyChanges(snapshot(1, [variable('a', 'A', 1)]));

      // Debounce: todavía no escribió.
      expect(localStorage.getItem(CONFIGURACION_STORAGE_KEY)).toBeNull();

      vi.advanceTimersByTime(500);

      const raw = localStorage.getItem(CONFIGURACION_STORAGE_KEY);
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw as string);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.revision).toBe(1);
      expect(parsed.variables.a.valor).toBe('A');

      const spy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new DOMException('quota', 'QuotaExceededError');
        });

      try {
        store.applyChanges(snapshot(2, [variable('a', 'B', 2)]));
        expect(() => flushConfiguracionPersistence()).not.toThrow();

        // El estado en memoria se conserva aunque falle el almacenamiento.
        expect(useConfiguracionStore.getState().variables.a.valor).toBe('B');
      } finally {
        spy.mockRestore();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('configuracionStore.hydrate', () => {
  beforeEach(() => {
    localStorage.clear();
    resetConfiguracionStoreForTests();
  });

  afterEach(() => {
    resetConfiguracionStoreForTests();
  });

  it('cache corrupta no rompe la hidratación y se limpia', () => {
    localStorage.setItem(CONFIGURACION_STORAGE_KEY, '{esto-no-es-json');

    expect(() => hydrateConfigStore(true)).not.toThrow();

    const state = useConfiguracionStore.getState();
    expect(state.variables).toEqual({});
    expect(state.revision).toBe(0);
    expect(localStorage.getItem(CONFIGURACION_STORAGE_KEY)).toBeNull();
  });

  it('versión de esquema desconocida se descarta', () => {
    localStorage.setItem(
      CONFIGURACION_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, revision: 5, variables: {} })
    );

    hydrateConfigStore(true);

    expect(useConfiguracionStore.getState().revision).toBe(0);
    expect(localStorage.getItem(CONFIGURACION_STORAGE_KEY)).toBeNull();
  });

  it('estructura inválida se descarta y conserva la app viva', () => {
    localStorage.setItem(
      CONFIGURACION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        revision: 5,
        variables: {
          ok: { valor: 1, tipoDato: 'number', revision: 1 },
          rota: { valor: 2, tipoDato: 'number', revision: 'x' },
        },
      })
    );

    hydrateConfigStore(true);

    const state = useConfiguracionStore.getState();
    expect(state.variables).toEqual({});
    expect(localStorage.getItem(CONFIGURACION_STORAGE_KEY)).toBeNull();
  });

  it('hidrata un cache válido', () => {
    localStorage.setItem(
      CONFIGURACION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        revision: 7,
        variables: {
          tema: { valor: 'dark', tipoDato: 'string', revision: 2 },
        },
      })
    );

    hydrateConfigStore(true);

    const state = useConfiguracionStore.getState();
    expect(state.revision).toBe(7);
    expect(state.variables.tema.valor).toBe('dark');
  });
});
