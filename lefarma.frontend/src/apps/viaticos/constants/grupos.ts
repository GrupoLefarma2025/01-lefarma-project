/**
 * Criterios con los que el concentrado de viáticos parte el FOR-008 en
 * bloques (tabla, resumen y documento usan la misma lista).
 */
export type GrupoConcentrado = 'ninguna' | 'gerencia' | 'solicitante';

export const GRUPO_LABELS: Record<GrupoConcentrado, string> = {
  ninguna: 'Sin agrupar',
  gerencia: 'Gerencia',
  solicitante: 'Solicitante',
};
