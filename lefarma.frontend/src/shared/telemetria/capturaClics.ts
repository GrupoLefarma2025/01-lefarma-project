import { TELEMETRIA_ACTIVA, rutaActual, rutaExcluida } from './config';
import { encolar } from './colaEventos';
import { pedirEnvio } from './emisor';

/**
 * Clics: un solo escuchador delegado en captura sobre `document` (así también
 * cuenta los clics de menús que se montan y desmontan). La identidad estable
 * sigue este orden: data-track, data-testid, id, aria-label, name y, al final,
 * el texto visible. Nunca se envía el valor de un campo.
 */

const MAXIMO_ELEMENTO = 200;
const MAXIMO_ETIQUETA = 80;
/** Tope por página y visita: un bucle o una lista muy clickeada no infla la telemetría. */
const MAXIMO_CLICS_POR_PAGINA = 400;

let clicsEnPagina = 0;
let rutaContada = '';

/**
 * Quita de la etiqueta lo que podría identificar una fila o revelar datos:
 * importes, folios con numeral y números largos. Así «Pagar $12,500.00» y
 * «Ver detalle #4821» quedan estables y sin datos personales.
 */
export function limpiarEtiqueta(texto: string): string {
  return texto
    .replace(/\$\s?\d[\d.,]*/g, '$…')
    .replace(/#\s?\d+/g, '#')
    .replace(/\b\d{4,}\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAXIMO_ETIQUETA);
}

function tipoDe(elemento: Element): string {
  const tipo = elemento.getAttribute('type');
  const rol = elemento.getAttribute('role');
  const etiqueta = elemento.tagName.toLowerCase();
  if (etiqueta === 'input' && tipo) {
    return `input:${tipo}`;
  }
  if (rol) {
    return `${etiqueta}:${rol}`;
  }
  return etiqueta;
}

function textoDe(elemento: Element): string | undefined {
  const texto = (elemento.textContent ?? '').replace(/\s+/g, ' ').trim();
  return texto ? limpiarEtiqueta(texto) : undefined;
}

function etiquetaDe(elemento: Element): string | undefined {
  const etiqueta =
    elemento.getAttribute('aria-label')?.trim() || elemento.getAttribute('title')?.trim();
  if (etiqueta) {
    return limpiarEtiqueta(etiqueta);
  }
  return textoDe(elemento);
}

function identidadDe(elemento: Element): {
  elemento: string;
  etiqueta?: string;
  tipoElemento: string;
} {
  const candidatos: Array<[string | null, string]> = [
    [elemento.getAttribute('data-track'), 'data-track'],
    [elemento.getAttribute('data-testid'), 'data-testid'],
    [elemento.id ? `#${elemento.id}` : null, 'id'],
    [elemento.getAttribute('aria-label'), 'aria-label'],
    [elemento.getAttribute('name'), 'name'],
  ];

  for (const [valor, origen] of candidatos) {
    const limpio = valor?.trim();
    if (limpio) {
      return {
        elemento: (origen === 'id' ? limpio : `${origen}:${limpio}`).slice(
          0,
          MAXIMO_ELEMENTO,
        ),
        etiqueta: etiquetaDe(elemento),
        tipoElemento: tipoDe(elemento),
      };
    }
  }

  return {
    elemento: tipoDe(elemento).slice(0, MAXIMO_ELEMENTO),
    etiqueta: etiquetaDe(elemento),
    tipoElemento: tipoDe(elemento),
  };
}

/**
 * Devuelve el elemento interactivo más cercano o `null` si el clic cayó en un
 * hueco de la pantalla. Los clics en zonas muertas no se guardan como botones:
 * la posición ya queda en el mapa de calor y así la tabla de botones es limpia.
 */
function elementoInteractivo(objetivo: Element): Element | null {
  return objetivo.closest(
    'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], ' +
      '[role="switch"], [role="menuitemcheckbox"], [role="menuitemradio"], summary, select, ' +
      'input[type="submit"], input[type="button"], input[type="checkbox"], ' +
      'input[type="radio"], label, [data-track]',
  );
}

function manejarClic(evento: MouseEvent): void {
  if (!TELEMETRIA_ACTIVA || evento.button !== 0) {
    return;
  }

  try {
    const ruta = rutaActual();
    if (rutaExcluida(ruta)) {
      return;
    }

    const objetivo = evento.target;
    if (!(objetivo instanceof Element)) {
      return;
    }
    if (objetivo.closest('[data-telemetria="off"]')) {
      return;
    }

    const elemento = elementoInteractivo(objetivo);
    if (!elemento || elemento.tagName.toLowerCase() === 'option') {
      return;
    }

    if (ruta !== rutaContada) {
      rutaContada = ruta;
      clicsEnPagina = 0;
    }
    if (clicsEnPagina >= MAXIMO_CLICS_POR_PAGINA) {
      return;
    }
    clicsEnPagina += 1;

    const datos = identidadDe(elemento);
    void encolar({
      tipo: 'clic',
      ocurridoEn: new Date().toISOString(),
      ruta,
      elemento: datos.elemento,
      etiqueta: datos.etiqueta,
      tipoElemento: datos.tipoElemento,
      x: Math.max(0, Math.round(evento.clientX)),
      y: Math.max(0, Math.round(evento.clientY)),
      viewportAncho: window.innerWidth,
      viewportAlto: window.innerHeight,
    });
    pedirEnvio();
  } catch {
    // Un fallo midiendo un clic no debe afectar al clic real.
  }
}

export function instalarCapturaDeClics(): void {
  if (!TELEMETRIA_ACTIVA) {
    return;
  }

  document.addEventListener('click', manejarClic, { capture: true, passive: true });
}
