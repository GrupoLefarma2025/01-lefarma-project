export interface CoordenadasPegadas {
  latitud: number;
  longitud: number;
}

export type EntradaPegada =
  | { tipo: 'coordenadas'; latitud: number; longitud: number }
  | { tipo: 'busqueda'; texto: string }
  | { tipo: 'liga-corta' };

const HOSTS_CORTOS = ['maps.app.goo.gl', 'goo.gl', 'g.co', 'osm.org'];

const RE_COORDENADAS = /^\s*(?:geo:)?\s*([+-]?\d{1,3}(?:\.\d+)?)\s*(?:,|\s+)\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/i;
const RE_GOOGLE_ARROBA = /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/;
const RE_GOOGLE_DATA = /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/;
const RE_OSM_HASH = /#map=[\d.]+\/(-?\d{1,3}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/;
const PARAMETROS_COORDENADAS = ['q', 'query', 'll', 'center', 'sll', 'daddr', 'destination'];

function comoCoordenadas(latitud: number, longitud: number): CoordenadasPegadas | null {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  if (Math.abs(latitud) > 90 || Math.abs(longitud) > 180) return null;
  return { latitud, longitud };
}

export function extraerCoordenadas(texto: string): CoordenadasPegadas | null {
  const coincidencia = RE_COORDENADAS.exec(texto);
  if (!coincidencia) return null;
  return comoCoordenadas(Number(coincidencia[1]), Number(coincidencia[2]));
}

function leerPar(crudo: string | null): CoordenadasPegadas | null {
  if (!crudo) return null;
  const coincidencia = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/.exec(crudo);
  if (!coincidencia) return null;
  return comoCoordenadas(Number(coincidencia[1]), Number(coincidencia[2]));
}

export function formatearCoordenadas(latitud: number, longitud: number): string {
  return `${latitud.toFixed(5)}, ${longitud.toFixed(5)}`;
}

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
    try {
      url = new URL(`https://${texto}`);
    } catch {
      return null;
    }
  }
  if (!url) return null;

  if (HOSTS_CORTOS.includes(url.hostname.toLowerCase())) return { tipo: 'liga-corta' };

  for (const re of [RE_GOOGLE_DATA, RE_GOOGLE_ARROBA]) {
    const coincidencia = re.exec(texto);
    if (!coincidencia) continue;
    const coordenadas = comoCoordenadas(Number(coincidencia[1]), Number(coincidencia[2]));
    if (coordenadas) return { tipo: 'coordenadas', ...coordenadas };
  }

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
    if (parametro === 'q' || parametro === 'query') return { tipo: 'busqueda', texto: valor };
  }

  return null;
}
