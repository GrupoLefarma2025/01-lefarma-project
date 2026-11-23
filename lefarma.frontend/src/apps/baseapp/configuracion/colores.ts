export interface ColorModuloDefinicion {
  valor: string;
  nombre: string;
}

export const COLORES_MODULO: ColorModuloDefinicion[] = [
  { valor: '#eb6c36', nombre: 'Naranja Lefarma' },
  { valor: '#0ea5e9', nombre: 'Celeste' },
  { valor: '#10b981', nombre: 'Esmeralda' },
  { valor: '#f59e0b', nombre: 'Ámbar' },
  { valor: '#8b5cf6', nombre: 'Violeta' },
  { valor: '#ec4899', nombre: 'Rosa' },
  { valor: '#14b8a6', nombre: 'Turquesa' },
  { valor: '#ef4444', nombre: 'Rojo' },
  { valor: '#6366f1', nombre: 'Índigo' },
  { valor: '#84cc16', nombre: 'Lima' },
  { valor: '#f97316', nombre: 'Naranja' },
  { valor: '#06b6d4', nombre: 'Cian' },
];

export const COLOR_MODULO_POR_OMISION = COLORES_MODULO[0].valor;

const COLOR_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export function esColorHex(valor: string | null | undefined): valor is string {
  return Boolean(valor) && COLOR_HEX_REGEX.test(valor as string);
}

export function normalizarColorHex(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpio = valor.trim();
  const conAlmohadilla = limpio.startsWith('#') ? limpio : `#${limpio}`;
  return esColorHex(conAlmohadilla) ? conAlmohadilla.toLowerCase() : null;
}

export function colorAleatorioModulo(): string {
  return COLORES_MODULO[Math.floor(Math.random() * COLORES_MODULO.length)].valor;
}

export function colorDeModulo(
  color: string | null | undefined,
  semilla = '',
): string {
  const normalizado = normalizarColorHex(color);
  if (normalizado) return normalizado;
  if (!semilla) return COLOR_MODULO_POR_OMISION;

  let hash = 0;
  for (let i = 0; i < semilla.length; i += 1) {
    hash = (hash * 31 + semilla.charCodeAt(i)) >>> 0;
  }
  return COLORES_MODULO[hash % COLORES_MODULO.length].valor;
}

export function colorTextoContraste(color: string): string {
  const hex = normalizarColorHex(color);
  if (!hex) return '#ffffff';

  const canal = (inicio: number) => {
    const valor = Number.parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
    return valor <= 0.03928
      ? valor / 12.92
      : Math.pow((valor + 0.055) / 1.055, 2.4);
  };

  const luminancia =
    0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
  return luminancia > 0.3 ? '#111827' : '#ffffff';
}
