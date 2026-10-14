#!/usr/bin/env node
/**
 * captura-viaticos.mjs
 *
 * Captura pantallas PNG de URLs de compra (vuelos / hoteles) con Playwright
 * headless. Pensado para T7 del plan costos-ruta-demo: el wizard de viáticos
 * necesita una imagen "para ir a comprar de inmediato" por cada opción de la
 * tabla. T8 expone este script como endpoint.
 *
 * Uso:
 *   # argv:
 *   node scripts/captura-viaticos.mjs '[{"url":"https://example.com","nombre":"ej"}]'
 *   # stdin:
 *   echo '[{"url":"...","nombre":"..."}]' | node scripts/captura-viaticos.mjs
 *
 * Salida:
 *   - PNGs: <repo>/lefarma.frontend/public/capturas/viaticos/<nombre>.png
 *   - JSON en stdout con un objeto por URL procesada (incluso si ok:false).
 *   - exit 0 SIEMPRE: los fallos van en el JSON, nunca como throw.
 *
 * Limites:
 *   - Maximo 10 URLs por invocacion. Si se reciben mas, devuelve error de
 *     validacion en el JSON sin intentar ninguna.
 *   - Maximo 2 capturas en paralelo.
 *   - Timeout 30s por goto (networkidle); 1500ms extra para estabilizar JS tardio.
 *   - Timeout duro de proceso: 55s (si algo se cuelga, el proceso se mata solo).
 *
 * Lista blanca (whitelist):
 *   - Lista de dominios permitidos para evitar scraping agresivo a OTAs y
 *     aerolineas (booking.com, expedia.com, etc.).
 *   - Es OPCIONAL: vacia por defecto no se exige pertenencia, pero el esquema
 *     http/https, los dominios prohibidos y los destinos internos se validan
 *     igual (ver HARD_BANNED_DOMAINS). Con lista vacia cada captura lleva un
 *     aviso en el campo `error`.
 *   - En produccion poblar con dominios oficiales de transportistas publicos.
 *     Ejemplo: 'aerolineas.gov.co', 'avianca.com', 'latam.com'.
 */

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { isIP } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ------------------------------------------------------------------
// Configuracion: lista blanca de transportistas publicos.
// Opcional: vacia por defecto no se exige pertenencia, pero el esquema y
// los dominios prohibidos se validan siempre. Poblar antes de produccion.
// ------------------------------------------------------------------
const WHITELIST_DOMAINS = Object.freeze([
  // 'avianca.com',
  // 'latam.com',
  // 'aerolineas.gov.co',
]);

// Se aplican aunque la lista blanca este vacia (misma regla que
// CapturasService.HardBannedDomains en el backend).
const HARD_BANNED_DOMAINS = Object.freeze(['booking.com', 'expedia.com']);

const ALLOWED_URL_SCHEMES = Object.freeze(['http:', 'https:']);

// Destinos de intranet que el navegador del servidor no debe abrir. Misma
// regla que CapturasService.IsInternalDestination en el backend: loopback,
// link-local (169.254.169.254 = metadata de la nube), RFC1918, CGNAT,
// IPv6 loopback/ULA/link-local y los sufijos de intranet.
const INTERNAL_HOST_SUFFIXES = Object.freeze(['.localhost', '.local', '.internal']);

const WHITELIST_EMPTY_WARNING =
  'WARN: lista blanca de dominios vacia; poblar antes de pasar a produccion';

const MAX_URLS = 10;
const MAX_CONCURRENCY = 2;
const PAGE_TIMEOUT_MS = 30_000;
const POST_LOAD_DELAY_MS = 1500;
const HARD_PROCESS_TIMEOUT_MS = 55_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = join(FRONTEND_ROOT, 'public', 'capturas', 'viaticos');
const OUTPUT_PUBLIC_PATH = 'capturas/viaticos';

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
export function sanitizeName(name) {
  if (typeof name !== 'string') return null;
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) return null;
  return cleaned;
}

export function normalizeHost(hostname) {
  return String(hostname).toLowerCase().replace(/^www\./, '');
}

export function isWhitelistEmpty() {
  return WHITELIST_DOMAINS.length === 0;
}

