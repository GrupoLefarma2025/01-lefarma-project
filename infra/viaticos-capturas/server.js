// viaticos-capturas: servicio HTTP para capturas de pantalla y cotizaciones
// de autobuses (ClickBus) que alimenta la tabla del wizard de viaticos.
import express from 'express';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { capturar, calentarNavegador, cerrarNavegador, estadoNavegador } from './lib/captura.js';
import { validarUrl, errorHttp } from './lib/seguridad.js';
import { resolverLugar, lugarPorCoordenadas, extraerCoordenadas } from './lib/clickbus.js';
import { guardarPng, rutaSeguraCaptura, urlCaptura, DIR_CAPTURAS } from './lib/almacen.js';
import { cotizar } from './lib/cotizacion.js';
import { agenticoHabilitado, capturarConAgente, buscarConAgente, modelosAgente } from './lib/agentico.js';

const PUERTO = Number(process.env.PORT || 8099);
const API_KEY = process.env.API_KEY || '';
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PUERTO}`).replace(/\/+$/, '');
const VERSION = '1.0.0';

if (!API_KEY) {
  console.warn('[viaticos-capturas] API_KEY vacia: la API queda abierta (usar solo detras de Traefik).');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.use((req, res, siguiente) => {
  const inicio = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`);
  });
  siguiente();
});

function requiereApiKey(req, res, siguiente) {
  if (!API_KEY) return siguiente();
  const recibida = String(req.get('x-api-key') || '');
  const esperada = Buffer.from(API_KEY);
  const actual = Buffer.from(recibida);
  if (actual.length !== esperada.length || !crypto.timingSafeEqual(actual, esperada)) {
    return res.status(401).json({ ok: false, error: 'API key invalida o ausente (header x-api-key)' });
  }
  return siguiente();
}

function urlPublicaCaptura(archivo) {
  return urlCaptura(BASE_URL, archivo);
}

function datosCaptura(resultado, guardado) {
  return {
    archivo: guardado.archivo,
    url: urlPublicaCaptura(guardado.archivo),
    bytes: guardado.bytes,
    ancho: resultado.ancho,
    alto: resultado.alto,
    ms: resultado.ms,
    titulo: resultado.titulo,
    advertencias: resultado.advertencias,
    errores: resultado.errores,
  };
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    servicio: 'viaticos-capturas',
    version: VERSION,
    hora: new Date().toISOString(),
    navegador: estadoNavegador(),
    agentico: { habilitado: agenticoHabilitado(), modelos: modelosAgente() },
    dir_capturas: DIR_CAPTURAS,
    base_url: BASE_URL,
  });
});

// --- Capturas -------------------------------------------------------------

app.post('/v1/capturar', requiereApiKey, async (req, res) => {
  const { url, nombre, esperar_texto, selector, esperar_ms, full_page, ancho, alto, quitar } = req.body || {};
  const validada = await validarUrl(url);
  const resultado = await capturar({
    url: validada.toString(),
    esperar_texto: esperar_texto || null,
    selector: selector || null,
    esperar_ms,
    full_page,
    ancho,
    alto,
    quitar,
  });
  const guardado = await guardarPng(resultado.png, nombre || `captura-${new URL(validada).hostname}`);
  res.json({ ok: true, ...datosCaptura(resultado, guardado) });
});

app.post('/v1/capturas', requiereApiKey, async (req, res) => {
  const { urls, esperar_texto, esperar_ms, full_page } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > 10) {
    throw errorHttp(400, 'urls debe ser un arreglo de 1 a 10 elementos');
  }
  const tareas = urls.map(async (elemento, indice) => {
    const crudo = typeof elemento === 'string' ? { url: elemento } : elemento || {};
    try {
      const validada = await validarUrl(crudo.url);
      const resultado = await capturar({
        url: validada.toString(),
        esperar_texto: crudo.esperar_texto || esperar_texto || null,
        selector: crudo.selector || null,
        esperar_ms: crudo.esperar_ms ?? esperar_ms,
        full_page: crudo.full_page ?? full_page,
        ancho: crudo.ancho,
        alto: crudo.alto,
        quitar: crudo.quitar,
      });
      const guardado = await guardarPng(resultado.png, crudo.nombre || `captura-${indice + 1}`);
      return { ok: true, ...datosCaptura(resultado, guardado) };
    } catch (error) {
      return { ok: false, url: crudo.url || null, error: error.message };
    }
  });
  const resultados = await Promise.all(tareas);
  res.json({ ok: resultados.every((resultado) => resultado.ok), resultados });
});

// --- Cotizacion -----------------------------------------------------------

