// Cliente del adapter publico de ClickBus (catalogo de lugares + busqueda de viajes).
// No requiere LLM: los datos salen de la API que usa la propia web de ClickBus.
import fs from 'node:fs/promises';
import path from 'node:path';

const ADAPTER = (process.env.CLICKBUS_ADAPTER || 'https://adapter.clickbus.com.mx/api').replace(/\/$/, '');
const TIEMPO_MAXIMO_MS = Number(process.env.CLICKBUS_TIMEOUT_MS || 25000);
const VIGENCIA_CATALOGO_MS = Number(process.env.CLICKBUS_CATALOGO_TTL_MS || 12 * 60 * 60 * 1000);
const DIR_CACHE = process.env.DIR_CACHE || '/data/cache';

const PALABRAS_IGNORADAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'en', 'a', 'al', 'para', 'por', 'con',
]);

let memoriaCatalogo = { momento: 0, lugares: null };

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensBusqueda(texto) {
  return normalizar(texto)
    .split(' ')
    .filter((token) => token.length > 1 && !PALABRAS_IGNORADAS.has(token));
}

async function pedirJson(url) {
  const respuesta = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent':
        process.env.USER_AGENT ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => '');
    throw new Error(`ClickBus respondio ${respuesta.status}: ${cuerpo.slice(0, 200)}`);
  }
  return respuesta.json();
}

/** Catalogo de lugares de ClickBus (cacheado en memoria y disco, 12 h por defecto). */
export async function lugares() {
  const ahora = Date.now();
  if (memoriaCatalogo.lugares && ahora - memoriaCatalogo.momento < VIGENCIA_CATALOGO_MS) {
    return memoriaCatalogo.lugares;
  }
  const rutaCache = path.join(DIR_CACHE, 'clickbus-places.json');
  try {
    const datos = await pedirJson(`${ADAPTER}/places/get-all`);
    const lista = Array.isArray(datos?.places) ? datos.places : Array.isArray(datos) ? datos : [];
    if (lista.length === 0) throw new Error('Catalogo de lugares vacio');
    memoriaCatalogo = { momento: ahora, lugares: lista };
    await fs.mkdir(DIR_CACHE, { recursive: true }).catch(() => {});
    await fs.writeFile(rutaCache, JSON.stringify({ momento: ahora, lugares: lista })).catch(() => {});
    return lista;
  } catch (error) {
    try {
      const crudo = JSON.parse(await fs.readFile(rutaCache, 'utf8'));
      if (Array.isArray(crudo?.lugares) && crudo.lugares.length > 0) {
        memoriaCatalogo = { momento: crudo.momento || 0, lugares: crudo.lugares };
        return crudo.lugares;
      }
    } catch {
      // sin cache disponible
    }
    throw error;
  }
}

const ALIAS = {
  cdmx: 'ciudad de mexico',
  df: 'ciudad de mexico',
  dgo: 'durango',
  ags: 'aguascalientes',
  qro: 'queretaro',
  mty: 'monterrey',
  gdl: 'guadalajara',
};

const REGEX_META = /[.*+?^${}()|[\]\\]/g;

function contienePalabra(texto, token) {
  if (!texto || !token) return false;
  return new RegExp(`(^|\\s)${String(token).replace(REGEX_META, '\\$&')}(?=\\s|$)`).test(texto);
}

export function expandirTokens(texto) {
  const tokens = [];
  for (const token of tokensBusqueda(texto)) {
    const alias = ALIAS[token];
    const partes = alias ? tokensBusqueda(alias) : [token];
    for (const parte of partes) {
      if (!tokens.includes(parte)) tokens.push(parte);
    }
  }
  return tokens;
}

export function puntuarLugar(lugar, tokens) {
  const nombre = normalizar(lugar.name || '');
  const ciudad = normalizar(lugar.city || '');
  const estado = normalizar(`${lugar.place?.state?.name || ''} ${lugar.place?.state?.code || ''}`);
  let puntaje = 0;
  let coincidencias = 0;
  for (const token of tokens) {
    if (ciudad === token) {
      puntaje += 5;
      coincidencias += 1;
    } else if (contienePalabra(ciudad, token)) {
      puntaje += 2;
      coincidencias += 1;
    } else if (contienePalabra(nombre, token)) {
      puntaje += 1.5;
      coincidencias += 1;
    } else if (contienePalabra(estado, token)) {
      puntaje += 1;
    }
  }
  if (coincidencias === 0) return 0;
  if (coincidencias === tokens.length) puntaje += 2;
  const ciudadSinDe = ciudad.replace(/\s+de\s+/g, ' ');
  if (ciudadSinDe && ciudadSinDe === tokens.join(' ')) puntaje += 6;
  const esGrupo =
    lugar.is_group === true || lugar.is_group === 'true' || /todas las terminales/i.test(lugar.terminal_type || '');
  if (esGrupo) puntaje += 2;
  if (lugar.is_primary === true || lugar.is_primary === 'true') puntaje += 0.5;
  return puntaje;
}