export function hostIsBanned(host) {
  return HARD_BANNED_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
}

export function isBlockedIpv4(host) {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const n = parts.map((p) => (p === '' ? NaN : Number(p)));
  if (n.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return false;
  const [a, b] = n;
  if (a === 0) return true;                                  // 0.0.0.0/8
  if (a === 10) return true;                                 // 10.0.0.0/8
  if (a === 127) return true;                                // 127.0.0.0/8
  if (a === 169 && b === 254) return true;                   // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true;          // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                   // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true;         // 100.64.0.0/10 CGNAT
  return false;
}

export function isBlockedIpv6(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (mapped) return isBlockedIpv4(mapped[1]);

  const hextets = h.split(':').filter((x) => x !== '').map((x) => parseInt(x, 16));
  if (!hextets.length || hextets.some((v) => !Number.isInteger(v))) return false;

  // IPv4 mapeado (::ffff:a.b.c.d, que URL normaliza a ::ffff:7f00:1): se
  // valida como IPv4 para no esquivar el bloqueo de loopback.
  if (hextets.length >= 3 && hextets[hextets.length - 3] === 0xffff) {
    const hi = hextets[hextets.length - 2];
    const lo = hextets[hextets.length - 1];
    return isBlockedIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
  }

  // ::1 loopback (incluye 0:0:0:0:0:0:0:1) y :: unspecified
  if (hextets.every((v) => v === 0)) return true;
  if (hextets[hextets.length - 1] === 1 && hextets.slice(0, -1).every((v) => v === 0)) return true;

  const first = hextets[0];
  return (first & 0xfe00) === 0xfc00    // fc00::/7 ULA
    || (first & 0xffc0) === 0xfe80     // fe80::/10 link-local
    || (first & 0xffc0) === 0xfec0;    // fec0::/10 site-local
}

export function isInternalHost(hostname) {
  const host = normalizeHost(hostname);
  if (host === 'localhost') return true;
  if (INTERNAL_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  // URL.hostname devuelve los IPv6 entre corchetes: [::1] -> ::1.
  const bare = host.replace(/^\[|\]$/g, '');
  if (isIP(bare) === 4) return isBlockedIpv4(bare);
  if (isIP(bare) === 6) return isBlockedIpv6(bare);
  return false; // nombre sin resolver: no se hace DNS aqui
}

// Devuelve null si la URL es aceptable, o el motivo del rechazo.
// Nunca devuelve true solo por tener la lista blanca vacia: con lista vacia
// se siguen validando esquema http/https, dominios prohibidos y destinos
// internos.
export function urlRejectionReason(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return 'URL invalida o vacia';
  }
  if (!ALLOWED_URL_SCHEMES.includes(u.protocol)) {
    return `esquema no permitido (solo http/https): ${u.protocol}`;
  }
  const host = normalizeHost(u.hostname);
  if (hostIsBanned(host)) {
    return `dominio prohibido por plan (scraping no permitido): ${host}`;
  }
  if (isInternalHost(host)) {
    return `destino interno o privado no permitido: ${host}`;
  }
  if (!isWhitelistEmpty()) {
    const inWhitelist = WHITELIST_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
    if (!inWhitelist) return 'dominio no esta en la lista blanca';
  }
  return null;
}

async function readInput() {
  // 1) argv[2]
  if (process.argv.length >= 3 && process.argv[2].trim() !== '') {
    return process.argv[2];
  }
  // 2) stdin (si no es TTY)
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return null;
}

function warnSuffix() {
  return isWhitelistEmpty() ? `; ${WHITELIST_EMPTY_WARNING}` : '';
}

async function captureOne(browser, item) {
  const rawUrl = item?.url;
  const safeName = sanitizeName(item?.nombre);

  if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
    return { url: rawUrl ?? null, ok: false, archivo: null, error: 'URL invalida o vacia' };
  }
  if (!safeName) {
    return {
      url: rawUrl,
      ok: false,
      archivo: null,
      error: 'nombre invalido (solo caracteres [a-zA-Z0-9_-])',
    };
  }
  const urlRejection = urlRejectionReason(rawUrl);
  if (urlRejection) {
    return { url: rawUrl, ok: false, archivo: null, error: urlRejection };
  }

  const ctx = await browser.newContext();
  let ctxClosed = false;
  try {
    const page = await ctx.newPage();
    try {
      await page.goto(rawUrl, { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT_MS });
      await page.waitForTimeout(POST_LOAD_DELAY_MS);
      const outPath = join(OUTPUT_DIR, `${safeName}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      return {
        url: rawUrl,
        ok: true,
        archivo: `${OUTPUT_PUBLIC_PATH}/${safeName}.png`,
        error: isWhitelistEmpty() ? WHITELIST_EMPTY_WARNING : null,
      };
    } finally {
      try { await page.close(); } catch { /* ignore */ }
    }
  } catch (e) {
    return {
      url: rawUrl,
      ok: false,
      archivo: null,
      error: (e?.message ?? String(e)) + warnSuffix(),
    };
  } finally {
    if (!ctxClosed) {
      try { await ctx.close(); ctxClosed = true; } catch { /* ignore */ }
    }
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await worker(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// ------------------------------------------------------------------
// main
// ------------------------------------------------------------------
export async function main() {
  const raw = await readInput();

  if (!raw || raw.trim() === '') {
    process.stdout.write(
      JSON.stringify([
        {
          url: null,
          ok: false,
          archivo: null,
          error: 'no se recibio JSON de entrada (argv[2] o stdin)',
        },
      ]) + '\n',
    );
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(
      JSON.stringify([
        {
          url: null,
          ok: false,
          archivo: null,
          error: `JSON invalido: ${e?.message ?? String(e)}`,
        },
      ]) + '\n',
    );
    return;
  }

  if (!Array.isArray(parsed)) {
    process.stdout.write(
      JSON.stringify([
        {
          url: null,
          ok: false,
          archivo: null,
          error: 'la entrada debe ser un array JSON de objetos {url, nombre}',
        },
      ]) + '\n',
    );
    return;
  }

  if (parsed.length > MAX_URLS) {
    process.stdout.write(
      JSON.stringify([
        {
          url: null,
          ok: false,
          archivo: null,
          error: `demasiadas URLs (recibidas ${parsed.length}, maximo ${MAX_URLS})`,
        },
      ]) + '\n',
    );
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  // Hard process timeout: si algo se cuelga, matamos el proceso en <=60s.
  const hardTimer = setTimeout(() => {
    process.stdout.write(
      JSON.stringify([
        {
          url: null,
          ok: false,
          archivo: null,
          error: `proceso excedio el tiempo maximo (${HARD_PROCESS_TIMEOUT_MS}ms); posible captura colgada`,
        },
      ]) + '\n',
    );
    // Forzar salida dura (los hijos Chromium quedaran huerfanos y el SO los
    // limpia; peor caso aceptable para garantizar exit 0 y tiempo maximo).
    process.exit(0);
  }, HARD_PROCESS_TIMEOUT_MS);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const results = await runWithConcurrency(parsed, MAX_CONCURRENCY, (item) =>
      captureOne(browser, item),
    );
    process.stdout.write(JSON.stringify(results) + '\n');
  } catch (e) {
    process.stdout.write(
      JSON.stringify([
        {
          url: null,
          ok: false,
          archivo: null,
          error: `error iniciando Chromium: ${e?.message ?? String(e)}`,
        },
      ]) + '\n',
    );
  } finally {
    clearTimeout(hardTimer);
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

// Solo se ejecuta cuando este archivo es el punto de entrada del proceso
// (`node scripts/captura-viaticos.mjs ...`). Importarlo desde un test o
// desde otro modulo NO dispara el navegador ni lee argv.
function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    if (pathToFileURL(entry).href === import.meta.url) return true;
  } catch { /* ignore */ }
  try {
    return realpathSync(entry) === realpathSync(__filename);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((e) => {
    // Ultimo recurso: nunca throw, siempre exit 0 con un JSON de error.
    try {
      process.stdout.write(
        JSON.stringify([
          {
            url: null,
            ok: false,
            archivo: null,
            error: `error fatal: ${e?.message ?? String(e)}`,
          },
        ]) + '\n',
      );
    } catch { /* ignore */ }
  });
}