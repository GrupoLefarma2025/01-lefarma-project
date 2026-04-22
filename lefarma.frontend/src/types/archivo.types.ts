
export interface Archivo {
  id: number;
  entidadTipo: string;
  entidadId: number;
  carpeta: string;
  nombreOriginal: string;
  nombreFisico: string;
  extension: string;
  tipoMime: string;
  tamanoBytes: number;
  metadata: unknown;
  fechaCreacion: string;
  fechaEdicion: string | null;
  usuarioId: number | null;
  activo: boolean;
}

export interface ArchivoListItem {
  id: number;
  nombreOriginal: string;
  extension: string;
  tipoMime: string;
  tamanoBytes: number;
  metadata?: unknown;
  fechaCreacion: string;
  activo: boolean;
}

export interface ListarArchivosParams {
  entidadTipo?: string;
  entidadId?: number;
  soloActivos?: boolean;
}

export interface SubirArchivoParams {
  entidadTipo: string;
  entidadId: number;
  carpeta: string;
  metadata?: unknown;
}

export interface ReemplazarArchivoParams {
  metadata?: unknown;
}
