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

export function useConfig<T = unknown>(clave: string, defaultValue?: T): T | undefined {
  const valor = useConfiguracionStore((state) => state.variables[clave]?.valor);

  useEffect(() => {
    if (!clave) {
      return;
    }

    registerConfigKeys([clave]);

    const controller = new AbortController();
    void ensureConfig([clave], { force: true, signal: controller.signal });

    return () => controller.abort();
  }, [clave]);

  return (valor === undefined ? defaultValue : valor) as T | undefined;
}

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
