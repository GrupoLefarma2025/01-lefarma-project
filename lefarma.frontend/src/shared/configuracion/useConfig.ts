import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfiguracionStore } from './configuracionStore';
import { ensureConfig, registerConfigKeys } from './configRuntime';
import type { ConfiguracionVariable } from './types';

export interface UseConfigStateResult<T = unknown> {
  valor: T | undefined;
  loading: boolean;
  error: unknown;
  revision: number | undefined;
  refresh: () => Promise<void>;
}

function toError(value: unknown): unknown {
  return value ?? new Error('No se pudo cargar la configuración');
}

/**
 * Hook de consumo puntual.
 *
 * - Registra la clave para sync/polling (aunque el componente se desmonte).
 * - Pide solo las claves faltantes; los hooks del mismo render se agrupan en
 *   un único lote por microtask.
 * - Selector por clave: solo re-renderiza cuando cambia ESA clave.
 * - Con cache devuelve el valor de inmediato y confirma en background.
 */
export function useConfig<T = unknown>(clave: string, defaultValue?: T): T | undefined {
  const valor = useConfiguracionStore((state) => state.variables[clave]?.valor);

  useEffect(() => {
    if (!clave) {
      return;
    }

    registerConfigKeys([clave]);

    // La entrada a una ruta confirma contra el servidor incluso si ya hay
    // cache. El valor cacheado se sigue mostrando de inmediato; la petición
    // se agrupa con las demás claves de la misma pantalla.
    const controller = new AbortController();
    void ensureConfig([clave], { force: true, signal: controller.signal });

    return () => controller.abort();
  }, [clave]);

  return (valor === undefined ? defaultValue : valor) as T | undefined;
}

/**
 * Variante con estado para pantallas que necesitan loading/error/revision.
 * `loading` solo es true cuando NO hay valor cacheado (nunca bloquea la UI).
 *
 * `loading` se deriva de `settledFor` en vez de hacer setState síncrono dentro
 * del efecto: un cambio de clave vuelve a mostrar loading sin renders en
 * cascada.
 */
export function useConfigState<T = unknown>(clave: string): UseConfigStateResult<T> {
  const variable = useConfiguracionStore(
    (state): ConfiguracionVariable | undefined => state.variables[clave]
  );

  const [settledFor, setSettledFor] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{
    clave: string;
    error: unknown;
  } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!clave) {
      return;
    }

    registerConfigKeys([clave]);

    let cancelled = false;
    const controller = new AbortController();

    // Al entrar a la ruta se confirma el valor vigente aunque exista cache.
    void ensureConfig([clave], { force: true, signal: controller.signal }).then((result) => {
      if (cancelled) {
        return;
      }
      setSettledFor(clave);
      setErrorState({
        clave,
        error: result.ok ? null : toError(result.error),
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [clave]);

  const refresh = useCallback(async () => {
    if (!clave) {
      return;
    }

    if (!useConfiguracionStore.getState().variables[clave]) {
      setSettledFor(null);
    }

    const result = await ensureConfig([clave], { force: true });

    if (!mountedRef.current) {
      return;
    }

    setSettledFor(clave);
    setErrorState({
      clave,
      error: result.ok ? null : toError(result.error),
    });
  }, [clave]);

  const hasValue = variable !== undefined && variable.valor !== undefined;

  return {
    valor: variable?.valor as T | undefined,
    loading: Boolean(clave) && !hasValue && settledFor !== clave,
    error: errorState?.clave === clave ? errorState.error : null,
    revision: variable?.revision,
    refresh,
  };
}
