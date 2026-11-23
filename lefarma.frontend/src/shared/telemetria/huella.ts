import type { TipoError } from './tipos';

const FNV_PRIMO = 0x01000193;
const FNV_BASE = 0x811c9dc5;

function fnv1a(texto: string, semilla: number): number {
  let hash = semilla >>> 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIMO) >>> 0;
  }
  return hash >>> 0;
}

function normalizarMensaje(mensaje: string): string {
  return mensaje
    .trim()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 300);
}

function normalizarStack(stack?: string): string {
  if (!stack) {
    return '';
  }
  const lineas = stack
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((linea) =>
      linea
        .replace(/\([^)]*\)/g, '()')
        .replace(/^.*[\\/]/, ''),
    );
  return lineas.join('·').replace(/\s+/g, ' ').slice(0, 300);
}

function normalizarRutaHuella(ruta: string): string {
  return ruta
    .split('?')[0]
    .replace(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      ':id',
    )
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .toLowerCase()
    .slice(0, 200);
}

export function calcularHuella(
  tipoError: TipoError,
  mensaje: string,
  stack: string | undefined,
  ruta: string,
): string {
  const texto = [
    tipoError,
    normalizarMensaje(mensaje),
    normalizarStack(stack),
    normalizarRutaHuella(ruta),
  ].join('|');

  const a = fnv1a(texto, FNV_BASE).toString(16).padStart(8, '0');
  const b = fnv1a(texto, 0x811c9dcd).toString(16).padStart(8, '0');
  return `${a}${b}`;
}
