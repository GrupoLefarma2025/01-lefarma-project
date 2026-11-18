#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const DOCS_ROOT = path.resolve(FRONTEND_ROOT, '..', 'lefarma.docs', 'viaticos', 'pruebas');
const DEFAULT_JSON = path.join(DOCS_ROOT, 'links-viaticos.json');
const DEFAULT_MD = path.join(DOCS_ROOT, 'links-viaticos.md');
const EVIDENCIAS = path.join(DOCS_ROOT, 'evidencias');

const BANNED_CAPTURE = new Set(['booking_ciudad', 'booking_hotel', 'expedia_hoteles', 'expedia_vuelos']);

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatDate(value) {
  if (!value) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
}

function two(value) {
  return String(value).padStart(2, '0');
}

function fechaDdmmaa(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) return '';
  const [year, month, day] = fecha.split('-');
  return `${day}${month}${year.slice(2)}`;
}

function ruta(caso) {
  const e = caso.entrada ?? {};
  if (caso.tipo === 'hotel') return `Hotel en ${e.ciudad_destino ?? '—'}`;
  const origen = e.origen?.nombre ?? e.ciudad_origen ?? '—';
  const destino = e.destino?.nombre ?? e.ciudad_destino ?? '—';
  return `${origen} → ${destino}`;
}

function fechaCaso(caso) {
  const e = caso.entrada ?? {};
  if (caso.tipo === 'hotel') return `${e.checkin ?? '?'} a ${e.checkout ?? '?'}`;
  return e.fecha_ida ?? e.fecha ?? '—';
}

function fechaTexto(caso) {
  const e = caso.entrada ?? {};
  if (caso.tipo === 'hotel') return `${formatDate(e.checkin)} a ${formatDate(e.checkout)}`;
  return formatDate(fechaCaso(caso));
}

function fillPattern(pattern, caso) {
  const e = caso.entrada ?? {};
  const fecha = e.fecha_ida ?? e.fecha ?? '';
  const map = {
    iata_origen: e.iata_origen ?? e.origen?.iata ?? '',
    iata_destino: e.iata_destino ?? e.destino?.iata ?? '',
    iata_origen_lower: String(e.iata_origen ?? e.origen?.iata ?? '').toLowerCase(),
    iata_destino_lower: String(e.iata_destino ?? e.destino?.iata ?? '').toLowerCase(),
    destino_link: e.destino?.municipio ?? e.destino?.nombre ?? e.ciudad_destino ?? '',
    fecha,
    fecha_ddmmaa: fechaDdmmaa(fecha),
    ciudad_origen: e.ciudad_origen ?? e.origen?.nombre ?? '',
    ciudad_destino: e.ciudad_destino ?? e.destino?.nombre ?? '',
    hotel: e.hotel ?? '',
    checkin: e.checkin ?? '',
    checkout: e.checkout ?? '',
    slug_clickbus_origen: e.slug_clickbus_origen ?? '',
    slug_clickbus_destino: e.slug_clickbus_destino ?? '',
    slug_pp_origen: e.slug_pp_origen ?? '',
    slug_pp_destino: e.slug_pp_destino ?? '',
  };
  const missing = [];
  let url = pattern;
  for (const [key, value] of Object.entries(map)) {
    const token = `{${key}}`;
    if (!url.includes(token)) continue;
    if (!value) {
      missing.push(key);
      continue;
    }
    url = url.split(token).join(encodeURIComponent(value));
  }
  return { url, missing };
}

function resolveLink(caso, candidato, proveedores) {
  if (candidato.link) return { url: candidato.link, missing: [] };
  const pattern = proveedores[candidato.proveedor]?.patron;
  if (!pattern) return { url: null, missing: ['patron'] };
  return fillPattern(pattern, caso);
}

