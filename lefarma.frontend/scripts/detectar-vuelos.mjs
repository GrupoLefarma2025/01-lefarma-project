/**
 * detectar-vuelos.mjs
 *
 * Intento 1 de detección automática de precio de vuelo: abre Kayak con el
 * Chromium completo de Playwright, espera a que pinte los resultados y
 * devuelve las tarjetas de texto (el backend las parsea). No usa un LLM.
 *
 * Entrada (argv[2] o stdin): { "url": "...", "nombre": "viaje31-op108-auto" }
 * Salida (stdout, SIEMPRE exit 0):
 *   { ok, archivo, tarjetas: string[], bloqueado, error }
 *
 * Si Kayak responde con captcha, el backend cae al respaldo Firecrawl.
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
const RESULT_WAIT_MS = 15_000;
const HARD_PROCESS_TIMEOUT_MS = 55_000;

function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || null;
}

function salida(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n');
}

async function readInput() {
  if (process.argv.length >= 3 && process.argv[2].trim() !== '') {
    return process.argv[2];
  }
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
    return 'Kayak pidió verificación de seguridad (captcha).';
  }
  if (/access denied|forbidden|403 forbidden/i.test(t)) {
    return 'Kayak bloqueó el acceso.';
  }
  if (t.trim().length < 80) {
    return 'Kayak devolvió una página vacía.';
  }
  return null;
}

async function lanzarNavegador() {
  const intentos = [
    { headless: true, channel: 'chromium' },
    { headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
    { headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
  ];
  let ultimoError = null;
  for (const opciones of intentos) {
    try {
      return await chromium.launch({ ...opciones, args: ['--disable-blink-features=AutomationControlled'] });
    } catch (error) {
      ultimoError = error;
    }
  }
  throw ultimoError ?? new Error('No se pudo iniciar Chromium');
}

async function extraerTarjetas(page) {
  const leer = async (selector) =>
    page.$$eval(selector, (els) =>
      els
        .map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    );

  let tarjetas = await leer('.Fxw9-result-item-container');
  if (tarjetas.length === 0) tarjetas = await leer('[data-resultid]');

  if (tarjetas.length === 0) {
    // Respaldo genérico: bloques que tengan hora de salida/llegada y precio.
    tarjetas = await page.evaluate(() => {
      const vistas = new Set();
      const salida = [];
      for (const el of document.querySelectorAll('div')) {
        const texto = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (texto.length < 30 || texto.length > 1500) continue;
        if (!/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/.test(texto)) continue;
        if (!/\$[\d,]/.test(texto)) continue;
        if (vistas.has(texto)) continue;
        vistas.add(texto);
        salida.push(texto);
      }
      return salida.slice(0, 20);
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
  try {
    input = JSON.parse(raw);
  } catch (error) {
    salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: `JSON inválido: ${error?.message ?? error}` });
    return;
  }

  const url = typeof input?.url === 'string' ? input.url : '';
  const nombre = sanitizeName(input?.nombre);
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
      viewport: { width: 1440, height: 1000 },
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      userAgent,
    });
    const page = await contexto.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      await page.waitForTimeout(RESULT_WAIT_MS);
      const texto = await page.evaluate(() => document.body?.innerText ?? '');
      const errorPagina = errorDePagina(texto);
      if (errorPagina) {
        salida({ ok: false, archivo: null, tarjetas: [], bloqueado: true, error: errorPagina });
        return;
      }

      const tarjetas = await extraerTarjetas(page);
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
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

main().catch((error) => {
  salida({ ok: false, archivo: null, tarjetas: [], bloqueado: false, error: `error fatal: ${error?.message ?? error}` });
});
