import { TELEMETRIA_ACTIVA, navegadorResumido, rutaActual } from './config';
import { encolar } from './colaEventos';
import { pedirEnvio } from './emisor';
import { calcularHuella } from './huella';
import type { TipoError } from './tipos';

/**
 * Captura de errores del navegador: excepciones sueltas, promesas rechazadas,
 * recursos que no cargan, la pantalla que nunca se dibuja y los fallos HTTP que
 * reporta el interceptor. Todos los errores se guardan antes de enviarse.
 */

const ULTIMOS = new Map<string, number>();
const VENTANA_DUPLICADO_MS = 15_000;

export interface DatosError {
  tipoError: TipoError;
  mensaje: string;
  stack?: string;
  url?: string;
  metodoHttp?: string;
  estadoHttp?: number;
  requestId?: string;
  contexto?: string;
}

function recortar(texto: string | undefined, maximo: number): string | undefined {
  if (!texto) {
    return undefined;
  }
  return texto.length > maximo ? texto.slice(0, maximo) : texto;
}

async function registrar(datos: DatosError): Promise<void> {
  if (!TELEMETRIA_ACTIVA) {
    return;
  }

  try {
    const ruta = rutaActual();
    const mensaje = (datos.mensaje || 'Error sin mensaje').slice(0, 2048);
    const stack = recortar(datos.stack, 16_384);
    const huella = calcularHuella(datos.tipoError, mensaje, stack, ruta);

    const ahora = Date.now();
    const anterior = ULTIMOS.get(huella);
    if (anterior && ahora - anterior < VENTANA_DUPLICADO_MS) {
      return;
    }
    if (ULTIMOS.size > 200) {
      ULTIMOS.clear();
    }
    ULTIMOS.set(huella, ahora);

    await encolar({
      tipo: 'error',
      ocurridoEn: new Date(ahora).toISOString(),
      ruta,
      tipoError: datos.tipoError,
      mensaje,
      stack,
      url: recortar(datos.url, 2048),
      metodoHttp: recortar(datos.metodoHttp, 10),
      estadoHttp: datos.estadoHttp,
      requestId: recortar(datos.requestId, 100),
      navegador: navegadorResumido(),
      contexto: recortar(datos.contexto, 4096),
    });

    pedirEnvio();
  } catch {
    // Si la telemetría falla, jamás debe romper la aplicación.
  }
}

function manejarErrorDeVentana(evento: Event): void {
  if (evento instanceof ErrorEvent) {
    if (/ResizeObserver loop/i.test(evento.message)) {
      return;
    }
    const error = evento.error instanceof Error ? evento.error : undefined;
    void registrar({
      tipoError: 'js',
      mensaje: evento.message || error?.message || 'Error de JavaScript',
      stack: error?.stack,
      url: evento.filename || window.location.href,
      contexto: JSON.stringify({
        linea: evento.lineno,
        columna: evento.colno,
      }),
    });
    return;
  }

  const objetivo = evento.target;
  if (objetivo instanceof HTMLImageElement) {
    void registrar({
      tipoError: 'js',
      mensaje: `No se pudo cargar la imagen ${objetivo.currentSrc || objetivo.src}`.slice(0, 2048),
      url: objetivo.src,
      contexto: JSON.stringify({ recurso: 'imagen' }),
    });
  } else if (objetivo instanceof HTMLScriptElement) {
    void registrar({
      tipoError: 'js',
      mensaje: `No se pudo cargar el script ${objetivo.src}`.slice(0, 2048),
      url: objetivo.src,
      contexto: JSON.stringify({ recurso: 'script' }),
    });
  } else if (objetivo instanceof HTMLLinkElement) {
    void registrar({
      tipoError: 'js',
      mensaje: `No se pudo cargar el recurso ${objetivo.href}`.slice(0, 2048),
      url: objetivo.href,
      contexto: JSON.stringify({ recurso: 'estilo' }),
    });
  }
}

function manejarPromesaRechazada(evento: PromiseRejectionEvent): void {
  const motivo: unknown = evento.reason;
  const error = motivo instanceof Error ? motivo : undefined;
  void registrar({
    tipoError: 'promesa',
    mensaje:
      error?.message ??
      (typeof motivo === 'string' ? motivo : 'Promesa rechazada sin detalle'),
    stack: error?.stack,
    url: window.location.href,
  });
}

interface ArranquePendiente {
  mensaje: string;
  url?: string;
}

/** El script inline de `index.html` deja aquí lo que falle antes del bundle. */
function drenarArranquePendiente(): void {
  const ventana = window as unknown as {
    __telemetriaArranque?: ArranquePendiente[];
  };
  const pendientes = ventana.__telemetriaArranque;
  if (!Array.isArray(pendientes) || pendientes.length === 0) {
    return;
  }

  ventana.__telemetriaArranque = [];
  for (const pendiente of pendientes.slice(0, 5)) {
    void registrar({
      tipoError: 'arranque',
      mensaje: pendiente.mensaje,
      url: pendiente.url,
      contexto: JSON.stringify({ origen: 'index.html' }),
    });
  }
}

export function instalarCapturaDeErrores(): void {
  if (!TELEMETRIA_ACTIVA) {
    return;
  }

  drenarArranquePendiente();
  window.addEventListener('error', manejarErrorDeVentana, true);
  window.addEventListener('unhandledrejection', manejarPromesaRechazada);
  instalarCentinelaDePantallaEnBlanco();
}

export function registrarErrorReact(
  error: Error,
  componentStack?: string,
): void {
  void registrar({
    tipoError: 'react',
    mensaje: error.message || 'Error de React',
    stack: error.stack,
    url: window.location.href,
    contexto: componentStack
      ? JSON.stringify({ componente: componentStack.slice(0, 4000) })
      : undefined,
  });
}

export interface FalloHttp {
  metodo: string;
  url: string;
  estado: number;
  requestId?: string;
}

export function registrarFalloHttp(fallo: FalloHttp): void {
  void registrar({
    tipoError: 'http',
    mensaje: `HTTP ${fallo.estado} en ${fallo.metodo.toUpperCase()} ${fallo.url}`.slice(0, 2048),
    url: fallo.url,
    metodoHttp: fallo.metodo.toUpperCase(),
    estadoHttp: fallo.estado,
    requestId: fallo.requestId,
  });
}

function instalarCentinelaDePantallaEnBlanco(): void {
  window.setTimeout(() => {
    try {
      const raiz = document.getElementById('root');
      if (raiz && raiz.childElementCount === 0) {
        void registrar({
          tipoError: 'arranque',
          mensaje: 'La aplicación no dibujó contenido en 10 segundos',
          url: window.location.href,
          contexto: JSON.stringify({
            listo: document.readyState,
            scripts: document.scripts.length,
          }),
        });
      }
    } catch {
      // Silencio: el centinela es un extra, no una garantía.
    }
  }, 10_000);
}
