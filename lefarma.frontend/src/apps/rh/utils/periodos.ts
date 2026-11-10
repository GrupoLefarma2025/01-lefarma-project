/** Nombres de mes usados en los periodos de RH (formato "noviembre 2026"). */
export const MESES_PERIODO = [
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

export function periodoLabel(anio: number, mes: number): string {
  return `${MESES_PERIODO[mes - 1] ?? ''} ${anio}`;
}
