// Navegador compartido + cola de capturas (una sola instancia de Chromium).
import { chromium } from 'playwright';

const MAX_CONCURRENCIA = Math.max(1, Number(process.env.MAX_CONCURRENCIA || 2));
const USER_AGENT =
  process.env.USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

let promesaNavegador = null;
let activos = 0;
const cola = [];

async function navegador() {
  if (!promesaNavegador) {
    promesaNavegador = chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--lang=es-MX',
      ],
    });
    promesaNavegador.catch(() => {
      promesaNavegador = null;
    });
  }
  return promesaNavegador;
}

export function estadoNavegador() {
  return {
    lanzado: Boolean(promesaNavegador),
    activos,
    en_cola: cola.length,
    max_concurrencia: MAX_CONCURRENCIA,
  };
}

export async function cerrarNavegador() {
  if (!promesaNavegador) return;
  const navegadorActual = await promesaNavegador.catch(() => null);
  promesaNavegador = null;
  if (navegadorActual) await navegadorActual.close().catch(() => {});
}

export async function calentarNavegador() {
  try {
    await navegador();
    return true;
  } catch (error) {
    console.error('[captura] no se pudo lanzar Chromium:', error.message);
    return false;
  }
}

function encolar(trabajo) {
  return new Promise((resolver, rechazar) => {
    cola.push({ trabajo, resolver, rechazar });
    despachar();
  });
}

function despachar() {
  while (activos < MAX_CONCURRENCIA && cola.length > 0) {
    const elemento = cola.shift();
    activos += 1;
    (async () => {
      try {
        const navegadorActual = await navegador();
        elemento.resolver(await elemento.trabajo(navegadorActual));
      } catch (error) {
        elemento.rechazar(error);
      } finally {
        activos -= 1;
        despachar();
      }
    })();
  }
}

function dimensionesPng(buffer) {
  if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20) };
  }
  return { ancho: null, alto: null };
}

/**
 * Toma una captura de pantalla de una URL publica.
 * @param {object} opciones
 * @param {string} opciones.url
 * @param {string} [opciones.esperar_texto] texto a esperar en el body (hasta 25 s)
 * @param {string} [opciones.selector] selector CSS a esperar (hasta 15 s)
 * @param {number} [opciones.esperar_ms] espera extra tras cargar (por defecto 2500)
 * @param {boolean} [opciones.full_page] captura de pagina completa
 * @param {number} [opciones.ancho] viewport, por defecto 1440
 * @param {number} [opciones.alto] viewport, por defecto 1000
 * @param {string[]} [opciones.quitar] selectores CSS a ocultar antes de capturar
 */
export async function capturar(opciones) {
  const {
    url,
    esperar_texto = null,
    selector = null,
    esperar_ms = 2500,
    full_page = false,
    ancho = 1440,
    alto = 1000,
    quitar = [],
  } = opciones;

  return encolar(async (navegadorActual) => {
    const inicio = Date.now();
    const advertencias = [];
    const errores = [];
    const contexto = await navegadorActual.newContext({
      viewport: {
        width: Math.min(Math.max(Number(ancho) || 1440, 320), 2560),
        height: Math.min(Math.max(Number(alto) || 1000, 240), 3000),
      },
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      userAgent: USER_AGENT,
    });
    const pagina = await contexto.newPage();
    pagina.on('pageerror', (error) => {
      const mensaje = String(error?.message || error).slice(0, 180);
      if (errores.length < 5) errores.push(mensaje);
    });
    try {
      await pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (esperar_texto) {
        try {
          await pagina.waitForFunction(
            (texto) => Boolean(document.body) && document.body.innerText.includes(texto),
            esperar_texto,
            { timeout: 25000 },
          );
        } catch {
          advertencias.push(`No aparecio el texto "${esperar_texto}" en 25 s`);
        }
      }
      if (selector) {
        try {
          await pagina.waitForSelector(selector, { timeout: 15000 });
        } catch {
          advertencias.push(`No aparecio el selector "${selector}" en 15 s`);
        }
      }
      const espera = Math.min(Math.max(Number(esperar_ms) || 0, 0), 15000);
      if (espera > 0) await pagina.waitForTimeout(espera);
      if (Array.isArray(quitar) && quitar.length > 0) {
        await pagina
          .addStyleTag({ content: `${quitar.join(',')}{display:none !important;}` })
          .catch(() => null);
      }
      const png = await pagina.screenshot({ fullPage: Boolean(full_page), type: 'png' });
      const titulo = await pagina.title().catch(() => '');
      const dimensiones = dimensionesPng(png);
      return {
        png,
        titulo: titulo || '',
        ancho: dimensiones.ancho,
        alto: dimensiones.alto,
        ms: Date.now() - inicio,
        advertencias,
        errores,
      };
    } finally {
      await contexto.close().catch(() => {});
    }
  });
}
