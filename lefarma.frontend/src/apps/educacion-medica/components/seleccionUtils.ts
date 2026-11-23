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

export const PERMISOS_EDICION_SELECCION = [
  'educacion_medica.selecciones.puede_gestionar',
  'educacion_medica.selecciones.puede_autorizar',
] as const;

export function formatearPeriodoSeleccion(fecha?: string | null): string {
  if (!fecha) return '—';
  const [anio, mes] = fecha.slice(0, 10).split('-');
  const idx = Number(mes) - 1;
  if (Number.isNaN(idx) || !MESES[idx]) return fecha;
  return `${MESES[idx].charAt(0).toUpperCase()}${MESES[idx].slice(1)} ${anio}`;
}

export function nombreSeleccion(
  fecha?: string | null,
  tipoGerencia?: string | null
): string {
  const periodo = formatearPeriodoSeleccion(fecha);
  return tipoGerencia ? `Selección ${periodo} · ${tipoGerencia}` : `Selección ${periodo}`;
}

export function formatearFechaSeleccion(fecha?: string | null): string {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const ETIQUETAS_ESTADO_DOMINIO: Record<string, string> = {
  Creada: 'Creada',
  EnRevision: 'En revisión',
  Cerrada: 'Cerrada',
  Rechazada: 'Rechazada',
  Cancelada: 'Cancelada',
  Archivada: 'Archivada',
};

export function etiquetaEstadoDominio(estado?: string | null): string | null {
  if (!estado) return null;
  return ETIQUETAS_ESTADO_DOMINIO[estado] ?? estado;
}
