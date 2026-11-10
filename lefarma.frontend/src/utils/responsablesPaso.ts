/**
 * Nombres visibles de los responsables configurados en un paso del flujo.
 *
 * El endpoint `/config/workflows/flow` entrega los participantes de TODOS los
 * pasos del workflow (no solo del paso actual), así que el responsable puede
 * mostrarse incluso cuando el paso está «En espera». Se prefiere el usuario
 * explícito; si el paso se define por rol o por jefe inmediato se usa esa
 * etiqueta como respaldo.
 */
export interface ParticipantePaso {
  nombreUsuario?: string | null;
  nombreRol?: string | null;
  /** Puesto oficial del usuario según Asistencias.dbo.vwEmpleados. */
  puestoUsuario?: string | null;
  requiereJefeInmediato?: boolean;
  nivelJefe?: number | null;
}

export function nombresResponsablesPaso(
  participantes?: ParticipantePaso[] | null
): string[] {
  if (!participantes?.length) return [];

  const nombres = participantes
    .map(
      (p) =>
        p.nombreUsuario ||
        p.nombreRol ||
        (p.requiereJefeInmediato
          ? `Jefe inmediato nivel ${p.nivelJefe ?? 1}`
          : null)
    )
    .filter((nombre): nombre is string => Boolean(nombre?.trim()));

  return [...new Set(nombres)];
}

/** Texto listo para mostrar: «Responsable: X» o «Responsables: X · Y». */
export function etiquetaResponsables(nombres: string[]): string {
  if (nombres.length === 0) return '';
  return `${nombres.length === 1 ? 'Responsable' : 'Responsables'}: ${nombres.join(' · ')}`;
}

/**
 * Título visible del paso. El paso configurado como «Aprobación Gerente General»
 * es genérico: el responsable real puede no ser el Gerente General (p. ej. un jefe
 * de área configurado en el flujo). En ese caso se muestra el nombre y el puesto
 * oficial (Asistencias.dbo.vwEmpleados); con el resto de pasos no se toca.
 */
export function tituloPasoResponsable(
  nombrePaso: string,
  participantes?: ParticipantePaso[] | null
): string {
  if (!/^aprobaci[oó]n\s+gerente\s+general$/i.test(nombrePaso.trim())) return nombrePaso;

  const participante = participantes?.find((p) => p.nombreUsuario?.trim());
  const nombre = participante?.nombreUsuario?.trim();
  if (!nombre) return nombrePaso;

  const puesto = participante?.puestoUsuario?.trim();
  return puesto ? `Aprobación ${nombre} — ${puesto}` : `Aprobación ${nombre}`;
}
