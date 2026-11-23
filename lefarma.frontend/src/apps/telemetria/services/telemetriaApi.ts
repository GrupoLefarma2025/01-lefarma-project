import type { ApiError, ApiResponse } from '@/types/api.types';
import type {
  BotonResumen,
  ErrorServidorResumen,
  EstadoTelemetria,
  HuellaErrorResumen,
  MapaCalorResumen,
  OcurrenciaError,
  PaginaErrorServidor,
  ResumenTelemetria,
  RutaResumen,
} from '../types';

const BASE_URL = '/api/telemetria';
const ESPERA_MAXIMA_MS = 12_000;

function construirUrl(ruta: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(`${BASE_URL}${ruta}`, window.location.origin);
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') url.searchParams.set(clave, String(valor));
  }
  return url.toString();
}

async function pedir<T>(
  ruta: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = construirUrl(ruta, params);
  const control = new AbortController();
  const temporizador = window.setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);

  try {
    const token = localStorage.getItem('accessToken');
    const respuesta = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: control.signal,
    });
    const crudo = await respuesta.text();

    if (!respuesta.ok) {
      throw {
        message: `El servidor respondió ${respuesta.status}.`,
        statusCode: respuesta.status,
      } satisfies ApiError;
    }

    const cuerpo = JSON.parse(crudo) as ApiResponse<T>;
    if (!cuerpo || typeof cuerpo !== 'object' || !('success' in cuerpo)) {
      throw {
        message: 'La respuesta del servidor no tiene el formato esperado.',
        statusCode: respuesta.status,
      } satisfies ApiError;
    }
    if (!cuerpo.success) {
      throw {
        message: cuerpo.message || 'La consulta no se completó.',
        errors: cuerpo.errors,
        statusCode: respuesta.status,
      } satisfies ApiError;
    }
    if (cuerpo.data == null) {
      throw {
        message: 'El servidor respondió sin datos para el periodo seleccionado.',
        statusCode: respuesta.status,
      } satisfies ApiError;
    }
    return cuerpo.data;
  } catch (error) {
    const motivo =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'La petición tardó demasiado (12 s).'
        : error instanceof TypeError
          ? `No se pudo conectar con el servidor (${error.message}).`
          : error instanceof Error
            ? error.message
            : ((error as ApiError)?.message ?? 'Error desconocido.');
    throw { message: motivo, statusCode: 0 } satisfies ApiError;
  } finally {
    window.clearTimeout(temporizador);
  }
}

function paramsDeFechas(desde?: Date, hasta?: Date): Record<string, string> {
  const params: Record<string, string> = {};
  if (desde) params.desde = desde.toISOString();
  if (hasta) params.hasta = hasta.toISOString();
  return params;
}

export const telemetriaApi = {
  resumen: (desde: Date, hasta: Date): Promise<ResumenTelemetria> =>
    pedir('/resumen', paramsDeFechas(desde, hasta)),

  errores: (desde: Date, hasta: Date, texto?: string): Promise<HuellaErrorResumen[]> =>
    pedir('/errores-navegador', {
      ...paramsDeFechas(desde, hasta),
      ...(texto?.trim() ? { texto: texto.trim() } : {}),
    }),

  ocurrencias: (huella: string, pagina = 1, tamano = 20): Promise<OcurrenciaError[]> =>
    pedir(`/errores-navegador/${encodeURIComponent(huella)}/ocurrencias`, { pagina, tamano }),

  botones: (desde: Date, hasta: Date, ruta?: string): Promise<BotonResumen[]> =>
    pedir('/botones', {
      ...paramsDeFechas(desde, hasta),
      ...(ruta?.trim() ? { ruta: ruta.trim() } : {}),
    }),

  mapaCalor: (
    ruta: string,
    desde: Date,
    hasta: Date,
    viewportAncho?: number,
  ): Promise<MapaCalorResumen> =>
    pedir('/mapa-calor', {
      ruta,
      ...paramsDeFechas(desde, hasta),
      ...(viewportAncho ? { viewportAncho } : {}),
    }),

  rutas: (desde: Date, hasta: Date): Promise<RutaResumen[]> =>
    pedir('/rutas', paramsDeFechas(desde, hasta)),

  erroresServidor: (opciones: {
    desde: Date;
    hasta: Date;
    severidad?: string;
    texto?: string;
    pagina?: number;
    tamano?: number;
  }): Promise<PaginaErrorServidor> =>
    pedir('/errores-servidor', {
      ...paramsDeFechas(opciones.desde, opciones.hasta),
      ...(opciones.severidad ? { severidad: opciones.severidad } : {}),
      ...(opciones.texto?.trim() ? { texto: opciones.texto.trim() } : {}),
      ...(opciones.pagina ? { pagina: opciones.pagina } : {}),
      ...(opciones.tamano ? { tamano: opciones.tamano } : {}),
    }),

  estado: (): Promise<EstadoTelemetria> => pedir('/estado'),
};

export type {
  BotonResumen,
  ErrorServidorResumen,
  EstadoTelemetria,
  HuellaErrorResumen,
  MapaCalorResumen,
  OcurrenciaError,
  PaginaErrorServidor,
  ResumenTelemetria,
  RutaResumen,
};
