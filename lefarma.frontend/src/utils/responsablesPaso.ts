export interface ParticipantePaso {
  nombreUsuario?: string | null;
  nombreRol?: string | null;
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

export function etiquetaResponsables(nombres: string[]): string {
  if (nombres.length === 0) return '';
  return `${nombres.length === 1 ? 'Responsable' : 'Responsables'}: ${nombres.join(' · ')}`;
}

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
