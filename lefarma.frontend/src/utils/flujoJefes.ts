import type { EmpleadoJefesConfigResponse } from '@/types/jefesNiveles.types';
import type { WorkflowPasoFlowResponse } from '@/types/solicitudPersonalWorkflow.types';

/**
 * Réplica de la regla del motor al llegar a un paso (`DebeOmitirsePasoJefeAsync` +
 * `ResolverJefeEfectivoAsync`): un paso cuyos participantes son todos "jefe inmediato"
 * se omite si el nivel no aplica para el empleado, si el jefe no tiene cuenta en el
 * sistema o si está excluido en ese workflow. Solo sirve para la línea de tiempo;
 * el motor sigue siendo quien decide al ejecutar.
 */
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
