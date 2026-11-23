/**
 * Configuración del SDK de telemetría. Todo se puede apagar sin tocar código:
 * `VITE_TELEMETRIA_ACTIVA=false` en el build, `?autotest=true` en la URL,
 * `localStorage['telemetria:off'] = '1'` en el equipo, o la cabecera DNT.
 */

const RUTAS_EXCLUIDAS = [
  '/login',
  '/perfil',
  '/perfil/configuracion',
  '/configuracion',
  '/rh/sueldos',
  '/rh/documentos',
];

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const RUTAS_SIN_CAPTURA = RUTAS_EXCLUIDAS;

/** Tope del lote que acepta el backend (100 eventos / 256 KB; usamos 48 KB de margen). */
export const MAXIMO_EVENTOS_LOTE = 100;
export const TAMANO_MAXIMO_LOTE_BYTES = 48 * 1024;

export const INTERVALO_ENVIO_MS = 15_000;
export const MAXIMO_PENDIENTES = 5_000;
export const DIAS_RETENCION = 7;

export const TAMANO_CELDA_PX = 32;
export const INTERVALO_PUNTERO_MS = 100;
export const MAXIMO_EVENTOS_EN_MEMORIA = 200;

function leerBooleano(valor: unknown, porDefecto: boolean): boolean {
  if (valor === undefined || valor === null || valor === '') {
    return porDefecto;
  }
  return !['0', 'false', 'no', 'off'].includes(String(valor).toLowerCase());
}

function prefiereNoRastrear(): boolean {
  const dnt =
    navigator.doNotTrack ??
    (window as unknown as { doNotTrack?: string | null }).doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

function estaEnAutotest(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('autotest') === 'true';
  } catch {
    return false;
  }
}

function estaApagadaPorElUsuario(): boolean {
  try {
    return localStorage.getItem('telemetria:off') === '1';
  } catch {
    return false;
  }
}

/** `?telemetria=off` permite mostrar la app dentro de un iframe (mapa de calor) sin que se retroalimente. */
function estaApagadaPorUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('telemetria') === 'off';
  } catch {
    return false;
  }
}

export const TELEMETRIA_ACTIVA =
  leerBooleano(import.meta.env.VITE_TELEMETRIA_ACTIVA, true) &&
  !estaEnAutotest() &&
  !estaApagadaPorUrl() &&
  !prefiereNoRastrear() &&
  !estaApagadaPorElUsuario();

export function rutaActual(): string {
  return normalizarRuta(window.location.pathname);
}

export function normalizarRuta(ruta: string): string {
  const limpia = ruta.split('?')[0].trim();
  if (!limpia.startsWith('/')) {
    return `/${limpia}`;
  }
  return limpia.length > 512 ? limpia.slice(0, 512) : limpia;
}

export function rutaExcluida(ruta: string): boolean {
  const normalizada = normalizarRuta(ruta).toLowerCase();
  return RUTAS_SIN_CAPTURA.some(
    (excluida) =>
      normalizada === excluida || normalizada.startsWith(`${excluida}/`),
  );
}

export function navegadorResumido(): string {
  const agente = navigator.userAgent;
  const navegador = /Edg\//.test(agente)
    ? 'Edge'
    : /Firefox\//.test(agente)
      ? 'Firefox'
      : /Chrome\//.test(agente)
        ? 'Chrome'
        : /Safari\//.test(agente)
          ? 'Safari'
          : 'Otro';
  const sistema = /Windows/.test(agente)
    ? 'Windows'
    : /Android/.test(agente)
      ? 'Android'
      : /iPhone|iPad/.test(agente)
        ? 'iOS'
        : /Mac OS X/.test(agente)
          ? 'macOS'
          : /Linux/.test(agente)
            ? 'Linux'
            : 'Otro';
  return `${navegador} · ${sistema}`;
}
