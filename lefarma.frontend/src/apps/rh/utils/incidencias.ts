export const TIPOS_INCIDENCIA = [
  { value: 'TARDANZA_ENTRADA', label: 'Tardanza entrada' },
  { value: 'TARDANZA_SALIDA', label: 'Tardanza salida' },
  { value: 'OMISION_ENTRADA', label: 'Omisión entrada' },
  { value: 'OMISION_SALIDA', label: 'Omisión salida' },
  { value: 'SALIDA_ANTICIPADA', label: 'Salida anticipada' },
];

export const getTipoIncidenciaLabel = (value: string): string =>
  TIPOS_INCIDENCIA.find((t) => t.value === value)?.label ?? value;
