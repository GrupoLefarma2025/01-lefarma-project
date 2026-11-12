#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const FRONTEND_ROOT = path.join(REPO_ROOT, 'lefarma.frontend');
const CIUDADES_FILE = path.join(__dirname, 'ciudades.json');
const COTIZACIONES_DIR = path.join(__dirname, 'cotizaciones');

const ARGS = new Set(process.argv.slice(2));
const DEMO = ARGS.has('--demo');
const DEMO_BUS = ARGS.has('--demo-bus');
const DEMO_PP = ARGS.has('--demo-pp');
const HEADFUL = ARGS.has('--headful');

const require = createRequire(path.join(FRONTEND_ROOT, 'package.json'));
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('No se encontró Playwright. Ejecuta "npm install" dentro de lefarma.frontend.');
  process.exit(1);
}

const ciudadesData = JSON.parse(fs.readFileSync(CIUDADES_FILE, 'utf8'));
const CIUDADES = ciudadesData.ciudades;

const LINEAS_AEREAS = [
  'Volaris', 'Viva', 'Aeromexico', 'Aeroméxico', 'Mexicana de Aviación', 'Mexicana',
  'Euroairlines', 'Varias aerolíneas', 'Delta', 'American Airlines', 'United', 'Copa',
  'Avianca', 'TAR', 'Aerus', 'Magnicharters', 'Volaris Costa Rica', 'Sky Airline',
];

