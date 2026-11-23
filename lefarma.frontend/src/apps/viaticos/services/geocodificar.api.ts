import type { PuntoSeleccion } from '../types/costosRuta.types';

export interface RespuestaGeocodificar {
  success: boolean;
  message?: string;
  data?: PuntoSeleccion[];
}

const BASE = `${import.meta.env.VITE_API_URL || '/api'}/viaticos/geocodificar`;

export interface RespuestaResolverLiga {
  success: boolean;
  message?: string;
  data?: string;
}

const BASE_LIGAS = `${import.meta.env.VITE_API_URL || '/api'}/viaticos/resolver-liga`;

export function urlGeocodificarGlobal(texto: string, viewbox?: string): string {
  const params = new URLSearchParams({ tipo: 'global', texto });
  if (viewbox) params.set('viewbox', viewbox);
  return `${BASE}?${params.toString()}`;
}

export function urlGeocodificarReversa(latitud: number, longitud: number): string {
  const params = new URLSearchParams({ tipo: 'reversa', lat: String(latitud), lon: String(longitud) });
  return `${BASE}?${params.toString()}`;
}

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

export function urlResolverLiga(liga: string): string {
  const params = new URLSearchParams({ url: liga });
  return `${BASE_LIGAS}?${params.toString()}`;
}
