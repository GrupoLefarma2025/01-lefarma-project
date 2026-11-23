import type { PendienteAprobacion } from '@/apps/educacion-medica/types/educacionMedica.types';

export type TipoDocumentoEm = PendienteAprobacion['tipo'];

export const ENTIDAD_ARCHIVOS: Record<TipoDocumentoEm, { tipo: string; carpeta: string }> = {
  seleccion: { tipo: 'SeleccionMensual', carpeta: 'educacion-medica-selecciones' },
  matriz: { tipo: 'MatrizGeneral', carpeta: 'educacion-medica-matrices' },
};

export const ENTIDAD_ARCHIVOS_IMPARTICION = {
  evidencia: { tipo: 'TallerEvidencia', carpeta: 'educacion-medica-evidencias' },
} as const;