/** Busca un lugar por slug exacto del catalogo. */
export async function lugarPorSlug(slug) {
  if (!slug) return null;
  const lista = await lugares();
  return lista.find((lugar) => lugar.slug === slug) ?? null;
}

/**
 * Resuelve un texto libre ("Ciudad de Mexico", "Durango", "Victoria de Durango")
 * a un lugar del catalogo. Devuelve {lugar, sugerencias}.
 */
export async function resolverLugar(texto) {
  const lista = await lugares();
  const tokens = expandirTokens(texto);
  if (tokens.length === 0) return { lugar: null, sugerencias: lista.slice(0, 8) };
  const candidatos = [];
  for (const lugar of lista) {
    const puntaje = puntuarLugar(lugar, tokens);
    if (puntaje > 0) candidatos.push({ puntaje, lugar });
  }
  candidatos.sort((a, b) => b.puntaje - a.puntaje);
  const sugerencias = candidatos.slice(0, 8).map(({ lugar }) => ({
    slug: lugar.slug,
    nombre: lugar.name,
    tipo: lugar.terminal_type,
    ciudad: lugar.city,
  }));
  return { lugar: candidatos[0]?.lugar ?? null, sugerencias };
}

// --- Resolucion por coordenadas --------------------------------------------

const RADIO_DIRECTO_KM = Number(process.env.RADIO_DIRECTO_KM || 40);
const NOMINATIM = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ||
  'viaticos-capturas/1.0 (+https://capturas.app.grupolefarma.com.mx)';
const NOMINATIM_TIMEOUT_MS = Number(process.env.NOMINATIM_TIMEOUT_MS || 8000);

const cacheReverso = new Map();
let ultimaLlamadaNominatim = 0;

function coordenadasValidas(latitud, longitud) {
  return (
    Number.isFinite(latitud) &&
    Number.isFinite(longitud) &&
    Math.abs(latitud) <= 90 &&
    Math.abs(longitud) <= 180 &&
    !(latitud === 0 && longitud === 0)
  );
}

