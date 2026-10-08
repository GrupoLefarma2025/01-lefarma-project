import type { PuntoSeleccion } from '../types/costosRuta.types';

/** Respuesta del proxy backend (mismo envelope ApiResponse<T> del API). */
export interface RespuestaGeocodificar {
  success: boolean;
  message?: string;
  data?: PuntoSeleccion[];
}

// Proxy backend: la política de OSM
// (https://operations.osmfoundation.org/policies/nominatim/) prohíbe el
// autocompletado desde el navegador; api/viaticos/geocodificar aplica
// User-Agent, rate-limit de 1 req/s y cache hacia Nominatim.
const BASE = `${import.meta.env.VITE_API_URL || '/api'}/viaticos/geocodificar`;

/** URL del buscador global (texto libre) contra el proxy del backend. */
export function urlGeocodificarGlobal(texto: string): string {
  const params = new URLSearchParams({ tipo: 'global', texto });
  return `${BASE}?${params.toString()}`;
}

/** URL del buscador cascada (estado, municipio y calle) contra el proxy del backend. */
export function urlGeocodificarCascada(estado: string, municipio: string, texto: string): string {
  const params = new URLSearchParams({ tipo: 'cascada', estado, municipio, texto });
  return `${BASE}?${params.toString()}`;
}
