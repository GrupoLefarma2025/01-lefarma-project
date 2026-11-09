import { ensureConfig, syncNow } from './configRuntime';
import { useConfiguracionStore } from './configuracionStore';

/**
 * API de sólo lectura para inspeccionar la configuración desde la consola del
 * navegador. Usa exactamente el mismo store que `useConfig`; nunca consulta
 * variables backend-only.
 */
export interface LefarmaConfigConsoleApi {
  /** Valor actualmente cacheado. No hace peticiones. */
  get<T = unknown>(clave: string): T | undefined;
  /** Fuerza una consulta al servidor y devuelve el valor actualizado. */
  getAsync<T = unknown>(clave: string): Promise<T | undefined>;
  /** Todas las variables frontend cacheadas, indexadas por clave. */
  getAll(): Record<string, unknown>;
  /** Claves disponibles en la caché local. */
  keys(): string[];
  /** Revisión global aplicada por última vez. */
  revision(): number;
  /** Fuerza una sincronización incremental. */
  sync(): Promise<void>;
  help(): void;
}

declare global {
  interface Window {
    lefarmaConfig?: LefarmaConfigConsoleApi;
  }
}

function leer<T>(clave: string): T | undefined {
  return useConfiguracionStore.getState().variables[clave]?.valor as T | undefined;
}

function instalar(): LefarmaConfigConsoleApi {
  const api: LefarmaConfigConsoleApi = {
    get: (clave) => leer(clave),

    getAsync: async (clave) => {
      await ensureConfig([clave], { force: true, throwOnError: true });
      return leer(clave);
    },

    getAll: () => {
      const { variables } = useConfiguracionStore.getState();
      return Object.fromEntries(
        Object.entries(variables).map(([clave, variable]) => [clave, variable.valor]),
      );
    },

    keys: () => Object.keys(useConfiguracionStore.getState().variables).sort(),

    revision: () => useConfiguracionStore.getState().revision,

    sync: async () => {
      await syncNow({ throwOnError: true });
    },

    help: () => {
      console.info(
        [
          'Lefarma Configuración — API de consola',
          '  lefarmaConfig.get("modulo.clave")        valor en caché',
          '  await lefarmaConfig.getAsync("modulo.clave")  consulta al servidor',
          '  lefarmaConfig.getAll()                  todas las variables frontend',
          '  lefarmaConfig.keys()                    claves disponibles',
          '  lefarmaConfig.revision()                revisión actual',
          '  await lefarmaConfig.sync()              fuerza sincronización',
        ].join('\n'),
      );
    },
  };

  window.lefarmaConfig = api;
  return api;
}

export function installLefarmaConfigConsole(): LefarmaConfigConsoleApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.lefarmaConfig ?? instalar();
}