function detectarEstado(texto, finalUrl, caso) {
  const t = texto ?? '';
  if (finalUrl?.includes('errorOccurred=true')) return 'error';
  if (/are you a person or a robot|no soy un robot|captcha|verifica que eres humano|confirma que eres humano/i.test(t)) return 'captcha';
  if (/access denied|forbidden|403 forbidden|404 not found|p[aá]gina no encontrada|no tienes permiso/i.test(t)) return 'bloqueado';
  if (/no se encontraron resultados|no se encontraron vuelos|no se encontraron opciones|no hay resultados|sin resultados|no results|no se encontró ningún viaje/i.test(t)) return 'sin_resultados';
  if (/se produjo un error|algo sali[oó] mal|error inesperado|intenta de nuevo|volver a cargar/i.test(t)) return 'error';
  if (caso?.tipo === 'vuelo' && /Encuentra vuelos económicos/i.test(t)) return 'sin_resultados';
  if (caso?.tipo === 'vuelo' && /Encuentra vuelos baratos/i.test(t) && !/MEX a [A-Z]{3}, \d+\/\d+/i.test(t)) return 'sin_resultados';
  return 'ok';
}

function detectarDisponibilidad(texto, finalUrl, caso, estado, proveedor) {
  const t = texto ?? '';
  const tituloHome = /Encuentra vuelos económicos|Encuentra vuelos baratos/i.test(t);
  if (finalUrl?.includes('errorOccurred=true')) {
    return { estado: 'no_verificable', detalle: 'El proveedor devolvió errorOccurred=true; no se pudo verificar la disponibilidad.' };
  }
  if (estado === 'captcha' || estado === 'bloqueado' || estado === 'timeout' || estado === 'error') {
    return { estado: 'no_verificable', detalle: 'La página no cargó correctamente; no se pudo verificar.' };
  }
  if (proveedor === 'google_maps') {
    return { estado: 'no_verificable', detalle: 'Es un mapa, no una página de disponibilidad.' };
  }
  if (['volaris', 'vivaaerobus', 'ado', 'etn'].includes(proveedor) && !/resultado|vuelo|viaje|boleto/i.test(t)) {
    return { estado: 'no_verificable', detalle: 'Solo portada; no se ejecutó una búsqueda.' };
  }
  if (tituloHome) {
    return { estado: 'no_verificable', detalle: 'El link no ejecutó la búsqueda; quedó en la portada.' };
  }
  if (proveedor === 'booking_hotel' && /Brasil|São Paulo|Sao Paulo|Americana/i.test(t)) {
    return { estado: 'no_disponible', detalle: 'El buscador resolvió otra ciudad (Americana, Brasil).' };
  }
  if (/no se encontró ningún viaje|no se encontraron resultados|no se encontraron opciones|no hay resultados|sin resultados|0 alojamientos|0 resultados/i.test(t)) {
    return { estado: 'no_disponible', detalle: 'La página no muestra resultados para la ruta/fecha.' };
  }
  const tipo = caso?.tipo;
  const patrones = tipo === 'vuelo'
    ? [
        /Se encontraron\s+([\d.,]+)\s+resultados/i,
        /([\d.,]+)\s+de\s+[\d.,]+\s+vuelos/i,
        /([\d.,]+)\s+vuelos?\b/i,
      ]
    : tipo === 'hotel'
      ? [
          /([\d.,]+)\s+alojamientos?\b/i,
          /([\d.,]+)\s+hoteles?\b/i,
          /([\d.,]+)\s+resultados\b/i,
        ]
      : tipo === 'autobus'
        ? [
            /([\d.,]+)\s+viajes?\b/i,
            /([\d.,]+)\s+resultados\b/i,
          ]
        : [];
  for (const patron of patrones) {
    const m = t.match(patron);
    if (m) {
      const n = Number(m[1].replace(/[.,]/g, ''));
      if (Number.isFinite(n) && n > 0) return { estado: 'disponible', detalle: m[0].trim() };
    }
  }
  if (tipo === 'autobus') {
    const asientos = t.match(/([\d.,]+)\s+Asientos disponibles/i);
    if (asientos) return { estado: 'disponible', detalle: `${asientos[1]} asientos disponibles` };
  }
  if (/Seleccionar horario de ida|Ver asientos|Seleccionar/i.test(t) && /\$\s?[\d,]+/i.test(t)) {
    return { estado: 'disponible', detalle: 'Muestra horarios/precios con opción de seleccionar.' };
  }
  if (/\$\s?[\d,]+/.test(t) && !/Price : \$0\.00/i.test(t)) {
    return { estado: 'disponible', detalle: 'Muestra precios visibles.' };
  }
  return { estado: 'no_verificable', detalle: 'Sin contador de resultados visible.' };
}

