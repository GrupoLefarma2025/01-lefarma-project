import {
  INTERVALO_PUNTERO_MS,
  TAMANO_CELDA_PX,
  TELEMETRIA_ACTIVA,
  rutaActual,
  rutaExcluida,
} from './config';
import { encolar } from './colaEventos';
import { pedirEnvio } from './emisor';

/**
 * Mapa de calor agregado en el navegador. No se envía ni un solo movimiento: se
 * cuenta en celdas de 32 px por visita de página y se manda como una rejilla de
 * enteros cada 30 segundos, al ocultar la pestaña o al cambiar de ruta.
 *
 * Es una aproximación de dónde está el puntero, no de dónde mira la persona.
 */

const MAXIMO_COLUMNAS = 80;
const MAXIMO_FILAS = 400;
const INTERVALO_EMISION_MS = 30_000;

interface EstadoMapa {
  ruta: string;
  columnas: number;
  filas: number;
  celdas: Int32Array;
  movimientos: number;
  inicio: number;
  scrollMax: number;
  ultimoMovimiento: number;
}

let estado: EstadoMapa | null = null;
let temporizador: number | null = null;

function dimensiones(): { columnas: number; filas: number } {
  const columnas = Math.min(
    MAXIMO_COLUMNAS,
    Math.max(1, Math.ceil(window.innerWidth / TAMANO_CELDA_PX)),
  );
  const alto = Math.max(
    document.documentElement.scrollHeight,
    window.innerHeight,
  );
  const filas = Math.min(
    MAXIMO_FILAS,
    Math.max(1, Math.ceil(alto / TAMANO_CELDA_PX)),
  );
  return { columnas, filas };
}

function reiniciar(): EstadoMapa | null {
  const ruta = rutaActual();
  if (rutaExcluida(ruta)) {
    estado = null;
    return null;
  }

  const { columnas, filas } = dimensiones();
  estado = {
    ruta,
    columnas,
    filas,
    celdas: new Int32Array(columnas * filas),
    movimientos: 0,
    inicio: Date.now(),
    scrollMax: window.scrollY,
    ultimoMovimiento: 0,
  };
  return estado;
}

function manejarPuntero(evento: PointerEvent): void {
  if (!TELEMETRIA_ACTIVA || !estado || document.visibilityState === 'hidden') {
    return;
  }

  const ahora = Date.now();
  if (ahora - estado.ultimoMovimiento < INTERVALO_PUNTERO_MS) {
    return;
  }
  estado.ultimoMovimiento = ahora;

  const columna = Math.min(
    estado.columnas - 1,
    Math.max(0, Math.floor(evento.clientX / TAMANO_CELDA_PX)),
  );
  const fila = Math.min(
    estado.filas - 1,
    Math.max(0, Math.floor((window.scrollY + evento.clientY) / TAMANO_CELDA_PX)),
  );
  const indice = fila * estado.columnas + columna;
  if (estado.celdas[indice] < 100_000) {
    estado.celdas[indice] += 1;
    estado.movimientos += 1;
  }
}

function actualizarScroll(): void {
  if (estado && window.scrollY > estado.scrollMax) {
    estado.scrollMax = window.scrollY;
  }
}

function emitir(actual: EstadoMapa | null): void {
  if (!actual || actual.movimientos === 0 || !TELEMETRIA_ACTIVA) {
    return;
  }

  void encolar({
    tipo: 'mapa_calor',
    ocurridoEn: new Date().toISOString(),
    ruta: actual.ruta,
    celdas: Array.from(actual.celdas),
    columnas: actual.columnas,
    filas: actual.filas,
    tamanoCelda: TAMANO_CELDA_PX,
    viewportAncho: window.innerWidth,
    viewportAlto: window.innerHeight,
    scrollMax: Math.round(actual.scrollMax),
    segundosVisibles: Math.round((Date.now() - actual.inicio) / 1000),
  });
  pedirEnvio();
}

function revisar(): void {
  if (!estado) {
    reiniciar();
    return;
  }

  if (rutaActual() !== estado.ruta) {
    emitir(estado);
    reiniciar();
    return;
  }

  if (Date.now() - estado.inicio >= INTERVALO_EMISION_MS) {
    emitir(estado);
    reiniciar();
  }
}

export function iniciarMapaCalor(): void {
  if (!TELEMETRIA_ACTIVA) {
    return;
  }

  reiniciar();
  window.addEventListener('pointermove', manejarPuntero, { passive: true });
  window.addEventListener('scroll', actualizarScroll, { passive: true });
  window.addEventListener('resize', actualizarScroll, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      emitir(estado);
      reiniciar();
    }
  });

  temporizador = window.setInterval(revisar, INTERVALO_EMISION_MS);
}

export function detenerMapaCalor(): void {
  if (temporizador !== null) {
    window.clearInterval(temporizador);
    temporizador = null;
  }
  window.removeEventListener('pointermove', manejarPuntero);
  window.removeEventListener('scroll', actualizarScroll);
  window.removeEventListener('resize', actualizarScroll);
}
