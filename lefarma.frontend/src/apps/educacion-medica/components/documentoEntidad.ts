import type { PendienteAprobacion } from '@/apps/educacion-medica/types/educacionMedica.types';

/** Tipo de documento de Educación Médica con flujo de autorización. */
export type TipoDocumentoEm = PendienteAprobacion['tipo'];

/**
 * Entidad del servicio de archivos para cada tipo de documento.
 * `tipo` es el EntidadTipo que usa /api/archivos; `carpeta` la carpeta física.
 */
export const ENTIDAD_ARCHIVOS: Record<TipoDocumentoEm, { tipo: string; carpeta: string }> = {
  seleccion: { tipo: 'SeleccionMensual', carpeta: 'educacion-medica-selecciones' },
  rutas: { tipo: 'RutaVersion', carpeta: 'educacion-medica-rutas' },
  matriz: { tipo: 'MatrizGeneral', carpeta: 'educacion-medica-matrices' },
};

/**
 * Entidades del servicio de archivos para la impartición de talleres (ADR-00008):
 * evidencias del taller (fotos/video/documentos, incluida la hoja firmada de la
 * lista de asistencia).
 */
export const ENTIDAD_ARCHIVOS_IMPARTICION = {
  evidencia: { tipo: 'TallerEvidencia', carpeta: 'educacion-medica-evidencias' },
} as const;
