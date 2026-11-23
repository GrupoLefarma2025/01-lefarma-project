export type GrupoConcentrado = 'ninguna' | 'gerencia' | 'solicitante';

export const GRUPO_LABELS: Record<GrupoConcentrado, string> = {
  ninguna: 'Sin agrupar',
  gerencia: 'Gerencia',
  solicitante: 'Solicitante',
};