app.post('/v1/cotizar', requiereApiKey, async (req, res) => {
  const {
    origen,
    destino,
    origen_slug,
    destino_slug,
    origen_lat,
    origen_lng,
    destino_lat,
    destino_lng,
    fecha_salida,
    fecha_regreso,
    personas,
    con_capturas,
  } = req.body || {};
  const { cotizacion, detalle } = await cotizar({
    origen: origen ?? null,
    destino: destino ?? null,
    origen_slug: origen_slug || null,
    destino_slug: destino_slug || null,
    origen_lat: origen_lat ?? null,
    origen_lng: origen_lng ?? null,
    destino_lat: destino_lat ?? null,
    destino_lng: destino_lng ?? null,
    fecha_salida,
    fecha_regreso: fecha_regreso || null,
    personas: personas ?? 1,
    con_capturas: con_capturas !== false,
    base_url: BASE_URL,
  });
  if (String(req.query.detalle || '') === '1') {
    return res.json({ ok: true, cotizacion, detalle });
  }
  return res.json(cotizacion);
});

app.get('/v1/lugares', requiereApiKey, async (req, res) => {
  const consulta = String(req.query.q || '').trim();
  // Las coordenadas pueden venir como lat/lng, latitud/longitud o como "lat,lng" en q.
  const coordenadas =
    extraerCoordenadas({
      latitud: req.query.lat ?? req.query.latitud,
      longitud: req.query.lng ?? req.query.lon ?? req.query.longitud,
    }) || extraerCoordenadas(consulta);
  if (coordenadas) {
    const resultado = await lugarPorCoordenadas({
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
    });
    return res.json({
      ok: true,
      q: consulta || null,
      coordenadas: { latitud: coordenadas.latitud, longitud: coordenadas.longitud },
      lugar: resultado.lugar,
      sugerencias: resultado.sugerencias,
      resuelto_por: resultado.por,
      distancia_km: resultado.distancia_km ?? null,
      texto_resuelto: resultado.texto_resuelto ?? null,
      reverso: resultado.reverso ?? null,
      fuera_de_mexico: resultado.fuera_de_mexico === true,
    });
  }
  if (!consulta) throw errorHttp(400, 'Falta el parametro q, o las coordenadas lat/lng');
  const { lugar, sugerencias } = await resolverLugar(consulta);
  res.json({ ok: true, q: consulta, lugar, sugerencias });
});

// --- Modo agentico (opcional) --------------------------------------------

app.post('/v1/agentico/capturar', requiereApiKey, async (req, res) => {
  const { url, instruccion, nombre } = req.body || {};
  const validada = await validarUrl(url);
  const resultado = await capturarConAgente({
    url: validada.toString(),
    instruccion: instruccion || '',
    nombre: nombre || 'agentico',
  });
  res.json({
    ok: true,
    archivo: resultado.archivo,
    url: urlPublicaCaptura(resultado.archivo),
    bytes: resultado.bytes,
    modelo: resultado.modelo,
    agente: 'opencode+playwright-mcp',
  });
});

// Busqueda agentica: navega, extrae los datos del viaje y guarda la captura en
// la misma corrida. Con fallback de modelos gratis (OPENCODE_MODELS).
app.post('/v1/agentico/buscar', requiereApiKey, async (req, res) => {
  const { url, instruccion, nombre, esperar_texto, campos, contexto } = req.body || {};
  const validada = await validarUrl(url);
  const resultado = await buscarConAgente({
    url: validada.toString(),
    instruccion: instruccion || '',
    nombre: nombre || 'informacion',
    esperar_texto: esperar_texto || '',
    campos: Array.isArray(campos) ? campos.map((campo) => String(campo)) : [],
    contexto: typeof contexto === 'string' ? contexto : '',
  });
  res.json({
    ok: true,
    archivo: resultado.archivo,
    url: urlPublicaCaptura(resultado.archivo),
    bytes: resultado.bytes,
    datos: resultado.datos,
    modelo: resultado.modelo,
    advertencia: resultado.advertencia,
    agente: 'opencode+playwright-mcp',
  });
});

// --- Archivos -------------------------------------------------------------

app.get('/c/:archivo', async (req, res, siguiente) => {
  const ruta = rutaSeguraCaptura(req.params.archivo);
  if (!ruta) return siguiente(errorHttp(404, 'Captura no encontrada'));
  try {
    const info = await fs.stat(ruta);
    if (!info.isFile()) return siguiente(errorHttp(404, 'Captura no encontrada'));
  } catch {
    return siguiente(errorHttp(404, 'Captura no encontrada'));
  }
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.sendFile(ruta);
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

app.use((error, req, res, siguiente) => {
  if (res.headersSent) return siguiente(error);
  const estado = Number(error.status) || 500;
  if (estado >= 500) console.error('[viaticos-capturas] error:', error);
  const cuerpo = { ok: false, error: error.message || 'Error interno' };
  if (error.extra) cuerpo.detalle = error.extra;
  return res.status(estado).json(cuerpo);
});

const servidor = app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`[viaticos-capturas] escuchando en :${PUERTO} (base ${BASE_URL})`);
  calentarNavegador().then((listo) => {
    console.log(`[viaticos-capturas] Chromium ${listo ? 'listo' : 'no disponible'}`);
  });
});

async function apagar(senal) {
  console.log(`[viaticos-capturas] recibida senal ${senal}, cerrando...`);
  servidor.close(async () => {
    await cerrarNavegador();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
