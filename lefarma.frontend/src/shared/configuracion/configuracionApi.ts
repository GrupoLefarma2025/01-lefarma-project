import { API } from '@/shared/api/apiClient';
import type {
  ConfiguracionApiResponse,
  ConfiguracionConsultaRequest,
  ConfiguracionConsultaVariable,
  ConfiguracionSnapshot,
  ConfiguracionSyncRequest,
} from './types';
import { CONFIGURACION_REQUEST_TIMEOUT_MS } from './types';

export interface ConfiguracionRequestOptions {
  signal?: AbortSignal;
}

const CONSULTAR_PATH = '/configuracion/frontend/consultar';
const SYNC_PATH = '/configuracion/frontend/sync';

function createAbortError(): Error {
  const error = new Error('REQUEST_CANCELED');
  error.name = 'AbortError';
  return error;
}

async function postConfiguracion<TBody>(
  path: string,
  body: TBody,
  externalSignal?: AbortSignal
): Promise<ConfiguracionSnapshot> {
  if (externalSignal?.aborted) {
    throw createAbortError();
  }

  const controller = new AbortController();
  let timedOut = false;

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CONFIGURACION_REQUEST_TIMEOUT_MS);

  const handleExternalAbort = () => controller.abort();

  externalSignal?.addEventListener('abort', handleExternalAbort, { once: true });

  try {
    const response = await API.post<ConfiguracionApiResponse>(path, body, {
      signal: controller.signal,
      timeout: CONFIGURACION_REQUEST_TIMEOUT_MS,
    });

    const payload = response.data;
    if (!payload || payload.success === false || !payload.data) {
      throw new Error(payload?.message || 'Respuesta inválida del servidor de configuración');
    }

    return payload.data;
  } catch (error) {
    if (timedOut) {
      throw new Error('Tiempo de espera agotado al consultar la configuración');
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
    externalSignal?.removeEventListener('abort', handleExternalAbort);
  }
}

export const configuracionApi = {
  consultar: (
    variables: ConfiguracionConsultaVariable[],
    options?: ConfiguracionRequestOptions
  ): Promise<ConfiguracionSnapshot> => {
    const body: ConfiguracionConsultaRequest = { variables };
    return postConfiguracion(CONSULTAR_PATH, body, options?.signal);
  },

  sync: (
    desde: number,
    claves: string[],
    options?: ConfiguracionRequestOptions
  ): Promise<ConfiguracionSnapshot> => {
    const body: ConfiguracionSyncRequest = { desde, claves };
    return postConfiguracion(SYNC_PATH, body, options?.signal);
  },
};