let browser = null;

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slug(texto) {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diferenciaDias(desde, hasta) {
  const a = new Date(`${desde}T12:00:00`);
  const b = new Date(`${hasta}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) return false;
  const d = new Date(`${fecha}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

function mxn(valor) {
  return `$${Number(valor ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numeroDePrecio(texto) {
  if (typeof texto === 'number') return texto;
  const limpio = String(texto ?? '').replace(/[^\d.]/g, '');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

function linea() {
  console.log('-'.repeat(78));
}

function mostrarCiudades() {
  console.log('\nCiudades disponibles:');
  CIUDADES.forEach((c, i) => {
    const iata = c.iata ? ` (${c.iata})` : '';
    const sufijo = c.clickbus ? '' : ' [sin bus]';
    console.log(`  ${String(i + 1).padStart(2, ' ')}. ${c.nombre}${iata}${sufijo}`);
  });
  console.log('');
}

function buscarCiudad(texto) {
  const q = normalizar(texto);
  if (!q) return null;
  const porExacto = CIUDADES.find((c) => normalizar(c.nombre) === q);
  if (porExacto) return porExacto;
  const porIata = CIUDADES.find((c) => c.iata && normalizar(c.iata) === q);
  if (porIata) return porIata;
  return CIUDADES.find((c) => (c.alias ?? []).some((a) => normalizar(a) === q)) ?? null;
}

async function pedirCiudad(rl, titulo, listar) {
  if (listar) mostrarCiudades();
  while (true) {
    const resp = (await rl.question(`${titulo} (número, nombre o IATA; ? = lista): `)).trim();
    if (resp === '?') {
      mostrarCiudades();
      continue;
    }
    if (/^\d+$/.test(resp)) {
      const idx = Number(resp) - 1;
      if (CIUDADES[idx]) return CIUDADES[idx];
      console.log('Número fuera de rango.');
      continue;
    }
    const ciudad = buscarCiudad(resp);
    if (ciudad) return ciudad;
    console.log('No encontré esa ciudad. Escribe "?" para ver la lista.');
  }
}

async function pedirFecha(rl, titulo, porDefecto, minimo) {
  while (true) {
    const resp = (await rl.question(`${titulo} [${porDefecto}]: `)).trim();
    const fecha = resp || porDefecto;
    if (!fechaValida(fecha)) {
      console.log('Fecha inválida. Usa YYYY-MM-DD.');
      continue;
    }
    if (minimo && fecha < minimo) {
      console.log(`La fecha no puede ser menor a ${minimo}.`);
      continue;
    }
    return fecha;
  }
}

async function preguntar(rl, texto, porDefecto = '') {
  const resp = (await rl.question(`${texto}${porDefecto ? ` [${porDefecto}]` : ''}: `)).trim();
  return resp || porDefecto;
}

async function preguntarSiNo(rl, texto, porDefecto = true) {
  const resp = normalizar(await preguntar(rl, `${texto} (s/n)`, porDefecto ? 's' : 'n'));
  return resp.startsWith('s');
}

async function elegirMenu(rl, titulo, opciones) {
  if (opciones.length === 1) return opciones[0];
  console.log(`\n${titulo}:`);
  opciones.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
  while (true) {
    const resp = (await rl.question('Elige una opción: ')).trim();
    if (/^\d+$/.test(resp)) {
      const idx = Number(resp) - 1;
      if (opciones[idx]) return opciones[idx];
    }
    console.log('Opción inválida.');
  }
}

function rutaChrome() {
  const candidatos = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidatos.find((c) => fs.existsSync(c)) ?? null;
}

async function iniciarNavegador() {
  const executablePath = rutaChrome();
  browser = await chromium.launch({
    headless: !HEADFUL,
    ...(executablePath ? { executablePath } : {}),
    args: ['--disable-blink-features=AutomationControlled'],
  });
  return browser;
}

async function cerrarNavegador() {
  if (browser) {
    try { await browser.close(); } catch { /* ignore */ }
    browser = null;
  }
}

async function nuevaPagina() {
  const context = await browser.newContext({
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    viewport: { width: 1440, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  return { context, page };
}

async function navegar(page, url, espera = 15000) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(espera);
}

async function textoPagina(page) {
  return (await page.evaluate(() => document.body?.innerText ?? '')).replace(/\s+/g, ' ').trim();
}

async function capturar(page, dir, nombre) {
  const destino = path.join(dir, nombre);
  await page.screenshot({ path: destino, fullPage: false });
  return `capturas/${nombre}`;
}

async function capturarElegido(page, texto, dir, nombre) {
  if (texto) {
    try {
      const loc = page.getByText(texto, { exact: false }).first();
      await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
      await loc.evaluate((el) => {
        el.style.outline = '4px solid #eb6c36';
        el.style.outlineOffset = '2px';
      });
    } catch { /* ignore */ }
  }
  return capturar(page, dir, nombre);
}

function detectarDisponibilidad(texto, tipo, cantidad) {
  const t = String(texto ?? '');
  if (/captcha|are you a person or a robot|access denied|forbidden/i.test(t)) {
    return { estado: 'no_verificable', detalle: 'Sitio bloqueado o captcha.' };
  }
  if (/no se encontró ningún viaje|no se encontraron resultados|no hay resultados|sin resultados|0 alojamientos|0 resultados/i.test(t)) {
    return { estado: 'no_disponible', detalle: 'Sin resultados para la ruta/fecha.' };
  }
  if (cantidad > 0) {
    let detalle = `${cantidad} opciones visibles`;
    if (tipo === 'vuelo') {
      const m = t.match(/(\d+)\s+de\s+(\d+)\s+vuelos/i);
      if (m) detalle = `${m[1]} de ${m[2]} vuelos`;
    } else if (tipo === 'autobus') {
      const m = t.match(/(\d+)\s+Asientos disponibles/i);
      if (m) detalle = `${m[1]} asientos disponibles`;
      const m2 = t.match(/Últimos\s+(\d+)\s+boletos/i);
      if (m2) detalle = `${m2[1]} boletos disponibles`;
    } else if (tipo === 'hotel') {
      const m = t.match(/([\d,.]+)\s+resultados/i) || t.match(/([\d,.]+)\s+Hoteles/i);
      if (m) detalle = `${m[1]} resultados`;
    }
    return { estado: 'disponible', detalle };
  }
  return { estado: 'no_verificable', detalle: 'No se pudieron leer opciones.' };
}

function deduplicar(opciones, clave) {
  const vistos = new Set();
  return opciones.filter((o) => {
    const k = clave(o);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

async function buscarVuelosKayak(page, origen, destino, fecha) {
  const url = `https://www.kayak.com.mx/flights/${origen.iata}-${destino.iata}/${fecha}?sort=bestflight_a&fs=cabin=e`;
  await navegar(page, url, 15000);
  const body = await textoPagina(page);
  const cards = await page.$$eval('.Fxw9-result-item-container', (els) =>
    els.map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  const opciones = [];
  for (const texto of cards) {
    if (/Boleto de autobús|Autobús \$/i.test(texto)) continue;
    const tiempos = texto.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    if (!tiempos) continue;
    const precio = texto.match(/\$([\d,]+(?:\.\d{2})?)/);
    if (!precio) continue;
    const duracion = texto.match(/(\d+)\s*h\s*(\d+)\s*min/);
    const escalas = texto.match(/directo|(\d+)\s+escala/i);
    const linea = LINEAS_AEREAS.find((n) => normalizar(texto).includes(normalizar(n))) ?? 'Aerolínea';
    const patrocinado = /Anuncio|Patrocinado/i.test(texto);
    opciones.push({
      linea,
      servicio: patrocinado ? 'Patrocinado' : '',
      salida: tiempos[1],
      llegada: tiempos[2],
      duracion: duracion ? `${duracion[1]}h ${duracion[2]}m` : '',
      escalas: escalas ? (escalas[1] ? `${escalas[1]} escala(s)` : 'Directo') : '',
      precio: numeroDePrecio(precio[1]),
      texto_busqueda: `${tiempos[1]} – ${tiempos[2]}`,
      notas: patrocinado ? 'Resultado patrocinado.' : '',
    });
  }
  const limpias = deduplicar(opciones, (o) => `${o.salida}|${o.llegada}|${o.linea}|${o.precio}`).slice(0, 10);
  const disponibilidad = detectarDisponibilidad(body, 'vuelo', limpias.length);
  return { opciones: limpias, link: url, disponibilidad };
}

async function buscarVuelosGoogle(page, origen, destino, fecha) {
  const consulta = `Flights from ${origen.iata ?? origen.nombre} to ${destino.iata ?? destino.nombre} on ${fecha}`;
  const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(consulta)}&curr=MXN&hl=es-MX&gl=MX`;
  await navegar(page, url, 15000);
  const body = await textoPagina(page);
  const bloques = body.split(/(?=\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2})/);
  const opciones = [];
  for (const bloque of bloques) {
    const tiempos = bloque.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    const precio = bloque.match(/\$([\d,]+(?:\.\d{2})?)/) || bloque.match(/MXN\s*([\d,]+(?:\.\d{2})?)/);
    if (!tiempos || !precio) continue;
    const duracion = bloque.match(/(\d+)\s*h\s*(\d+)\s*min/);
    const linea = LINEAS_AEREAS.find((n) => normalizar(bloque).includes(normalizar(n))) ?? 'Aerolínea';
    opciones.push({
      linea,
      salida: tiempos[1],
      llegada: tiempos[2],
      duracion: duracion ? `${duracion[1]}h ${duracion[2]}m` : '',
      escalas: /directo/i.test(bloque) ? 'Directo' : '',
      precio: numeroDePrecio(precio[1]),
      texto_busqueda: `${tiempos[1]} – ${tiempos[2]}`,
      notas: '',
    });
  }
  const limpias = deduplicar(opciones, (o) => `${o.salida}|${o.llegada}|${o.linea}|${o.precio}`).slice(0, 10);
  const disponibilidad = detectarDisponibilidad(body, 'vuelo', limpias.length);
  return { opciones: limpias, link: url, disponibilidad };
}

async function buscarBusesClickBus(page, origen, destino, fecha) {
  const url = `https://www.clickbus.com.mx/trips?departure_place=${encodeURIComponent(origen.clickbus)}`
    + `&arrival_place=${encodeURIComponent(destino.clickbus)}&departure_date=${fecha}`;
  await navegar(page, url, 15000);
  const body = await textoPagina(page);
  let cards = await page.$$eval('.detail-element', (els) =>
    els.map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  if (!cards.length) {
    cards = await page.$$eval('.detail-wrap', (els) =>
      els.map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  }
  const re = /^(.+?)\s+(\d{2}:\d{2})\s+hrs\.\s+(.*?)\s+Tipo:\s*(Local|Paso)\s+(\d+h(?:\s*\d+m)?)\s+(\d{2}:\d{2})\s+hrs\.\s+(.*?)\s+\$([\d,.]+)(?:\s+\$([\d,.]+))?\s+Seleccionar\s+(\d+)\s+Asientos disponibles/;
  const opciones = [];
  for (const texto of cards) {
    const m = texto.match(re);
    if (!m) continue;
    opciones.push({
      linea: m[1].trim(),
      servicio: m[4],
      salida: m[2],
      llegada: m[6],
      duracion: m[5],
      escalas: '',
      precio: numeroDePrecio(m[9] ?? m[8]),
      asientos: Number(m[10]),
      texto_busqueda: `${m[1].trim()} ${m[2]} hrs.`,
      notas: '',
    });
  }
  const limpias = deduplicar(opciones, (o) => `${o.linea}|${o.salida}|${o.llegada}|${o.precio}`).slice(0, 12);
  const disponibilidad = detectarDisponibilidad(body, 'autobus', limpias.length);
  return { opciones: limpias, link: url, disponibilidad };
}

async function buscarBusesPrimeraPlus(page, origen, destino, fecha) {
  if (!origen.primera_plus_origen || !destino.primera_plus_destino) {
    return {
      opciones: [],
      link: '',
      disponibilidad: { estado: 'no_verificable', detalle: 'Primera Plus no tiene slug para esta ciudad.' },
    };
  }
  const url = `https://viaje.primeraplus.com.mx/search/${origen.primera_plus_origen}/${destino.primera_plus_destino}/${fecha}/p/general-1/departures?lang=spanish&seatsOnResultsDiscounts=true`;
  await navegar(page, url, 12000);
  const body = await textoPagina(page);
  const cards = await page.evaluate(() => {
    const out = [];
    const vistos = new Set();
    for (const el of document.querySelectorAll('div')) {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!t.includes('Ver asientos') || !t.includes('$') || t.length > 700) continue;
      if ([...el.children].some((c) => (c.innerText || '').replace(/\s+/g, ' ').trim() === t)) continue;
      if (vistos.has(t)) continue;
      vistos.add(t);
      out.push(t);
      if (out.length >= 12) break;
    }
    return out;
  });
  const opciones = [];
  for (const texto of cards) {
    const tiempos = [...texto.matchAll(/(\d{1,2}:\d{2}\s*[AP]M)/g)].map((m) => m[1]);
    if (tiempos.length < 2) continue;
    const precios = [...texto.matchAll(/\$([\d,.]+)\s*MXN/g)].map((m) => numeroDePrecio(m[1]));
    if (!precios.length) continue;
    const duracion = texto.match(/(\d+\s*(?:horas?|hrs?)(?:\s*\d+\s*(?:mins?|minutos?))?)/i);
    const boletos = texto.match(/Últimos\s+(\d+)\s+boletos/i) || texto.match(/(\d+)\s+boletos/i);
    const servicio = texto.split('Detalles')[0].trim();
    opciones.push({
      linea: 'Primera Plus',
      servicio,
      salida: tiempos[0],
      llegada: tiempos[1],
      duracion: duracion ? duracion[1] : '',
      escalas: /Directo/i.test(texto) ? 'Directo' : '',
      precio: precios[precios.length - 1],
      asientos: boletos ? Number(boletos[1]) : null,
      texto_busqueda: `${tiempos[0]} Directo ${tiempos[1]}`,
      notas: '',
    });
  }
  const limpias = deduplicar(opciones, (o) => `${o.salida}|${o.llegada}|${o.precio}`).slice(0, 10);
  const disponibilidad = detectarDisponibilidad(body, 'autobus', limpias.length);
  return { opciones: limpias, link: url, disponibilidad };
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

async function elegirDiaCalendario(page, fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const nombreMes = MESES_ES[mes - 1];
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
      return `${dia} ${MESES_ES[mes - 1].slice(0, 3)}`;
    };
    const entradaOk = valores.some((v) => v.aria === 'Registro' && normalizar(v.value).includes(esperado(checkin)));
    const salidaOk = valores.some((v) => v.aria === 'Fecha de salida' && normalizar(v.value).includes(esperado(checkout)));
    return okEntrada && okSalida && entradaOk && salidaOk;
  } catch {
    return false;
  }
}

async function buscarHotelesGoogle(page, ciudad, checkin, checkout) {
  const query = encodeURIComponent(`hoteles en ${ciudad.hotel_query ?? ciudad.nombre}`);
  const url = `https://www.google.com/travel/search?q=${query}&checkin=${checkin}&checkout=${checkout}&hl=es-MX&gl=MX&curr=MXN`;
  await navegar(page, url, 15000);
  const fechasOk = await fijarFechasGoogleHotels(page, checkin, checkout);
  if (!fechasOk) throw new Error('Google Hotels no aplicó las fechas seleccionadas.');
  const body = await textoPagina(page);
  const cards = await page.evaluate(() => {
    const out = [];
    const vistos = new Set();
    for (const el of document.querySelectorAll('div, span')) {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (t.length < 25 || t.length > 400) continue;
      if (!t.includes('MXN')) continue;
      const m = t.match(/^(.{2,100}?)\s+MXN\s*([\d,]+(?:\.\d{2})?)/);
      if (!m) continue;
      const nombre = m[1].trim();
      if (!nombre || /^MXN/i.test(nombre) || /^OFERTA/i.test(nombre)) continue;
      if (vistos.has(nombre)) continue;
      vistos.add(nombre);
      const rating = t.match(/(\d\.\d)\/5/);
      out.push({ nombre, precio: Number(m[2].replace(/,/g, '')), rating: rating?.[1] ?? null, texto: t });
      if (out.length >= 12) break;
    }
    return out;
  });
  const limpias = [];
  const vistos = new Set();
  for (const c of cards) {
    const nombre = c.nombre.replace(/\s+/g, ' ').trim();
    if (!nombre || vistos.has(normalizar(nombre))) continue;
    vistos.add(normalizar(nombre));
    limpias.push({
      nombre,
      precio_noche: c.precio,
      rating: c.rating,
      texto_busqueda: nombre,
      notas: '',
    });
  }
  const disponibilidad = detectarDisponibilidad(body, 'hotel', limpias.length);
  return { opciones: limpias.slice(0, 10), link: url, disponibilidad };
}

async function cerrarModalBooking(page) {
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const selectores = [
      'button[aria-label="Cerrar"]',
      'button[aria-label="Cerrar diálogo"]',
      '[role="dialog"] button[aria-label="Cerrar"]',
    ];
    for (const selector of selectores) {
      const boton = page.locator(selector).first();
      if (await boton.count()) {
        await boton.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        break;
      }
    }
  } catch {
    // La captura sigue aunque no se pueda cerrar el modal.
  }
}

async function buscarHotelesBooking(page, ciudad, checkin, checkout) {
  const noches = Math.max(1, diferenciaDias(checkin, checkout));
  const url = `https://www.booking.com/searchresults.es.html?ss=${encodeURIComponent(ciudad.hotel_query ?? ciudad.nombre)}&checkin=${checkin}&checkout=${checkout}&group_adults=1&no_rooms=1`;
  await navegar(page, url, 15000);
  await cerrarModalBooking(page);
  await page.waitForTimeout(1000);
  await cerrarModalBooking(page);
  const body = await textoPagina(page);
  const cards = await page.$$eval('[data-testid="property-card"]', (els) =>
    els.map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  const opciones = [];
  for (const texto of cards) {
    const nombre = texto.split('Se abre en una ventana nueva')[0].trim();
    if (!nombre) continue;
    const antes = texto.split(/de impuestos|impuestos y cargos|impuestos y tasas/i)[0];
    const sinImpuestos = antes.split('+')[0];
    const precios = [...sinImpuestos.matchAll(/MXN\s*([\d,]+(?:\.\d{2})?)/g)].map((m) => numeroDePrecio(m[1]));
    if (!precios.length) continue;
    const precioEstadia = precios[precios.length - 1];
    if (!precioEstadia) continue;
    const rating = texto.match(/Puntuación:\s*([\d.]+)/);
    const ratingCount = texto.match(/([\d.,]+)\s*(K)?\s+comentarios/i);
    let ratingCountNum = ratingCount ? numeroDePrecio(ratingCount[1]) : null;
    if (ratingCountNum !== null && ratingCount?.[2]) ratingCountNum *= 1000;
    const distancia = texto.match(/a\s+([\d.,]+)\s+km\s+del centro/i);
    const zonaRaw = texto.match(/ventana nueva\s+(.*?)Mostrar en el mapa/i)?.[1]?.trim() ?? '';
    const zona = zonaRaw.split(/\.\s+/).pop().trim();
    const disponibles = texto.match(/Nos quedan\s+(\d+)\s+a este precio/i);
    opciones.push({
      nombre,
      precio_noche: Math.round((precioEstadia / noches) * 100) / 100,
      precio_estadia: precioEstadia,
      rating: rating?.[1] ?? null,
      rating_count: ratingCountNum,
      distancia_km: distancia ? numeroDePrecio(distancia[1]) : null,
      distancia_texto: distancia ? `${distancia[1]} km del centro` : '',
      zona,
      disponibles: disponibles ? Number(disponibles[1]) : null,
      texto_busqueda: nombre,
      notas: 'Precio de Booking para toda la estancia; se dividió entre las noches. No incluye impuestos ni cargos.',
    });
  }
  const limpias = deduplicar(opciones, (o) => normalizar(o.nombre)).slice(0, 10);
  const conteo = body.match(/([\d,.]+)\s+alojamientos encontrados/i) || body.match(/([\d,.]+)\s+hoteles encontrados/i);
  const disponibilidad = {
    estado: limpias.length ? 'disponible' : 'no_disponible',
    detalle: conteo ? `${conteo[1]} alojamientos` : `${limpias.length} opciones visibles`,
  };
  for (const o of limpias) {
    if (o.precio_noche < 250) o.notas = `${o.notas ?? ''} Precio inusualmente bajo; revisa la captura.`.trim();
  }
  return { opciones: limpias, link: url, disponibilidad };
}
async function capturaManualTransporte(rl, link, captura) {
  console.log('\nCaptura manual de la opción. Revisa la captura si la necesitas:');
  if (captura) console.log(`  ${captura}`);
  const linea = await preguntar(rl, 'Línea o empresa', '');
  const salida = await preguntar(rl, 'Salida (HH:MM)', '');
  const llegada = await preguntar(rl, 'Llegada (HH:MM)', '');
  const precio = numeroDePrecio(await preguntar(rl, 'Precio MXN', '0'));
  return {
    linea: linea || 'Opción manual',
    servicio: '',
    salida,
    llegada,
    duracion: '',
    escalas: '',
    precio,
    texto_busqueda: '',
    notas: 'Datos capturados manualmente.',
  };
}

async function capturaManualHotel(rl, link, captura) {
  console.log('\nCaptura manual del hotel. Revisa la captura si la necesitas:');
  if (captura) console.log(`  ${captura}`);
  const nombre = await preguntar(rl, 'Nombre del hotel', 'Hotel manual');
  const precio = numeroDePrecio(await preguntar(rl, 'Precio por noche MXN', '0'));
  return {
    nombre: nombre || 'Hotel manual',
    precio_noche: precio,
    rating: null,
    texto_busqueda: '',
    notas: 'Datos capturados manualmente.',
  };
}

function mostrarOpcionesTransporte(opciones) {
  console.log('');
  console.log(' #  Línea                Salida   Llegada  Duración    Escalas    Precio');
  console.log(' -  -------------------  ------   -------  ----------  ---------  ----------');
  opciones.forEach((o, i) => {
    const linea = String(o.linea ?? '').slice(0, 19).padEnd(19, ' ');
    const servicio = o.servicio ? ` (${o.servicio})` : '';
    console.log(` ${String(i + 1).padStart(2, ' ')}  ${(linea + servicio).slice(0, 19).padEnd(19, ' ')}  ${String(o.salida ?? '').padEnd(6, ' ')}   ${String(o.llegada ?? '').padEnd(7, ' ')}  ${String(o.duracion ?? '').padEnd(10, ' ')}  ${String(o.escalas ?? '').padEnd(9, ' ')}  ${mxn(o.precio)}`);
  });
  console.log('');
}

function mostrarOpcionesHotel(opciones, noches) {
  console.log('');
  console.log(' #  Hotel                                     Rating  Distancia        Precio/noche   Total');
  console.log(' -  ----------------------------------------  ------  ---------------  -------------  ----------');
  opciones.forEach((o, i) => {
    const nombre = String(o.nombre ?? '').slice(0, 40).padEnd(40, ' ');
    const rating = String(o.rating ?? '-').slice(0, 4).padEnd(6, ' ');
    const distancia = String(o.distancia_texto ?? '-').slice(0, 15).padEnd(15, ' ');
    const total = (o.precio_noche ?? 0) * noches;
    console.log(` ${String(i + 1).padStart(2, ' ')}  ${nombre}  ${rating}  ${distancia}  ${mxn(o.precio_noche).padStart(13, ' ')}  ${mxn(total).padStart(10, ' ')}`);
  });
  console.log('');
}

async function elegirOpcion(rl, cantidad) {
  while (true) {
    const resp = (await rl.question(`Elige una opción (1-${cantidad}, 0 = cancelar): `)).trim();
    if (resp === '0') return null;
    if (/^\d+$/.test(resp)) {
      const idx = Number(resp) - 1;
      if (idx >= 0 && idx < cantidad) return idx;
    }
    console.log('Opción inválida.');
  }
}

function crearCarpeta(origen, destino) {
  fs.mkdirSync(COTIZACIONES_DIR, { recursive: true });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  const base = `cotizacion-${stamp}-${slug(origen.nombre)}-${slug(destino.nombre)}`;
  let carpeta = path.join(COTIZACIONES_DIR, base);
  let n = 2;
  while (fs.existsSync(carpeta)) {
    carpeta = path.join(COTIZACIONES_DIR, `${base}-${n++}`);
  }
  const capturas = path.join(carpeta, 'capturas');
  fs.mkdirSync(capturas, { recursive: true });
  return { carpeta, capturas, id: path.basename(carpeta) };
}

async function buscarTransporte(rl, { origen, destino, fecha, modo, proveedor, etapa, capturasDir }) {
  const tipo = modo === 'Vuelo' ? 'vuelo' : 'autobus';
  const url = modo === 'Vuelo' && proveedor === 'Kayak'
    ? `https://www.kayak.com.mx/flights/${origen.iata}-${destino.iata}/${fecha}?sort=bestflight_a&fs=cabin=e`
    : modo === 'Vuelo'
      ? `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${origen.iata} to ${destino.iata} on ${fecha}`)}&curr=MXN&hl=es-MX&gl=MX`
      : '';
  console.log(`\nBuscando ${tipo} ${etapa}: ${origen.nombre} → ${destino.nombre} (${fecha}) con ${proveedor}...`);
  const { context, page } = await nuevaPagina();
  try {
    let resultado;
    if (modo === 'Vuelo' && proveedor === 'Kayak') {
      resultado = await buscarVuelosKayak(page, origen, destino, fecha);
    } else if (modo === 'Vuelo') {
      resultado = await buscarVuelosGoogle(page, origen, destino, fecha);
    } else if (proveedor === 'ClickBus') {
      if (!origen.clickbus || !destino.clickbus) {
        throw new Error('ClickBus no tiene slug para una de las ciudades.');
      }
      resultado = await buscarBusesClickBus(page, origen, destino, fecha);
    } else {
      resultado = await buscarBusesPrimeraPlus(page, origen, destino, fecha);
    }
    const capturaOpciones = await capturar(page, capturasDir, `${etapa}-opciones.png`);
    console.log(`Disponibilidad: ${resultado.disponibilidad.estado} (${resultado.disponibilidad.detalle})`);
    if (!resultado.opciones.length) {
      console.log('No pude leer opciones automáticamente.');
      let opcion = null;
      if (await preguntarSiNo(rl, '¿Capturar los datos manualmente?', true)) {
        opcion = await capturaManualTransporte(rl, resultado.link, capturaOpciones);
      } else {
        return null;
      }
      return {
        tipo,
        proveedor,
        sentido: etapa,
        ...opcion,
        link: resultado.link,
        disponibilidad: resultado.disponibilidad.estado,
        disponibilidad_detalle: resultado.disponibilidad.detalle,
        capturas: [capturaOpciones],
      };
    }
    mostrarOpcionesTransporte(resultado.opciones);
    const idx = await elegirOpcion(rl, resultado.opciones.length);
    if (idx === null) return null;
    const elegida = resultado.opciones[idx];
    const capturaElegido = await capturarElegido(page, elegida.texto_busqueda, capturasDir, `${etapa}-elegido.png`);
    return {
      tipo,
      proveedor,
      sentido: etapa,
      ...elegida,
      link: resultado.link,
      disponibilidad: resultado.disponibilidad.estado,
      disponibilidad_detalle: resultado.disponibilidad.detalle,
      capturas: [capturaOpciones, capturaElegido],
    };
  } catch (error) {
    console.log(`Error al buscar: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    await context.close();
  }
}

