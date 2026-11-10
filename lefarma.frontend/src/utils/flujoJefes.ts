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

/**
 * Nombres de los jefes que el motor esperaría en el paso, con la misma
 * precedencia que `DebeOmitirsePasoJefeAsync` (override > vista, config del
 * empleado y exclusiones del workflow). Sirve para mostrar en la línea de
 * tiempo quién debe firmar aunque todavía no lo haya hecho.
 */
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
