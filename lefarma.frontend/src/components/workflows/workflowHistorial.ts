import type { HistorialWorkflowItemResponse } from '@/types/solicitudPersonalWorkflow.types';

export interface SnapshotData {
  omisionAutomatica?: boolean;
  motivo?: string | null;
  idPasoOmitido?: number | null;
  idPasoDestinoSalto?: number | null;
  idPasoAnterior?: number | null;
  idPasoNuevo?: number | null;
  idEstadoNuevo?: number | null;
  datosAdicionales?: unknown;
}

export const parseSnapshot = (raw?: string | null): SnapshotData | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SnapshotData;
  } catch {
    return null;
  }
};

export const pasoDondeActuo = (evento: HistorialWorkflowItemResponse): number => {
  const snapshot = parseSnapshot(evento.datosSnapshot);
  return snapshot?.idPasoAnterior ?? evento.idPaso;
};

export const agruparEventosPorPasoActividad = (
  historial: HistorialWorkflowItemResponse[]
): Map<number, HistorialWorkflowItemResponse[]> => {
  const map = new Map<number, HistorialWorkflowItemResponse[]>();
  const ordenado = [...historial].sort(
    (a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime()
  );

  for (const evento of ordenado) {
    const idPaso = pasoDondeActuo(evento);
    const arr = map.get(idPaso) ?? [];
    arr.push(evento);
    map.set(idPaso, arr);
  }

  return map;
};
