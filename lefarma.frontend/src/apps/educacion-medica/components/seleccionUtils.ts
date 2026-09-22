const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "2026-09-15" → "Septiembre 2026". */
export function formatearPeriodoSeleccion(fecha?: string | null): string {
  if (!fecha) return '—';
  const [anio, mes] = fecha.slice(0, 10).split('-');
  const idx = Number(mes) - 1;
  if (Number.isNaN(idx) || !MESES[idx]) return fecha;
  return `${MESES[idx].charAt(0).toUpperCase()}${MESES[idx].slice(1)} ${anio}`;
}

/** "2026-09-15" o ISO datetime → "15/09/2026". */
export function formatearFechaSeleccion(fecha?: string | null): string {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}
