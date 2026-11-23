/**
 * detectar-pagina.mjs
 *
 * Detección genérica para opciones que no son vuelos (autobús y hotel):
 * abre la URL con Playwright, aplica fechas en Google Hotels cuando aplica y
 * devuelve las tarjetas de texto. El backend decide el precio con un parser
 * por tipo; este script no inventa precios.
 *
 * Entrada: { url, nombre, tipo: "autobus"|"hotel", checkin?, checkout? }
 * Salida:  { ok, archivo, tarjetas: string[], bloqueado, error }
 */

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = join(FRONTEND_ROOT, 'public', 'capturas', 'viaticos');
const OUTPUT_PUBLIC_PATH = 'capturas/viaticos';

const PAGE_TIMEOUT_MS = 45_000;
const HARD_PROCESS_TIMEOUT_MS = 70_000;
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || null;
}

function salida(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

async function readInput() {
  if (process.argv.length >= 3 && process.argv[2].trim() !== '') return process.argv[2];
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return null;
}

function errorDePagina(texto) {
  const t = String(texto ?? '');
  if (/verificaci[oó]n de seguridad|no soy un robot|captcha|are you a person or a robot|tr[aá]fico inusual|unusual traffic/i.test(t)) {
    return 'El sitio pidió verificación de seguridad (captcha).';
  }
  if (/access denied|forbidden|403 forbidden/i.test(t)) return 'El sitio bloqueó el acceso.';
  if (/error 500|se produjo un error|error del servidor|internal server error/i.test(t)) {
    return 'Google devolvió un error 500.';
  }
  if (t.trim().length < 80) return 'La página devolvió contenido vacío.';
  return null;
}

async function lanzarNavegador() {
  const intentos = [
    { headless: true, channel: 'chromium' },
    { headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
    { headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
  ];
  let ultimo = null;
  for (const opciones of intentos) {
    try {
      return await chromium.launch({ ...opciones, args: ['--disable-blink-features=AutomationControlled'] });
    } catch (error) {
      ultimo = error;
    }
  }
  throw ultimo ?? new Error('No se pudo iniciar Chromium');
}

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

function fechasEsperadas(fecha) {
  const [anio, mes, dia] = fecha.split('-');
  const nombreMes = MESES_ES[Number(mes) - 1];
  const diaNumero = Number(dia);
  return [
    `${anio}-${mes}-${dia}`,
    `${dia}/${mes}/${anio}`,
    `${diaNumero} ${nombreMes.slice(0, 3)}`,
    `${diaNumero} de ${nombreMes}`,
  ];
}

function contieneFecha(texto, fecha) {
  const t = normalizar(texto);
  return fechasEsperadas(fecha).some((esperada) => t.includes(normalizar(esperada)));
}

function esEtiquetaEntrada(aria) {
  return /registro|fecha de entrada|check-in/i.test(aria ?? '');
}

function esEtiquetaSalida(aria) {
  return /fecha de salida|check-out/i.test(aria ?? '');
}

async function fechasAplicadas(page, checkin, checkout) {
  // Google puede pintar las fechas como value ISO (2026-12-01), como texto
  // humano (1 dic / 1 de diciembre) o dentro de un botón sin input. Se
  // revisan las tres formas antes de abrir el calendario.
  const valores = await page.$$eval('input, [role="button"], [aria-label]', (els) =>
    els.map((e) => ({
      aria: e.getAttribute('aria-label') ?? '',
      value: typeof e.value === 'string' ? e.value : '',
      texto: (e.innerText ?? '').slice(0, 400),
    })));
  const coincide = (v, fecha) =>
    contieneFecha(`${v.aria} ${v.value} ${v.texto}`, fecha);

  const entradaOk = valores.some((v) => esEtiquetaEntrada(v.aria) && coincide(v, checkin));
  const salidaOk = valores.some((v) => esEtiquetaSalida(v.aria) && coincide(v, checkout));
  if (entradaOk && salidaOk) return true;

  // Respaldo: la página muestra las fechas en texto visible aunque no haya
  // un control con aria-label reconocible.
  const textoPagina = await page.evaluate(() => document.body?.innerText ?? '');
  return contieneFecha(textoPagina, checkin) && contieneFecha(textoPagina, checkout);
}

async function fijarFechasGoogleHotels(page, checkin, checkout) {
  try {
    // La URL de Google Hotels ya puede traer checkin/checkout aplicados. En
    // ese caso no se abre el calendario: menos interacción y menos fallos.
    if (await fechasAplicadas(page, checkin, checkout)) return true;

    const registro = page.getByLabel('Registro').first();
    const entrada = (await registro.count())
      ? registro
      : page.getByLabel('Fecha de entrada').first();
    if (!(await entrada.count())) return false;
    await entrada.click();
    await page.waitForTimeout(800);
    const okEntrada = await elegirDiaCalendario(page, checkin);
    await page.waitForTimeout(500);
    const okSalida = await elegirDiaCalendario(page, checkout);
    await page.waitForTimeout(500);
    const listo = page.locator('div[role="dialog"]:visible button').filter({ hasText: 'Listo' }).first();
    if ((await listo.count()) && (await listo.isEnabled())) await listo.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(2500);

    return okEntrada && okSalida && (await fechasAplicadas(page, checkin, checkout));
  } catch {
    return false;
  }
}

async function extraerTarjetas(page, tipo) {
  if (tipo === 'hotel') {
    return page.evaluate(() => {
      const out = [];
      const vistos = new Set();
      for (const el of document.querySelectorAll('div, span')) {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (t.length < 25 || t.length > 500) continue;
        if (!/(MXN|\$)/.test(t)) continue;
        if (vistos.has(t)) continue;
        vistos.add(t);
        out.push(t);
        if (out.length >= 40) break;
      }
      return out;
    });
  }

  const leer = async (selector) =>
    page.$$eval(selector, (els) => els
      .map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean));

  let tarjetas = await leer('.detail-element');
  if (tarjetas.length === 0) tarjetas = await leer('.detail-wrap');
  if (tarjetas.length === 0) {
    tarjetas = await page.evaluate(() => {
      const out = [];
      const vistos = new Set();
      for (const el of document.querySelectorAll('div')) {
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (t.length < 30 || t.length > 900) continue;
        if (!/\d{1,2}:\d{2}/.test(t) || !/\$[\d,]/.test(t)) continue;
        if (vistos.has(t)) continue;
        vistos.add(t);
        out.push(t);
        if (out.length >= 30) break;
      }
      return out;
    });
  }
  return tarjetas;
}

async function main() {
  const raw = await readInput();
  if (!raw || raw.trim() === '') {
    salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: 'sin entrada JSON' });
    return;
  }

  let input;
  try { input = JSON.parse(raw); }
  catch (error) {
    salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: `JSON inválido: ${error?.message ?? error}` });
    return;
  }

  const url = typeof input?.url === 'string' ? input.url : '';
  const nombre = sanitizeName(input?.nombre);
  const tipo = input?.tipo === 'hotel' ? 'hotel' : 'autobus';
  const capturar = input?.capturar !== false;
  if (!/^https?:\/\//i.test(url) || !nombre) {
    salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: 'URL o nombre inválidos' });
    return;
  }

  const hardTimer = setTimeout(() => {
    salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: 'tiempo máximo de detección excedido' });
    process.exit(0);
  }, HARD_PROCESS_TIMEOUT_MS);

  let browser;
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    browser = await lanzarNavegador();
    const version = browser.version().split('.')[0];
    const userAgent =
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
      `(KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
    const contexto = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      userAgent,
    });
    const page = await contexto.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      await page.waitForTimeout(tipo === 'hotel' ? 12000 : 15000);

      // Antes de tocar el calendario se descartan páginas de error (Google
      // responde 500 a algunas búsquedas de hotel concreto).
      const textoInicial = await page.evaluate(() => document.body?.innerText ?? '');
      const errorInicial = errorDePagina(textoInicial);
      if (errorInicial) {
        salida({ ok: false, archivo: null, tarjetas: [], bloqueado: true, error: errorInicial });
        return;
      }

      if (tipo === 'hotel' && input?.checkin && input?.checkout) {
        const fechasOk = await fijarFechasGoogleHotels(page, input.checkin, input.checkout);
        if (!fechasOk) {
          // Si el calendario falló porque Google devolvió un 500, el motivo
          // útil es el error de la página, no el de las fechas.
          const textoFallo = await page.evaluate(() => document.body?.innerText ?? '');
          const errorFallo = errorDePagina(textoFallo);
          salida({
            ok: false,
            archivo: null,
            tarjetas: [],
            bloqueado: Boolean(errorFallo),
            error: errorFallo ?? 'Google Hotels no aplicó las fechas solicitadas.',
          });
          return;
        }
      }

      const texto = await page.evaluate(() => document.body?.innerText ?? '');
      const errorPagina = errorDePagina(texto);
      if (errorPagina) {
        salida({ ok: false, archivo: null, tarjetas: [], bloqueado: true, error: errorPagina });
        return;
      }

      const tarjetas = await extraerTarjetas(page, tipo);
      if (tarjetas.length === 0) {
        salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: 'sin tarjetas de resultados' });
        return;
      }

      const archivo = capturar ? join(OUTPUT_DIR, `${nombre}.png`) : null;
      if (archivo) await page.screenshot({ path: archivo });
      salida({
        ok: true,
        archivo: archivo ? `${OUTPUT_PUBLIC_PATH}/${nombre}.png` : null,
        tarjetas,
        bloqueado: false,
        error: null,
      });
    } finally {
      try { await page.close(); } catch { /* ignore */ }
      try { await contexto.close(); } catch { /* ignore */ }
    }
  } catch (error) {
    salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: error?.message ?? String(error) });
  } finally {
    clearTimeout(hardTimer);
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  }
}

main().catch((error) => {
  salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: `error fatal: ${error?.message ?? error}` });
});
