/**
 * Clasificación con la que se captura y agrupa el concentrado de viáticos.
 *
 * Vive en `solicitudes.gerencia` (texto libre): el wizard ofrece estas
 * opciones y el concentrado agrupa por ese valor. Si el catálogo crece, se
 * agrega aquí y el combo/documento lo toman sin más cambios.
 */
export const GERENCIAS_VIATICOS = ['Descentralizado', 'IMSS', 'IMSS Bienestar'] as const;

/** Valor con el que nacen las solicitudes que nadie clasificó. */
export const GERENCIA_SIN_ASIGNAR = 'Sin asignar';

/** Etiqueta a mostrar; `null`/vacío cae a «Sin asignar», nunca a un blanco. */
export function gerenciaVisible(gerencia: string | null | undefined): string {
  const limpia = gerencia?.trim() ?? '';
  return limpia === '' ? GERENCIA_SIN_ASIGNAR : limpia;
}
