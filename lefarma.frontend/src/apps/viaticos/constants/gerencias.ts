export const GERENCIAS_VIATICOS = ['Descentralizado', 'IMSS', 'IMSS Bienestar'] as const;

export const GERENCIA_SIN_ASIGNAR = 'Sin asignar';

export function gerenciaVisible(gerencia: string | null | undefined): string {
  const limpia = gerencia?.trim() ?? '';
  return limpia === '' ? GERENCIA_SIN_ASIGNAR : limpia;
}
