/**
 * Cliente HTTP del panel de telemetría. Todos los endpoints son de solo
 * lectura y viven bajo `/telemetria` (el interceptor de apiClient ya excluye
 * esa ruta del reporte de errores para no crear un bucle).
 */

import type { AxiosResponse } from 'axios';
import apiClient from '@/shared/api/apiClient';
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

const BASE = '/telemetria';

function desenvolver<T>(respuesta: AxiosResponse<ApiResponse<T>>): T {
  const cuerpo = respuesta.data;
  if (!cuerpo || typeof cuerpo !== 'object' || !('success' in cuerpo)) {
    return cuerpo as unknown as T;
  }
  if (!cuerpo.success) {
    const error: ApiError = {
      message: cuerpo.message || 'La consulta no se completó.',
      errors: cuerpo.errors,
      statusCode: 400,
    };
    throw error;
  }
  return cuerpo.data;
}

function paramsDeFechas(desde?: Date, hasta?: Date): Record<string, string> {
  const params: Record<string, string> = {};
  if (desde) params.desde = desde.toISOString();
  if (hasta) params.hasta = hasta.toISOString();
  return params;
}

export const telemetriaApi = {
  resumen: async (desde: Date, hasta: Date): Promise<ResumenTelemetria> =>
    desenvolver(
      await apiClient.get<ApiResponse<ResumenTelemetria>>(`${BASE}/resumen`, {
        params: paramsDeFechas(desde, hasta),
      }),
    ),

  errores: async (desde: Date, hasta: Date, texto?: string): Promise<HuellaErrorResumen[]> =>
    desenvolver(
      await apiClient.get<ApiResponse<HuellaErrorResumen[]>>(`${BASE}/errores-navegador`, {
        params: { ...paramsDeFechas(desde, hasta), ...(texto?.trim() ? { texto: texto.trim() } : {}) },
      }),
    ),

  ocurrencias: async (
    huella: string,
    pagina = 1,
    tamano = 20,
  ): Promise<OcurrenciaError[]> =>
    desenvolver(
      await apiClient.get<ApiResponse<OcurrenciaError[]>>(
        `${BASE}/errores-navegador/${encodeURIComponent(huella)}/ocurrencias`,
        { params: { pagina, tamano } },
      ),
    ),

  botones: async (desde: Date, hasta: Date, ruta?: string): Promise<BotonResumen[]> =>
    desenvolver(
      await apiClient.get<ApiResponse<BotonResumen[]>>(`${BASE}/botones`, {
        params: { ...paramsDeFechas(desde, hasta), ...(ruta?.trim() ? { ruta: ruta.trim() } : {}) },
      }),
    ),

  mapaCalor: async (
    ruta: string,
    desde: Date,
    hasta: Date,
    viewportAncho?: number,
  ): Promise<MapaCalorResumen> =>
    desenvolver(
      await apiClient.get<ApiResponse<MapaCalorResumen>>(`${BASE}/mapa-calor`, {
        params: {
          ruta,
          ...paramsDeFechas(desde, hasta),
          ...(viewportAncho ? { viewportAncho } : {}),
        },
      }),
    ),

  rutas: async (desde: Date, hasta: Date): Promise<RutaResumen[]> =>
    desenvolver(
      await apiClient.get<ApiResponse<RutaResumen[]>>(`${BASE}/rutas`, {
        params: paramsDeFechas(desde, hasta),
      }),
    ),

  erroresServidor: async (opciones: {
    desde: Date;
    hasta: Date;
    severidad?: string;
    texto?: string;
    pagina?: number;
    tamano?: number;
  }): Promise<PaginaErrorServidor> =>
    desenvolver(
      await apiClient.get<ApiResponse<PaginaErrorServidor>>(`${BASE}/errores-servidor`, {
        params: {
          ...paramsDeFechas(opciones.desde, opciones.hasta),
          ...(opciones.severidad ? { severidad: opciones.severidad } : {}),
          ...(opciones.texto?.trim() ? { texto: opciones.texto.trim() } : {}),
          ...(opciones.pagina ? { pagina: opciones.pagina } : {}),
          ...(opciones.tamano ? { tamano: opciones.tamano } : {}),
        },
      }),
    ),

  estado: async (): Promise<EstadoTelemetria> =>
    desenvolver(await apiClient.get<ApiResponse<EstadoTelemetria>>(`${BASE}/estado`)),
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