function extraerPrecios(texto) {
  const limpio = (texto ?? '')
    .replace(/Price\s*:\s*\$[\d.,]+\s*-\s*\$[\d.,]+/gi, ' ')
    .replace(/MXN\s*[\d.,]+\s*-\s*MXN\s*[\d.,]+\+?/gi, ' ');
  const mxn = [...limpio.matchAll(/MXN\s?([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)/g)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 100 && n <= 100000);
  const dollar = [...limpio.matchAll(/\$\s?([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)/g)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 100 && n <= 100000);
  return [...new Set([...mxn, ...dollar])].slice(0, 10);
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

async function launchBrowser() {
  const executablePath = chromePath();
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}

const MESES_CALENDARIO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

async function elegirDiaCalendario(page, fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const nombreMes = MESES_CALENDARIO[mes - 1];
  const ahora = new Date();
  let anioCursor = ahora.getFullYear();
  let mesCursor = ahora.getMonth();
  const rowgroups = page.locator('div[role="grid"] div[role="rowgroup"]');
  const total = await rowgroups.count();
  for (let i = 0; i < total; i++) {
    const rg = rowgroups.nth(i);
    const texto = normalizar(await rg.innerText());
    const primera = texto.split('\n')[0].trim();
    const anioExplicito = texto.match(/de\s+(\d{4})/);
    const anioFila = anioExplicito ? Number(anioExplicito[1]) : anioCursor;
    if (primera.startsWith(nombreMes) && anioFila === anio) {
      const celda = rg.locator('div[role="gridcell"]').filter({ hasText: new RegExp('^' + dia + '$') }).first();
      if (!(await celda.count())) continue;
      await celda.locator('div').first().click({ force: true });
      return true;
    }
    mesCursor++;
    if (mesCursor > 11) { mesCursor = 0; anioCursor++; }
  }
  return false;
}
async function fijarFechasGoogleHotels(page, checkin, checkout) {
  try {
    await page.getByLabel('Registro').first().click();
    await page.waitForTimeout(800);
    const okEntrada = await elegirDiaCalendario(page, checkin);
    await page.waitForTimeout(500);
    const okSalida = await elegirDiaCalendario(page, checkout);
    await page.waitForTimeout(500);
    const listo = page.locator('div[role="dialog"]:visible button').filter({ hasText: 'Listo' }).first();
    if ((await listo.count()) && (await listo.isEnabled())) await listo.click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(2500);
    const valores = await page.$$eval('input', (els) =>
      els.map((e) => ({ aria: e.getAttribute('aria-label'), value: e.value }))
        .filter((x) => x.aria === 'Registro' || x.aria === 'Fecha de salida'));
    const esperado = (fecha) => {
      const [, mes, dia] = fecha.split('-').map(Number);
      return `${dia} ${MESES_CALENDARIO[mes - 1].slice(0, 3)}`;
    };
    const entradaOk = valores.some((v) => v.aria === 'Registro' && normalizar(v.value).includes(esperado(checkin)));
    const salidaOk = valores.some((v) => v.aria === 'Fecha de salida' && normalizar(v.value).includes(esperado(checkout)));
    return okEntrada && okSalida && entradaOk && salidaOk;
  } catch {
    return false;
  }
}

async function probarCandidato(browser, caso, candidato, settings) {
  const started = new Date().toISOString();
  const context = await browser.newContext({
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    viewport: { width: 1440, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  try {
    const response = await page.goto(candidato.link, { waitUntil: 'domcontentloaded', timeout: settings.timeout });
    let fechasAplicadas = null;
    if (caso.tipo === 'hotel' && caso.entrada?.checkin && caso.entrada?.checkout && candidato.proveedor.startsWith('google_hotels')) {
      await page.waitForTimeout(8000);
      fechasAplicadas = await fijarFechasGoogleHotels(page, caso.entrada.checkin, caso.entrada.checkout);
    }
    await page.waitForTimeout(settings.wait);
    const title = await page.title();
    const finalUrl = page.url();
    const body = await page.evaluate(() => document.body?.innerText ?? '');
    const text = body.replace(/\s+/g, ' ');
    let estado = detectarEstado(text, finalUrl, caso);
    let precios = extraerPrecios(text);
    let disponibilidad = detectarDisponibilidad(text, finalUrl, caso, estado, candidato.proveedor);
    if (fechasAplicadas === false) {
      estado = 'error';
      disponibilidad = { estado: 'no_verificable', detalle: 'No se pudieron fijar las fechas seleccionadas en Google Hotels.' };
      precios = [];
    }
    if (estado === 'ok' && disponibilidad.estado === 'no_disponible') estado = 'sin_resultados';
    if (estado === 'ok' && text.trim().length < 80) estado = 'error';
    if (disponibilidad.estado !== 'disponible') precios = [];
    let captura = candidato.captura ?? '';
    if (!settings.noCaptura) {
      const file = `${caso.id}__${candidato.proveedor}.png`;
      const destino = path.join(EVIDENCIAS, file);
      await page.screenshot({ path: destino, fullPage: false });
      captura = `evidencias/${file}`;
    }
    return {
      estado,
      resultado: `${title || 'Sin título'} | ${finalUrl} | ${text.slice(0, 350)}`,
      titulo: title,
      url_final: finalUrl,
      precio_visible: precios[0] ?? null,
      precios_visibles: precios,
      disponibilidad: disponibilidad.estado,
      disponibilidad_detalle: disponibilidad.detalle,
      moneda_precio: precios.length > 0 ? 'MXN' : '',
      captura,
      fecha_prueba: started,
      modo: 'headless',
      status_http: response ? response.status() : null,
      fechas_aplicadas: fechasAplicadas,
    };
  } catch (error) {
    let captura = candidato.captura ?? '';
    if (!settings.noCaptura) {
      const file = `${caso.id}__${candidato.proveedor}.png`;
      const destino = path.join(EVIDENCIAS, file);
      try {
        await page.screenshot({ path: destino, fullPage: false });
        captura = `evidencias/${file}`;
      } catch {
        captura = '';
      }
    }
    const mensaje = error instanceof Error ? error.message : String(error);
    const estado = /timeout/i.test(mensaje) ? 'timeout' : 'error';
    return {
      estado,
      resultado: mensaje.slice(0, 500),
      titulo: '',
      url_final: page.url(),
      precio_visible: null,
      precios_visibles: [],
      disponibilidad: 'no_verificable',
      disponibilidad_detalle: 'La navegación falló; no se pudo verificar.',
      moneda_precio: '',
      captura,
      fecha_prueba: started,
      modo: 'headless',
      status_http: null,
      fechas_aplicadas: null,
    };
  } finally {
    await context.close();
  }
}

function capturaSistema(proveedor, estado) {
  const bloqueado = BANNED_CAPTURE.has(proveedor);
  return {
    permitido: !bloqueado,
    estado: bloqueado ? 'no_permitido' : estado,
    motivo: bloqueado ? 'CapturasService.HardBannedDomains (booking.com/expedia.com)' : 'Sin bloqueo conocido',
  };
}

function mdLink(url) {
  if (!url) return '—';
  return `[abrir](${url})`;
}

function mdEstado(estado) {
  return estado ?? 'pendiente';
}

function generarMd(data) {
  const lineas = [];
  lineas.push('# Banco de pruebas de links de viáticos');
  lineas.push('');
  lineas.push(`- Actualizado: ${formatDate(data.actualizado)}`);
  lineas.push(`- Snapshot del sistema: ${formatDate(data.snapshot_sistema)}`);
  lineas.push(`- Fuente de datos: ${data.fuente_datos?.bd ?? '—'}`);
  if (data.fuente_datos?.nota_fechas) lineas.push(`- Nota de fechas: ${data.fuente_datos.nota_fechas}`);
  lineas.push('');
  lineas.push('Este archivo se genera desde `links-viaticos.json`. Los links son de consulta, no de reserva, salvo que se indique lo contrario. Las capturas viven en `evidencias/`.');
  lineas.push('La columna Precio es el primer importe visible; en páginas con filtros puede ser un rango (p. ej., 5000) y no el precio de la ruta.');
  lineas.push('Los conteos de disponibilidad son los que muestra el buscador y pueden incluir resultados de la zona; no son una reserva.');
  lineas.push('');
  lineas.push('## Resumen');
  lineas.push('');
  lineas.push('| Caso | Tipo | Ruta | Fecha | Precio actual | Link actual | Elegido |');
  lineas.push('|---|---|---|---|---:|---|---|');
  for (const caso of data.casos) {
    const actual = caso.sistema_actual ?? {};
    const link = actual.link_ejemplo || actual.links?.[0]?.url || '';
    const elegido = (caso.candidatos ?? []).find((c) => c.elegido);
    lineas.push(`| \`${caso.id}\` | ${caso.tipo} | ${ruta(caso)} | ${fechaTexto(caso)} | ${actual.precio ?? '—'} | ${mdLink(link)} | ${elegido ? `${elegido.proveedor} (${mdEstado(elegido.estado)})` : '—'} |`);
  }
  lineas.push('');
  lineas.push('## Disponibilidad del candidato elegido');
  lineas.push('');
  lineas.push('| Caso | Ruta | Fecha | Proveedor | Disponibilidad | Detalle |');
  lineas.push('|---|---|---|---|---|---|');
  for (const caso of data.casos) {
    const elegido = (caso.candidatos ?? []).find((c) => c.elegido);
    const disp = elegido?.disponibilidad ?? '—';
    const detalle = (elegido?.disponibilidad_detalle ?? '—').replace(/\|/g, '/');
    lineas.push(`| \`${caso.id}\` | ${ruta(caso)} | ${fechaTexto(caso)} | ${elegido?.proveedor ?? '—'} | ${disp} | ${detalle} |`);
  }
  lineas.push('');
  lineas.push('## Capturas del sistema');
  lineas.push('');
  if (data.capturas?.proveedores?.length) {
    lineas.push('| Proveedor | Permitido | Resultado | Motivo | Recomendación |');
    lineas.push('|---|---|---|---|---|');
    for (const cap of data.capturas.proveedores) {
      lineas.push(`| ${cap.proveedor} | ${cap.permitido ? 'sí' : 'no'} | ${cap.resultado} | ${(cap.motivo ?? '').replace(/\|/g, '/')} | ${(cap.recomendacion ?? '').replace(/\|/g, '/')} |`);
    }
  } else {
    lineas.push('Sin resumen de capturas.');
  }
  lineas.push('');
  lineas.push('## Casos');
  for (const caso of data.casos) {
    lineas.push('');
    lineas.push(`### ${caso.id}`);
    lineas.push('');
    lineas.push(`**${caso.descripcion}**`);
    lineas.push('');
    lineas.push(`- Ruta: ${ruta(caso)}`);
    lineas.push(`- Fecha: ${fechaTexto(caso)}`);
    if (caso.hospital) lineas.push(`- Hospital/ruta: ${caso.hospital}`);
    const entrada = caso.entrada ?? {};
    if (entrada.fecha_original) lineas.push(`- Fecha original de la solicitud: ${entrada.fecha_original}`);
    if (entrada.iata_origen || entrada.iata_destino) lineas.push(`- IATA: ${entrada.iata_origen ?? '—'} → ${entrada.iata_destino ?? '—'}`);
    if (entrada.slug_clickbus_origen || entrada.slug_clickbus_destino) lineas.push(`- ClickBus: \`${entrada.slug_clickbus_origen ?? '—'}\` → \`${entrada.slug_clickbus_destino ?? '—'}\``);
    lineas.push('');
    const actual = caso.sistema_actual ?? {};
    lineas.push('**Sistema actual**');
    lineas.push('');
    lineas.push(`- Etiqueta: ${actual.etiqueta ?? '—'}`);
    lineas.push(`- Precio: ${actual.precio ?? '—'} ${actual.moneda ?? ''}`);
    lineas.push(`- Fuente: ${actual.fuente ?? '—'}`);
    lineas.push(`- Estimado: ${actual.estimado ? 'sí' : 'no'}`);
    if (actual.disponibilidad) lineas.push(`- Disponibilidad actual: ${actual.disponibilidad}${actual.disponibilidad_detalle ? ` (${actual.disponibilidad_detalle})` : ''}`);
    if (actual.link_ejemplo) lineas.push(`- Link: ${mdLink(actual.link_ejemplo)}`);
    for (const item of actual.links ?? []) lineas.push(`- ${item.descripcion}: ${mdLink(item.url)}`);
    if (actual.resultado) lineas.push(`- Resultado: ${actual.resultado}`);
    if (actual.evidencia) lineas.push(`- Evidencia: ${actual.evidencia}`);
    if (actual.captura) lineas.push(`- Captura actual: [ver](${actual.captura})`);
    lineas.push('');
    lineas.push('**Candidatos**');
    lineas.push('');
    lineas.push('| Proveedor | Link | Estado | Disponibilidad | Precio | Resultado | Captura | Capturable |');
    lineas.push('|---|---|---|---|---:|---|---|---|');
    for (const candidato of caso.candidatos ?? []) {
      const capturable = candidato.capturable_sistema;
      const capturableTxt = capturable ? `${capturable.permitido ? 'sí' : 'no'} (${capturable.estado ?? '—'})` : '—';
      const disp = candidato.disponibilidad ? `${candidato.disponibilidad}${candidato.disponibilidad_detalle ? ` (${candidato.disponibilidad_detalle})` : ''}` : '—';
      lineas.push(`| ${candidato.proveedor} | ${mdLink(candidato.link)} | ${mdEstado(candidato.estado)} | ${disp.replace(/\|/g, '/')} | ${candidato.precio_visible ?? '—'} | ${(candidato.resultado ?? '').replace(/\|/g, '/').slice(0, 160)} | ${candidato.captura ? `[ver](${candidato.captura})` : '—'} | ${capturableTxt} |`);
    }
    if (caso.decision) {
      lineas.push('');
      lineas.push('**Decisión**');
      lineas.push('');
      lineas.push(`- Proveedor: ${caso.decision.proveedor ?? '—'}`);
      lineas.push(`- Patrón: ${caso.decision.patron ?? '—'}`);
      lineas.push(`- Motivo: ${caso.decision.motivo ?? '—'}`);
      lineas.push(`- Fallback: ${caso.decision.fallback ?? '—'}`);
      for (const cambio of caso.decision.cambios ?? []) {
        lineas.push(`- Cambio: \`${cambio.archivo}\`${cambio.funcion ? ` · ${cambio.funcion}` : ''}${cambio.linea ? `:${cambio.linea}` : ''} — ${cambio.cambio}`);
      }
    }
  }
  lineas.push('');
  if (data.decisiones) {
    lineas.push('## Decisiones globales');
    lineas.push('');
    for (const [tipo, decision] of Object.entries(data.decisiones)) {
      lineas.push(`### ${tipo}`);
      lineas.push('');
      lineas.push(`- Proveedor: ${decision.proveedor ?? '—'}`);
      lineas.push(`- Patrón: ${decision.patron ?? '—'}`);
      lineas.push(`- Motivo: ${decision.motivo ?? '—'}`);
      lineas.push(`- Fallback: ${decision.fallback ?? '—'}`);
      for (const cambio of decision.cambios ?? []) {
        lineas.push(`- Cambio: \`${cambio.archivo}\`${cambio.funcion ? ` · ${cambio.funcion}` : ''}${cambio.linea ? `:${cambio.linea}` : ''} — ${cambio.cambio}`);
      }
      lineas.push('');
    }
  }
  lineas.push('## Cambios al sistema');
  lineas.push('');
  let hayCambios = false;
  for (const caso of data.casos) {
    for (const cambio of caso.decision?.cambios ?? []) {
      hayCambios = true;
      lineas.push(`- [ ] \`${caso.id}\` — \`${cambio.archivo}\`${cambio.funcion ? ` · ${cambio.funcion}` : ''}${cambio.linea ? `:${cambio.linea}` : ''}: ${cambio.cambio}`);
    }
  }
  for (const [tipo, decision] of Object.entries(data.decisiones ?? {})) {
    for (const cambio of decision.cambios ?? []) {
      hayCambios = true;
      lineas.push(`- [ ] Global ${tipo} — \`${cambio.archivo}\`${cambio.funcion ? ` · ${cambio.funcion}` : ''}${cambio.linea ? `:${cambio.linea}` : ''}: ${cambio.cambio}`);
    }
  }
  if (!hayCambios) lineas.push('Sin decisiones registradas todavía.');
  lineas.push('');
  lineas.push('## Pendientes');
  lineas.push('');
  let pendientes = 0;
  for (const caso of data.casos) {
    for (const candidato of caso.candidatos ?? []) {
      if (candidato.estado === 'pendiente') {
        pendientes += 1;
        lineas.push(`- \`${caso.id}\` → ${candidato.proveedor}`);
      }
    }
  }
  if (pendientes === 0) lineas.push('Sin pendientes.');
  lineas.push('');
  lineas.push('## Cómo probar');
  lineas.push('');
  lineas.push('1. Abre los links de la columna Link con un navegador normal.');
  lineas.push('2. Anota el estado (`ok`, `sin_resultados`, `error`, `timeout`, `captcha`, `bloqueado`) y el precio visible.');
  lineas.push('3. Actualiza `links-viaticos.json` y vuelve a generar este archivo con `node scripts/probar-links.mjs --md-only`.');
  lineas.push('4. Cuando un patrón quede elegido, marca `elegido: true` y agrega los cambios en `decision.cambios`.');
  lineas.push('5. El script de Playwright prueba solo los candidatos `pendiente`; usa `--force` para repetir y `--case`/`--proveedor` para acotar.');
  lineas.push('');
  return lineas.join('\n');
}

async function main() {
  const jsonPath = path.resolve(option('json', DEFAULT_JSON));
  const mdPath = path.resolve(option('md', DEFAULT_MD));
  const onlyCase = option('case', '');
  const onlyProvider = option('proveedor', '');
  const timeout = Number(option('timeout', '45000'));
  const wait = Number(option('wait', '15000'));
  const force = flag('force');
  const noCaptura = flag('no-captura');
  const mdOnly = flag('md-only');
  const data = loadJson(jsonPath);

  if (!Array.isArray(data.casos)) throw new Error('El JSON no tiene casos.');
  fs.mkdirSync(EVIDENCIAS, { recursive: true });

  if (!mdOnly) {
    const browser = await launchBrowser();
    try {
      for (const caso of data.casos) {
        if (onlyCase && caso.id !== onlyCase) continue;
        for (const candidato of caso.candidatos ?? []) {
          if (onlyProvider && candidato.proveedor !== onlyProvider) continue;
          if (!force && candidato.estado !== 'pendiente') continue;
          const resolved = resolveLink(caso, candidato, data.proveedores ?? {});
          if (!resolved.url) {
            candidato.estado = 'no_aplica';
            candidato.resultado = `Faltan datos para construir el link: ${resolved.missing.join(', ')}`;
            continue;
          }
          candidato.link = resolved.url;
          process.stdout.write(`Probando ${caso.id} → ${candidato.proveedor} ... `);
          const resultado = await probarCandidato(browser, caso, candidato, { timeout, wait, noCaptura });
          Object.assign(candidato, resultado);
          candidato.capturable_sistema = capturaSistema(candidato.proveedor, resultado.estado);
          process.stdout.write(`${resultado.estado}\n`);
        }
      }
    } finally {
      await browser.close();
    }
    data.actualizado = new Date().toISOString().slice(0, 10);
    saveJson(jsonPath, data);
  }

  const md = generarMd(data);
  fs.writeFileSync(mdPath, md, 'utf8');
  process.stdout.write(`JSON: ${jsonPath}\nMD: ${mdPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