async function buscarHotel(rl, { destino, checkin, checkout, noches, capturasDir }) {
  console.log(`\nBuscando hoteles en ${destino.nombre} (${checkin} a ${checkout}, ${noches} noche(s)) con Booking.com...`);
  const { context, page } = await nuevaPagina();
  try {
    const resultado = await buscarHotelesBooking(page, destino, checkin, checkout);
    const capturaOpciones = await capturar(page, capturasDir, 'hotel-opciones.png');
    console.log(`Disponibilidad: ${resultado.disponibilidad.estado} (${resultado.disponibilidad.detalle})`);
    if (!resultado.opciones.length) {
      console.log('No pude leer hoteles automáticamente.');
      let opcion = null;
      if (await preguntarSiNo(rl, '¿Capturar los datos manualmente?', true)) {
        opcion = await capturaManualHotel(rl, resultado.link, capturaOpciones);
      } else {
        return null;
      }
      return {
        proveedor: 'Booking.com',
        ...opcion,
        checkin,
        checkout,
        noches,
        link: resultado.link,
        disponibilidad: resultado.disponibilidad.estado,
        disponibilidad_detalle: resultado.disponibilidad.detalle,
        capturas: [capturaOpciones],
      };
    }
    mostrarOpcionesHotel(resultado.opciones, noches);
    const idx = await elegirOpcion(rl, resultado.opciones.length);
    if (idx === null) return null;
    const elegido = resultado.opciones[idx];
    const capturaElegido = await capturarElegido(page, elegido.texto_busqueda, capturasDir, 'hotel-elegido.png');
    return {
      proveedor: 'Booking.com',
      ...elegido,
      checkin,
      checkout,
      noches,
      link: resultado.link,
      disponibilidad: resultado.disponibilidad.estado,
      disponibilidad_detalle: resultado.disponibilidad.detalle,
      capturas: [capturaOpciones, capturaElegido],
    };
  } catch (error) {
    console.log(`Error al buscar hoteles: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    await context.close();
  }
}
function generarCotizacion({ id, carpeta, consulta, tramos, hotel }) {
  const transporte = tramos.reduce((sum, t) => sum + (t.precio ?? 0) * (consulta.personas ?? 1), 0);
  const hospedaje = hotel ? (hotel.precio_noche ?? 0) * (hotel.noches ?? 1) : 0;
  const total = transporte + hospedaje;
  const cotizacion = {
    version: '1.0.0',
    id,
    creada_en: new Date().toISOString(),
    consulta,
    tramos: tramos.map((t) => ({
      ...t,
      precio_total: (t.precio ?? 0) * (consulta.personas ?? 1),
    })),
    hotel: hotel ? {
      ...hotel,
      habitaciones: 1,
      precio_total: (hotel.precio_noche ?? 0) * (hotel.noches ?? 1),
    } : null,
    totales: {
      transporte,
      hotel: hospedaje,
      total,
      moneda: 'MXN',
    },
    notas: [
      'Precios y disponibilidad obtenidos del buscador en el momento de la consulta; no son una reserva.',
      'Los conteos de disponibilidad son indicativos y pueden incluir resultados de la zona.',
      'Las capturas de cada búsqueda y de la opción elegida quedaron en la carpeta capturas/.',
      hotel ? 'El hotel se cotizó para 1 habitación; ajusta si viajan más personas.' : 'No se incluyó hospedaje en esta cotización.',
      ...(hotel ? ['La captura de hotel puede incluir el modal "Inicia sesión y ahorra" de Booking; el CLI intenta cerrarlo antes de capturar.'] : []),
    ],
  };
  fs.writeFileSync(path.join(carpeta, 'cotizacion.json'), JSON.stringify(cotizacion, null, 2) + '\n', 'utf8');

  const l = [];
  l.push('='.repeat(78));
  l.push(`COTIZACIÓN ${id}`);
  l.push('='.repeat(78));
  l.push(`Origen:  ${consulta.origen.nombre}${consulta.origen.iata ? ` (${consulta.origen.iata})` : ''}`);
  l.push(`Destino: ${consulta.destino.nombre}${consulta.destino.iata ? ` (${consulta.destino.iata})` : ''}`);
  l.push(`Ida:     ${consulta.fecha_ida}`);
  l.push(`Vuelta:  ${consulta.fecha_vuelta ?? '(solo ida)'}`);
  l.push(`Personas: ${consulta.personas}`);
  l.push(`Medio:   ${consulta.modo}`);
  l.push('');
  l.push('TRANSPORTE');
  l.push('-'.repeat(78));
  for (const t of cotizacion.tramos) {
    l.push(`${t.sentido.toUpperCase()} · ${t.proveedor} · ${t.linea}${t.servicio ? ` (${t.servicio})` : ''}`);
    l.push(`  ${t.salida} → ${t.llegada}${t.duracion ? ` · ${t.duracion}` : ''}${t.escalas ? ` · ${t.escalas}` : ''}`);
    l.push(`  ${mxn(t.precio)} por persona · ${mxn(t.precio_total)} total · ${t.disponibilidad} (${t.disponibilidad_detalle})`);
    l.push(`  Link: ${t.link}`);
    for (const c of t.capturas ?? []) l.push(`  Captura: ${c}`);
    if (t.notas) l.push(`  Nota: ${t.notas}`);
    l.push('');
  }
  if (cotizacion.hotel) {
    l.push('HOTEL');
    l.push('-'.repeat(78));
    l.push(`${cotizacion.hotel.nombre}`);
    l.push(`  ${cotizacion.hotel.checkin} a ${cotizacion.hotel.checkout} · ${cotizacion.hotel.noches} noche(s)`);
    if (cotizacion.hotel.rating) l.push(`  Rating: ${cotizacion.hotel.rating}${cotizacion.hotel.rating_count ? ` (${cotizacion.hotel.rating_count} comentarios)` : ''}`);
    if (cotizacion.hotel.distancia_texto) l.push(`  Distancia: ${cotizacion.hotel.distancia_texto}`);
    if (cotizacion.hotel.zona) l.push(`  Zona: ${cotizacion.hotel.zona}`);
    if (cotizacion.hotel.disponibles) l.push(`  Habitaciones disponibles: ${cotizacion.hotel.disponibles}`);
    l.push(`  ${mxn(cotizacion.hotel.precio_noche)} por noche · ${mxn(cotizacion.hotel.precio_total)} total`);
    l.push(`  Disponibilidad: ${cotizacion.hotel.disponibilidad} (${cotizacion.hotel.disponibilidad_detalle})`);
    l.push(`  Link: ${cotizacion.hotel.link}`);
    for (const c of cotizacion.hotel.capturas ?? []) l.push(`  Captura: ${c}`);
    if (cotizacion.hotel.notas) l.push(`  Nota: ${cotizacion.hotel.notas}`);
    l.push('');
  }
  l.push('TOTALES');
  l.push('-'.repeat(78));
  l.push(`Transporte: ${mxn(transporte)}`);
  l.push(`Hotel:      ${mxn(hospedaje)}`);
  l.push(`TOTAL:      ${mxn(total)} MXN`);
  l.push('');
  l.push('Precios y disponibilidad obtenidos del buscador al momento de la consulta; no son una reserva.');
  l.push('='.repeat(78));
  fs.writeFileSync(path.join(carpeta, 'cotizacion.txt'), l.join('\n') + '\n', 'utf8');
  return cotizacion;
}

async function flujoInteractivo(rl) {
  console.log('');
  console.log('='.repeat(78));
  console.log('  COTIZADOR VIÁTICOS · pruebas de vuelos, autobuses y hoteles');
  console.log('='.repeat(78));
  console.log('Los links y precios son de consulta. No se compra ni se reserva nada.');
  console.log('');

  const origen = await pedirCiudad(rl, 'Ciudad de origen', true);
  const destino = await pedirCiudad(rl, 'Ciudad de destino', false);
  const sugeridaIda = sumarDias(hoyISO(), 7);
  const fechaIda = await pedirFecha(rl, 'Fecha de ida', sugeridaIda);
  const idaVuelta = await preguntarSiNo(rl, '¿Ida y vuelta?', true);
  const fechaVuelta = idaVuelta ? await pedirFecha(rl, 'Fecha de vuelta', sumarDias(fechaIda, 2), fechaIda) : null;
  const personas = Math.max(1, Math.min(9, Number(await preguntar(rl, 'Personas', '1')) || 1));

  const modo = await elegirMenu(rl, 'Medio de transporte', ['Vuelo', 'Autobús']);
  let proveedor;
  if (modo === 'Vuelo') {
    if (!origen.iata || !destino.iata) {
      proveedor = 'Google Flights';
      console.log('Una de las ciudades no tiene IATA. Se usará Google Flights con el nombre de la ciudad.');
    } else {
      proveedor = await elegirMenu(rl, 'Proveedor de vuelos', ['Kayak', 'Google Flights']);
    }
  } else {
    const disponibles = [];
    if (origen.clickbus && destino.clickbus) disponibles.push('ClickBus');
    if (origen.primera_plus_origen && destino.primera_plus_destino) disponibles.push('Primera Plus');
    if (!disponibles.length) {
      console.log('No hay slugs de autobús para esta ruta. Prueba con vuelo o con otras ciudades.');
      return false;
    }
    proveedor = await elegirMenu(rl, 'Proveedor de autobuses', disponibles);
  }

  const { carpeta, capturas, id } = crearCarpeta(origen, destino);
  console.log(`\nCarpeta de la prueba: ${carpeta}`);

  const consulta = {
    origen: { nombre: origen.nombre, iata: origen.iata, estado: origen.estado },
    destino: { nombre: destino.nombre, iata: destino.iata, estado: destino.estado },
    fecha_ida: fechaIda,
    fecha_vuelta: fechaVuelta,
    personas,
    modo,
    proveedor,
  };

  const tramos = [];
  const ida = await buscarTransporte(rl, {
    origen, destino, fecha: fechaIda, modo, proveedor, etapa: 'ida', capturasDir: capturas,
  });
  if (!ida) {
    console.log('No se seleccionó transporte de ida. Prueba cancelada.');
    return false;
  }
  tramos.push(ida);

  if (fechaVuelta) {
    const vuelta = await buscarTransporte(rl, {
      origen: destino, destino: origen, fecha: fechaVuelta, modo, proveedor, etapa: 'vuelta', capturasDir: capturas,
    });
    if (!vuelta) {
      console.log('No se seleccionó transporte de vuelta. Prueba cancelada.');
      return false;
    }
    tramos.push(vuelta);
  }

  const nochesSugeridas = fechaVuelta ? Math.max(0, diferenciaDias(fechaIda, fechaVuelta)) : 1;
  const noches = Math.max(0, Number(await preguntar(rl, 'Noches de hotel (0 = sin hotel)', String(nochesSugeridas))) || 0);
  let hotel = null;
  if (noches > 0) {
    hotel = await buscarHotel(rl, {
      destino,
      checkin: fechaIda,
      checkout: sumarDias(fechaIda, noches),
      noches,
      capturasDir: capturas,
    });
    if (!hotel) {
      console.log('No se seleccionó hotel. La cotización se guardará sin hospedaje.');
    }
  }

  const cotizacion = generarCotizacion({ id, carpeta, consulta, tramos, hotel });
  console.log('\n' + '='.repeat(78));
  console.log('COTIZACIÓN GUARDADA');
  console.log(`  Carpeta: ${carpeta}`);
  console.log(`  Total:   ${mxn(cotizacion.totales.total)} MXN`);
  console.log(`  JSON:    ${path.join(carpeta, 'cotizacion.json')}`);
  console.log(`  TXT:     ${path.join(carpeta, 'cotizacion.txt')}`);
  console.log(`  Capturas: ${capturas}`);
  console.log('='.repeat(78));
  return true;
}

async function demo(modo = 'Vuelo', proveedorDemo = null) {
  const esVuelo = modo === 'Vuelo';
  const proveedor = proveedorDemo ?? (esVuelo ? 'Kayak' : 'ClickBus');
  console.log(`MODO DEMO: CDMX → Guadalajara, ida y vuelta, ${esVuelo ? 'vuelo con Kayak' : `autobús con ${proveedor}`} y hotel con Booking.com.`);
  const origen = buscarCiudad('CDMX');
  const destino = buscarCiudad('GDL');
  const fechaIda = sumarDias(hoyISO(), 7);
  const fechaVuelta = sumarDias(fechaIda, 2);
  const { carpeta, capturas, id } = crearCarpeta(origen, destino);
  const consulta = {
    origen: { nombre: origen.nombre, iata: origen.iata, estado: origen.estado },
    destino: { nombre: destino.nombre, iata: destino.iata, estado: destino.estado },
    fecha_ida: fechaIda,
    fecha_vuelta: fechaVuelta,
    personas: 1,
    modo,
    proveedor,
  };
  const tramos = [];
  for (const [etapa, o, d, fecha] of [['ida', origen, destino, fechaIda], ['vuelta', destino, origen, fechaVuelta]]) {
    const { context, page } = await nuevaPagina();
    try {
      const resultado = esVuelo
        ? await buscarVuelosKayak(page, o, d, fecha)
        : proveedor === 'Primera Plus'
          ? await buscarBusesPrimeraPlus(page, o, d, fecha)
          : await buscarBusesClickBus(page, o, d, fecha);
      const capturaOpciones = await capturar(page, capturas, `${etapa}-opciones.png`);
      if (!resultado.opciones.length) {
        console.log(`DEMO: sin opciones de ${etapa}.`);
        return false;
      }
      const elegida = resultado.opciones.find((o) => !/patrocinado/i.test(o.notas ?? '')) ?? resultado.opciones[0];
      const capturaElegido = await capturarElegido(page, elegida.texto_busqueda, capturas, `${etapa}-elegido.png`);
      tramos.push({
        tipo: esVuelo ? 'vuelo' : 'autobus', proveedor, sentido: etapa, ...elegida,
        link: resultado.link,
        disponibilidad: resultado.disponibilidad.estado,
        disponibilidad_detalle: resultado.disponibilidad.detalle,
        capturas: [capturaOpciones, capturaElegido],
      });
      console.log(`DEMO ${etapa}: ${elegida.linea} ${elegida.salida}-${elegida.llegada} ${mxn(elegida.precio)} (${resultado.disponibilidad.detalle})`);
    } finally {
      await context.close();
    }
  }
  const { context, page } = await nuevaPagina();
  let hotel = null;
  try {
    const resultado = await buscarHotelesBooking(page, destino, fechaIda, fechaVuelta);
    const capturaOpciones = await capturar(page, capturas, 'hotel-opciones.png');
    if (resultado.opciones.length) {
      const elegido = resultado.opciones[0];
      const capturaElegido = await capturarElegido(page, elegido.texto_busqueda, capturas, 'hotel-elegido.png');
      hotel = {
        proveedor: 'Booking.com', ...elegido,
        checkin: fechaIda, checkout: fechaVuelta, noches: diferenciaDias(fechaIda, fechaVuelta),
        link: resultado.link,
        disponibilidad: resultado.disponibilidad.estado,
        disponibilidad_detalle: resultado.disponibilidad.detalle,
        capturas: [capturaOpciones, capturaElegido],
      };
      console.log(`DEMO hotel: ${elegido.nombre} ${mxn(elegido.precio_noche)}/noche (${resultado.disponibilidad.detalle})`);
    }
  } finally {
    await context.close();
  }
  const cotizacion = generarCotizacion({ id, carpeta, consulta, tramos, hotel });
  console.log(`\nDEMO guardada en: ${carpeta}`);
  console.log(`Total: ${mxn(cotizacion.totales.total)} MXN`);
  return true;
}
async function main() {
  await iniciarNavegador();
  if (DEMO || DEMO_BUS || DEMO_PP) {
    const modo = DEMO ? 'Vuelo' : 'Autobús';
    const proveedorDemo = DEMO_PP ? 'Primera Plus' : null;
    const ok = await demo(modo, proveedorDemo);
    await cerrarNavegador();
    process.exitCode = ok ? 0 : 1;
    return;
  }
  const rl = readline.createInterface({ input, output });
  try {
    let otra = true;
    while (otra) {
      const ok = await flujoInteractivo(rl);
      if (!ok) {
        otra = await preguntarSiNo(rl, '¿Intentar otra prueba?', true);
        continue;
      }
      otra = await preguntarSiNo(rl, '¿Hacer otra prueba?', false);
    }
  } finally {
    rl.close();
    await cerrarNavegador();
  }
}

process.on('SIGINT', async () => {
  console.log('\nSaliendo...');
  await cerrarNavegador();
  process.exit(0);
});

main().catch(async (error) => {
  console.error(`\nError fatal: ${error instanceof Error ? error.stack : String(error)}`);
  await cerrarNavegador();
  process.exit(1);
});