/** Distancia en kilometros entre dos puntos (haversine). */
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const radio = 6371;
  const radianes = (grados) => (grados * Math.PI) / 180;
  const dLat = radianes(lat2 - lat1);
  const dLon = radianes(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianes(lat1)) * Math.cos(radianes(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radio * Math.asin(Math.sqrt(a));
}

function esGrupoLugar(lugar) {
  return (
    lugar?.is_group === true ||
    lugar?.is_group === 'true' ||
    /todas las terminales/i.test(String(lugar?.terminal_type || ''))
  );
}

/**
 * Normaliza las formas en que el wizard puede mandar un punto:
 * {latitud,longitud}, {lat,lng}, {lat,lon}, [lat,lng] o "lat,lng".
 * Devuelve {latitud, longitud, nombre?, municipio?, estado?} o null.
 */
export function extraerCoordenadas(valor) {
  if (valor == null) return null;
  if (Array.isArray(valor)) {
    if (valor.length < 2) return null;
    const latitud = Number(valor[0]);
    const longitud = Number(valor[1]);
    return coordenadasValidas(latitud, longitud) ? { latitud, longitud } : null;
  }
  if (typeof valor === 'string') {
    const partes = valor.trim().split(/[,;\s]+/).filter(Boolean);
    if (partes.length !== 2) return null;
    const latitud = Number(partes[0]);
    const longitud = Number(partes[1]);
    return coordenadasValidas(latitud, longitud) ? { latitud, longitud } : null;
  }
  if (typeof valor === 'object') {
    const latitud = Number(valor.latitud ?? valor.lat ?? valor.latitude);
    const longitud = Number(valor.longitud ?? valor.lng ?? valor.lon ?? valor.longitude);
    if (!coordenadasValidas(latitud, longitud)) return null;
    const salida = { latitud, longitud };
    for (const [origen, destino] of [
      ['nombre', 'nombre'],
      ['texto', 'nombre'],
      ['etiqueta', 'nombre'],
      ['municipio', 'municipio'],
      ['estado', 'estado'],
    ]) {
      const dato = valor[origen];
      if (dato) salida[destino] = String(dato);
    }
    salida.nombre = salida.nombre || null;
    return salida;
  }
  return null;
}

/** Grupo "Todas las Terminales" de una ciudad, si el catalogo lo tiene. */
function grupoPorCiudad(lista, ciudad) {
  const buscada = normalizar(ciudad);
  if (!buscada) return null;
  return lista.find((lugar) => esGrupoLugar(lugar) && normalizar(lugar.city) === buscada) ?? null;
}

/** Geocodificacion inversa con Nominatim (cacheada y con 1 llamada/segundo). */
async function reversoNominatim(latitud, longitud) {
  const clave = `${latitud.toFixed(3)},${longitud.toFixed(3)}`;
  if (cacheReverso.has(clave)) return cacheReverso.get(clave);
  try {
    const espera = Math.max(0, 1100 - (Date.now() - ultimaLlamadaNominatim));
    if (espera > 0) await new Promise((listo) => setTimeout(listo, espera));
    ultimaLlamadaNominatim = Date.now();
    const respuesta = await fetch(
      `${NOMINATIM}/reverse?lat=${latitud}&lon=${longitud}&format=jsonv2&accept-language=es&zoom=10`,
      {
        headers: { accept: 'application/json', 'user-agent': NOMINATIM_UA },
        signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
      },
    );
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    const direccion = datos?.address || {};
    const resultado = {
      ciudad:
        String(
          direccion.city || direccion.town || direccion.village || direccion.municipality || direccion.county || '',
        ).trim() || null,
      municipio: String(direccion.county || direccion.municipality || '').trim() || null,
      estado: String(direccion.state || '').trim() || null,
      pais: String(direccion.country || '').trim() || null,
      codigo_pais: String(direccion.country_code || '').trim().toLowerCase() || null,
      display_name: String(datos?.display_name || '').trim() || null,
    };
    cacheReverso.set(clave, resultado);
    return resultado;
  } catch {
    return null;
  }
}

/** El estado del lugar del catalogo tiene que coincidir con el que devolvio Nominatim. */
function estadoCoincideConReverso(lugar, reverso) {
  const esperado = normalizar(reverso?.estado || '');
  const tokens = tokensBusqueda(esperado);
  if (tokens.length === 0) return true;
  const estadoLugar = normalizar(`${lugar?.place?.state?.name || ''} ${lugar?.place?.state?.code || ''}`);
  return tokens.every((token) => contienePalabra(estadoLugar, token));
}

/**
 * Resuelve un par de coordenadas a un lugar del catalogo de ClickBus.
 * 1) Busca el lugar con coordenadas mas cercano (radio directo, 40 km por defecto)
 *    y prefiere el grupo "Todas las Terminales" de esa ciudad.
 * 2) Si no hay terminales con coordenadas cerca (p. ej. Durango), hace
 *    geocodificacion inversa y resuelve por texto de ciudad.
 * 3) Como ultimo recurso usa la pista de texto que venga con las coordenadas.
 */
export async function lugarPorCoordenadas({ latitud, longitud, radioKm = RADIO_DIRECTO_KM, texto = null } = {}) {
  const lista = await lugares();
  const candidatos = [];
  for (const lugar of lista) {
    if (lugar.latitude == null || lugar.longitude == null) continue;
    const lat = Number(lugar.latitude);
    const lon = Number(lugar.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    candidatos.push({ lugar, km: distanciaKm(latitud, longitud, lat, lon) });
  }
  candidatos.sort((a, b) => a.km - b.km);
  const cercanos = candidatos.slice(0, 8);
  const sugerencias = cercanos.map(({ lugar, km }) => ({
    slug: lugar.slug,
    nombre: lugar.name,
    tipo: lugar.terminal_type,
    ciudad: lugar.city,
    km: Math.round(km * 10) / 10,
  }));
  const masCercano = cercanos[0] ?? null;

  if (masCercano && masCercano.km <= radioKm) {
    const grupo = grupoPorCiudad(lista, masCercano.lugar.city);
    return {
      lugar: grupo ?? masCercano.lugar,
      por: 'coordenadas',
      distancia_km: Math.round(masCercano.km * 10) / 10,
      sugerencias,
    };
  }

  const reverso = await reversoNominatim(latitud, longitud);
  const fueraDeMexico = Boolean(reverso?.codigo_pais && reverso.codigo_pais !== 'mx');
  if (reverso && !fueraDeMexico) {
    const textoCiudad = [reverso.ciudad, reverso.estado].filter(Boolean).join(' ');
    if (textoCiudad) {
      const resolucion = await resolverLugar(textoCiudad);
      if (resolucion.lugar && estadoCoincideConReverso(resolucion.lugar, reverso)) {
        return {
          lugar: resolucion.lugar,
          por: 'geocodificacion-inversa',
          texto_resuelto: textoCiudad,
          reverso,
          distancia_km: masCercano ? Math.round(masCercano.km * 10) / 10 : null,
          sugerencias: resolucion.sugerencias,
        };
      }
    }
  }

  if (texto) {
    const resolucion = await resolverLugar(texto);
    if (resolucion.lugar) {
      return {
        lugar: resolucion.lugar,
        por: 'texto',
        texto_resuelto: texto,
        distancia_km: masCercano ? Math.round(masCercano.km * 10) / 10 : null,
        sugerencias: resolucion.sugerencias,
      };
    }
  }

  return {
    lugar: null,
    por: null,
    distancia_km: masCercano ? Math.round(masCercano.km * 10) / 10 : null,
    sugerencias,
    reverso: reverso ?? null,
    fuera_de_mexico: fueraDeMexico,
  };
}

/** Busca viajes en el adapter de ClickBus. */
export async function buscarViajes({ desde, hasta, fecha, regreso = '' }) {
  const parametros = new URLSearchParams({
    from: desde,
    to: hasta,
    departure: fecha,
    currency: 'MXN',
    return: regreso || '',
  });
  const datos = await pedirJson(`${ADAPTER}/trips/search?${parametros.toString()}`);
  if (!datos?.success) {
    throw new Error('ClickBus no devolvio una busqueda exitosa');
  }
  return datos;
}

export function formatearDuracion(minutos) {
  if (!Number.isFinite(minutos) || minutos <= 0) return '';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 ? `${horas}h ${resto}m` : `${horas}h`;
}

// Zona horaria de la CDMX sin horario de verano desde 2022.
const OFFSET_CDMX = '-06:00';

function aIsoConZona(fecha, hora) {
  if (!fecha || !hora) return null;
  const [anio, mes, dia] = String(fecha).split('-');
  const [horaTexto, minutoTexto] = String(hora).split(':');
  return `${anio}-${mes}-${dia}T${horaTexto}:${minutoTexto}:00${OFFSET_CDMX}`;
}

/** Convierte la respuesta de ClickBus en opciones internas (todavia no el JSON del contrato). */
export function mapearOpciones(respuesta, { desde, hasta, fecha }) {
  const viajes = Array.isArray(respuesta?.trips?.going) ? respuesta.trips.going : [];
  const urlCompra = construirUrlCompra({ desde, hasta, fecha });
  const opciones = [];
  for (const viaje of viajes) {
    const parte = Array.isArray(viaje?.parts) ? viaje.parts[0] : null;
    if (!parte) continue;
    const salida = aIsoConZona(parte.departure?.waypoint?.schedule?.date, parte.departure?.waypoint?.schedule?.time);
    const llegada = aIsoConZona(parte.arrival?.waypoint?.schedule?.date, parte.arrival?.waypoint?.schedule?.time);
    if (!salida || !llegada) continue;
    const minutos = Math.round((new Date(llegada).getTime() - new Date(salida).getTime()) / 60000);
    const centavos = Number(parte.departure?.offer || parte.departure?.price || 0);
    opciones.push({
      transportista: parte.busCompany?.name || 'Sin nombre',
      clase_servicio: parte.bus?.serviceClass || parte.bus?.name || '',
      asientos_disponibles: Number(parte.availableSeats || 0) || null,
      trip_id: parte.trip_id || null,
      salida_iso: salida,
      llegada_iso: llegada,
      salida_hora: String(parte.departure?.waypoint?.schedule?.time || ''),
      llegada_hora: String(parte.arrival?.waypoint?.schedule?.time || ''),
      duracion_min: Number.isFinite(minutos) && minutos > 0 ? minutos : null,
      duracion_texto: formatearDuracion(minutos),
      precio: centavos > 0 ? centavos / 100 : null,
      moneda: parte.departure?.currency || 'MXN',
      origen_terminal: parte.departure?.waypoint?.place?.station?.current?.name || '',
      destino_terminal: parte.arrival?.waypoint?.place?.station?.current?.name || '',
      url_compra: urlCompra,
      ticket_aereo_no_aplica: true,
      regreso_iso: null,
    });
  }
  opciones.sort((a, b) => new Date(a.salida_iso) - new Date(b.salida_iso));
  return { opciones, urlCompra };
}

export function construirUrlCompra({ desde, hasta, fecha }) {
  const parametros = new URLSearchParams({
    departure_place: desde,
    arrival_place: hasta,
    departure_date: fecha,
    minPrice: '0',
    maxPrice: '5000',
  });
  return `https://www.clickbus.com.mx/trips?${parametros.toString()}`;
}
