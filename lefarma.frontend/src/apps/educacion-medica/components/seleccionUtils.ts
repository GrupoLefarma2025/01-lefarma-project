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

/** Permisos que habilitan la edición de una selección (además del candado por paso). */
export const PERMISOS_EDICION_SELECCION = [
  'educacion_medica.selecciones.puede_gestionar',
  'educacion_medica.selecciones.puede_autorizar',
] as const;

/** "2026-09-15" → "Septiembre 2026". */
export function formatearPeriodoSeleccion(fecha?: string | null): string {
  if (!fecha) return '—';
  const [anio, mes] = fecha.slice(0, 10).split('-');
  const idx = Number(mes) - 1;
  if (Number.isNaN(idx) || !MESES[idx]) return fecha;
  return `${MESES[idx].charAt(0).toUpperCase()}${MESES[idx].slice(1)} ${anio}`;
}

/** Nombre visible de una selección: "Selección Septiembre 2026 · IMSS". */
export function nombreSeleccion(
  fecha?: string | null,
  tipoGerencia?: string | null
): string {
  const periodo = formatearPeriodoSeleccion(fecha);
  return tipoGerencia ? `Selección ${periodo} · ${tipoGerencia}` : `Selección ${periodo}`;
}

/** "2026-09-15" o ISO datetime → "15/09/2026". */
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

/**
 * Etiqueta legible para un estado de dominio cuando no hay nombre del catálogo
 * del workflow (`config.workflow_estados`). Evita mostrar códigos crudos como
 * "EnRevision" en la UI.
 */
export function etiquetaEstadoDominio(estado?: string | null): string | null {
  if (!estado) return null;
  return ETIQUETAS_ESTADO_DOMINIO[estado] ?? estado;
}
