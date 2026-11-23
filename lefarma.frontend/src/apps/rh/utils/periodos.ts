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
