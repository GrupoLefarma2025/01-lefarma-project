import { TELEMETRIA_ACTIVA, rutaActual, rutaExcluida } from './config';
import { encolar } from './colaEventos';
import { pedirEnvio } from './emisor';

const MAXIMO_ELEMENTO = 200;
const MAXIMO_ETIQUETA = 80;
const MAXIMO_CLICS_POR_PAGINA = 400;

let clicsEnPagina = 0;
let rutaContada = '';

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
  }
}

export function instalarCapturaDeClics(): void {
  if (!TELEMETRIA_ACTIVA) {
    return;
  }

  document.addEventListener('click', manejarClic, { capture: true, passive: true });
}
