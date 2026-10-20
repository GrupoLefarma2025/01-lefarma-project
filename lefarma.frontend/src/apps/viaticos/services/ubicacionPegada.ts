/**
 * Interpreta lo que se pega o escribe en el buscador de direcciones: pares de
 * coordenadas ("19.4326, -99.1332"), ligas de mapas con las coordenadas
 * embebidas (Google Maps, OpenStreetMap, Apple Maps) y ligas cortas
 * (maps.app.goo.gl, goo.gl, g.co, osm.org) que el navegador no puede seguir
 * por CORS y resuelve el backend (api/viaticos/resolver-liga).
 */
export interface CoordenadasPegadas {
  latitud: number;
  longitud: number;
}

/** Entrada detectada en el buscador, distinta de una búsqueda de texto normal. */
export type EntradaPegada =
  | { tipo: 'coordenadas'; latitud: number; longitud: number }
  | { tipo: 'busqueda'; texto: string }
  | { tipo: 'liga-corta' };

/** Hosts de ligas cortas de mapas: deben coincidir con la lista blanca del backend. */
const HOSTS_CORTOS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'osm.org'];

const RE_COORDENADAS = /^\s*(?:geo:)?\s*([+-]?\d{1,3}(?:\.\d+)?)\s*(?:,|\s+)\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/i;
/** Centro del mapa en una liga de Google (/@19.39,-99.12,17z). */
const RE_GOOGLE_ARROBA = /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/;
/** Punto exacto del lugar en el bloque data= (!3d19.39!4d-99.12). */
const RE_GOOGLE_DATA = /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/;
/** OpenStreetMap: #map=zoom/lat/lng. */
const RE_OSM_HASH = /#map=[\d.]+\/(-?\d{1,3}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/;
/** Parámetros habituales de las ligas de mapas que llevan coordenadas. */
const PARAMETROS_COORDENADAS = ['q', 'query', 'll', 'center', 'sll', 'daddr', 'destination'];

function comoCoordenadas(latitud: number, longitud: number): CoordenadasPegadas | null {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  if (Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
  return { latitud, longitud };
}

/** Extrae un par de coordenadas de un texto que es exactamente eso. */
export function extraerCoordenadas(texto: string): CoordenadasPegadas | null {
  const coincidencia = RE_COORDENADAS.exec(texto);
  if (!coincidencia) return null;
  return comoCoordenadas(Number(coincidencia[1]), Number(coincidencia[2]));
}

/** Extrae el primer par "lat,lng" dentro de un valor de parámetro de liga. */
function leerPar(crudo: string | null): CoordenadasPegadas | null {
  if (!crudo) return null;
  const coincidencia = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/.exec(crudo);
  if (!coincidencia) return null;
  return comoCoordenadas(Number(coincidencia[1]), Number(coincidencia[2]));
}

/** Formato estable para el recuadro del buscador ("19.39050, -99.12130"). */
export function formatearCoordenadas(latitud: number, longitud: number): string {
  return `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;
}

/** Interpreta una liga de mapas, una liga corta o coordenadas pegadas. */
export function interpretarEntradaPegada(crudo: string): EntradaPegada | null {
  const texto = crudo.trim();

  const directas = extraerCoordenadas(texto);
  if (directas) return { tipo: 'coordenadas', ...directas };

  let url: URL | null = null;
  if (/^https?:\/\//i.test(texto)) {
    try {
      url = new URL(texto);
    } catch {
      return null;
    }
  } else if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(texto)) {
    // Pegada sin esquema (p. ej. "maps.app.goo.gl/AbC123"): se completa a https.
    try {
      url = new URL(`https://${texto}`);
    } catch {
      return null;
    }
  }
  if (!url) return null;

  if (HOSTS_CORTOS.includes(url.hostname.toLowerCase())) return { tipo: 'liga-corta' };

  // Google Maps: primero el punto exacto del lugar (!3d..!4d..) y luego el
  // centro del mapa (@lat,lng), que suele coincidir.
  for (const re of [RE_GOOGLE_DATA, RE_GOOGLE_ARROBA]) {
    const coincidencia = re.exec(texto);
    if (!coincidencia) continue;
    const coordenadas = comoCoordenadas(Number(coincidencia[1]), Number(coincidencia[2]));
    if (coordenadas) return { tipo: 'coordenadas', ...coordenadas };
  }

  // OpenStreetMap: #map=zoom/lat/lng y los parámetros mlat/mlon.
  const mapa = RE_OSM_HASH.exec(texto);
  if (mapa) {
    const coordenadas = comoCoordenadas(Number(mapa[1]), Number(mapa[2]));
    if (coordenadas) return { tipo: 'coordenadas', ...coordenadas };
  }
  const mlat = url.searchParams.get('mlat');
  const mlon = url.searchParams.get('mlon');
  if (mlat && mlon) {
    const coordenadas = comoCoordenadas(Number(mlat), Number(mlon));
    if (coordenadas) return { tipo: 'coordenadas', ...coordenadas };
  }

  for (const parametro of PARAMETROS_COORDENADAS) {
    const valor = url.searchParams.get(parametro);
    if (!valor) continue;
    const coordenadas = leerPar(valor);
    if (coordenadas) return { tipo: 'coordenadas', ...coordenadas };
    // q/query también pueden traer el nombre del lugar ("...?q=Hospital+Xoco").
    if (parametro === 'q' || parametro === 'query') return { tipo: 'busqueda', texto: valor };
  }

  return null;
}
