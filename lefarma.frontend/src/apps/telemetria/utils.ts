import type { RangoFechas } from './types';

export const OPCIONES_RANGO = [
  { valor: 1, etiqueta: 'Hoy' },
  { valor: 7, etiqueta: '7 días' },
  { valor: 30, etiqueta: '30 días' },
  { valor: 90, etiqueta: '90 días' },
] as const;

export function rangoDeDias(dias: number): RangoFechas {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - dias * 24 * 60 * 60 * 1000);
  return { desde, hasta };
}

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const formatoFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function fechaCorta(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '—' : formatoFecha.format(fecha);
}

export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '—' : formatoFechaHora.format(fecha);
}

const formatoNumero = new Intl.NumberFormat('es-MX');

export function numero(valor: number | null | undefined): string {
  return formatoNumero.format(valor ?? 0);
}

export function recortar(texto: string | null | undefined, maximo = 80): string {
  if (!texto) return '—';
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}

export function porcentaje(parte: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((parte / total) * 100)}%`;
}

/** Escala de intensidad del mapa de calor: transparente → naranja fuerte. */
export function colorCalor(valor: number, maximo: number): string {
  if (!valor || !maximo) return 'transparent';
  const intensidad = Math.min(1, valor / maximo);
  const alfa = 0.12 + intensidad * 0.78;
  return `rgba(235, 108, 54, ${alfa.toFixed(2)})`;
}

export function severidadClase(severidad: string): string {
  switch (severidad.toLowerCase()) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'error':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'warning':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

/** Descarga filas como CSV con BOM para que Excel respete los acentos. */
export function descargarCsv(
  nombre: string,
  filas: Array<Record<string, string | number | null | undefined>>,
): void {
  if (filas.length === 0) return;

  const encabezados = Object.keys(filas[0]);
  const escapar = (valor: string | number | null | undefined): string => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return `"${texto.replace(/"/g, '""')}"`;
  };

  const contenido = [
    encabezados.join(','),
    ...filas.map((fila) => encabezados.map((clave) => escapar(fila[clave])).join(',')),
  ].join('\r\n');

  const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
