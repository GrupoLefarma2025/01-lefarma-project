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
// User-Agent, rate-limit de 1 req/s y cache hacia Nominatim (con Photon como
// refuerzo cuando no hay resultados).
const BASE = `${import.meta.env.VITE_API_URL || '/api'}/viaticos/geocodificar`;

/** Respuesta del resolvedor de ligas cortas de mapas. */
export interface RespuestaResolverLiga {
  success: boolean;
  message?: string;
  data?: string;
}

const BASE_LIGAS = `${import.meta.env.VITE_API_URL || '/api'}/viaticos/resolver-liga`;

/** URL del buscador global (texto libre) contra el proxy del backend. */
export function urlGeocodificarGlobal(texto: string, viewbox?: string): string {
  const params = new URLSearchParams({ tipo: 'global', texto });
  // Sesgo opcional hacia la ubicación del navegador ("Cerca de mí"): prioriza
  // resultados cercanos sin excluir el resto del país.
  if (viewbox) params.set('viewbox', viewbox);
  return `${BASE}?${params.toString()}`;
}

/** URL de la geocodificación inversa: coordenadas pegadas → dirección de referencia. */
export function urlGeocodificarReversa(latitud: number, longitud: number): string {
  const params = new URLSearchParams({ tipo: 'reversa', lat: String(latitud), lon: String(longitud) });
  return `${BASE}?${params.toString()}`;
}

/**
 * Geocodificación inversa de un punto del mapa: devuelve la dirección con su
 * estado/municipio conservando SIEMPRE las coordenadas del clic. `null` cuando
 * upstream no responde o no hay un nombre utilizable.
 */
export async function geocodificarReversa(latitud: number, longitud: number): Promise<PuntoSeleccion | null> {
  try {
    const respuesta = await fetch(urlGeocodificarReversa(latitud, longitud), { headers: { Accept: 'application/json' } });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const cuerpo = (await respuesta.json()) as RespuestaGeocodificar;
    const base = (cuerpo.data ?? []).find((punto) => Number.isFinite(punto.latitud) && Number.isFinite(punto.longitud));
    const nombre = base?.nombre.trim();
    if (!nombre || nombre === 'Punto sin nombre') return null;
    return {
      nombre,
      latitud,
      longitud,
      ...(base?.estado ? { estado: base.estado } : {}),
      ...(base?.municipio ? { municipio: base.municipio } : {}),
    };
  } catch {
    return null;
  }
}

/** URL del resolvedor de ligas cortas (el navegador no puede seguir sus redirecciones por CORS). */
export function urlResolverLiga(liga: string): string {
  const params = new URLSearchParams({ url: liga });
  return `${BASE_LIGAS}?${params.toString()}`;
}
