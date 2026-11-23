import type { EmpleadoJefesConfigResponse } from '@/types/jefesNiveles.types';
import type { WorkflowPasoFlowResponse } from '@/types/solicitudPersonalWorkflow.types';

export function pasoSeOmitira(
  paso: WorkflowPasoFlowResponse,
  config: EmpleadoJefesConfigResponse | null,
  jefesExcluidos: ReadonlySet<number>
): boolean {
  if (!config) return false;
  const participantes = paso.participantes ?? [];
  if (participantes.length === 0) return false;
  if (!participantes.every((p) => p.requiereJefeInmediato)) return false;

  return participantes.every((participante) => {
    const nivel = participante.nivelJefe ?? 1;
    const nivelConfig = config.niveles.find((n) => n.nivel === nivel);
    const aplica = nivelConfig?.aplica ?? config.esConfigPorDefecto;
    if (!aplica) return true;

    const idJefe =
      nivelConfig?.idUsuarioJefeOverride ?? nivelConfig?.idUsuarioJefeVista ?? null;
    return idJefe == null || jefesExcluidos.has(idJefe);
  });
}

export function responsablesJefePaso(
  paso: WorkflowPasoFlowResponse,
  config: EmpleadoJefesConfigResponse | null,
  jefesExcluidos: ReadonlySet<number>
): string[] {
  if (!config) return [];

  const nombres: string[] = [];
  for (const participante of paso.participantes ?? []) {
    if (!participante.requiereJefeInmediato) continue;

    const nivel = participante.nivelJefe ?? 1;
    const nivelConfig = config.niveles.find((n) => n.nivel === nivel);
    const aplica = nivelConfig?.aplica ?? config.esConfigPorDefecto;
    if (!aplica) continue;

    const idJefe =
      nivelConfig?.idUsuarioJefeOverride ?? nivelConfig?.idUsuarioJefeVista ?? null;
    if (idJefe == null || jefesExcluidos.has(idJefe)) continue;

    const nombre = (
      nivelConfig?.idUsuarioJefeOverride != null
        ? nivelConfig.nombreJefeOverride
        : nivelConfig?.nombreJefeVista
    )?.trim();
    if (!nombre || nombres.includes(nombre)) continue;

    nombres.push(nombre);
  }

  return nombres;
}
