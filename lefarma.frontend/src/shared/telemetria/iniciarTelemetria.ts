import {
  INTERVALO_ENVIO_MS,
  MAXIMO_EVENTOS_LOTE,
  MAXIMO_PENDIENTES,
  TAMANO_MAXIMO_LOTE_BYTES,
  TELEMETRIA_ACTIVA,
} from './config';
import { instalarCapturaDeClics } from './capturaClics';
import { instalarCapturaDeErrores } from './capturaErrores';
import { descartar, leerPendientes, limpiarViejos, type Pendiente } from './colaEventos';
import { conectarEmisor, pedirEnvio } from './emisor';
import { iniciarMapaCalor } from './mapaCalor';
import { crearLote, enviarLote, obtenerToken } from './transporte';
import type { EventoTelemetria } from './tipos';

/**
 * Arranque del SDK: conecta capturadores y un único bucle de envío. Se llama
 * antes de montar React para que el arranque quede cubierto.
 */

const ESPERA_PRIMER_ENVIO_MS = 3_000;
const ESPERA_TRAS_EVENTO_MS = 2_000;
const MAXIMO_ANONIMO = 5;

let vaciando = false;
let programado: number | null = null;

function tamanoDe(evento: EventoTelemetria): number {
  try {
    return new TextEncoder().encode(JSON.stringify(evento)).length;
  } catch {
    return 512;
  }
}

function construirSeleccion(
  pendientes: Pendiente[],
  conSesion: boolean,
): Pendiente[] {
  const seleccion: Pendiente[] = [];
  let bytes = 0;

  for (const pendiente of pendientes) {
    if (!conSesion) {
      if (seleccion.length >= MAXIMO_ANONIMO) {
        break;
      }
      // El endpoint anónimo solo acepta errores de arranque: es lo único que
      // puede fallar antes de que exista sesión.
      if (
        pendiente.evento.tipo !== 'error' ||
        pendiente.evento.tipoError !== 'arranque'
      ) {
        continue;
      }
    } else if (seleccion.length >= MAXIMO_EVENTOS_LOTE) {
      break;
    }

    const tamano = tamanoDe(pendiente.evento);
    if (
      seleccion.length > 0 &&
      bytes + tamano > TAMANO_MAXIMO_LOTE_BYTES
    ) {
      break;
    }

    seleccion.push(pendiente);
    bytes += tamano;
  }

  return seleccion;
}

async function vaciar(): Promise<void> {
  if (vaciando || !TELEMETRIA_ACTIVA) {
    return;
  }

  vaciando = true;
  try {
    const conSesion = obtenerToken() !== null;
    const pendientes = await leerPendientes(MAXIMO_PENDIENTES);
    const seleccion = construirSeleccion(pendientes, conSesion);

    if (seleccion.length === 0) {
      return;
    }

    const lote = crearLote(seleccion.map((pendiente) => pendiente.evento));
    const resultado = await enviarLote(lote, !conSesion);

    if (resultado === 'aceptado' || resultado === 'rechazado') {
      await descartar(seleccion.map((pendiente) => pendiente.id));
    }

    if (resultado === 'reintentar' || pendientes.length > seleccion.length) {
      programarEnvio(ESPERA_TRAS_EVENTO_MS);
    }
  } catch {
    // Nunca bloquear la aplicación por telemetría.
  } finally {
    vaciando = false;
  }
}

function programarEnvio(esperaMs = ESPERA_TRAS_EVENTO_MS): void {
  if (programado !== null) {
    return;
  }
  programado = window.setTimeout(() => {
    programado = null;
    void vaciar();
  }, esperaMs);
}

export function iniciarTelemetria(): void {
  if (!TELEMETRIA_ACTIVA) {
    return;
  }

  conectarEmisor(() => programarEnvio());
  instalarCapturaDeErrores();
  instalarCapturaDeClics();
  iniciarMapaCalor();

  void limpiarViejos();
  programarEnvio(ESPERA_PRIMER_ENVIO_MS);

  window.setInterval(() => programarEnvio(), INTERVALO_ENVIO_MS);

  // El envío al ocultarse la pestaña es el reemplazo de fetchLater(): con
  // keepalive el navegador deja terminar la petición aunque se cierre.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void vaciar();
    }
  });
  window.addEventListener('pagehide', () => {
    void vaciar();
  });

  pedirEnvio();
}
