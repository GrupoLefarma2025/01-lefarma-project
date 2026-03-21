// Tipos para Permisos (Alineado con AdminDTOs.cs)

export interface Permiso {
  idPermiso: number;
  codigoPermiso: string;
  nombrePermiso: string;
  descripcion?: string;
  categoria?: string;
  recurso?: string;
  accion?: string;
  esActivo: boolean;
  esSistema: boolean;
  fechaCreacion: string;
  cantidadRoles: number;
}

export interface CreatePermisoRequest {
  codigoPermiso: string;
  nombrePermiso: string;
  descripcion?: string;
  categoria?: string;
  recurso?: string;
  accion?: string;
  esActivo: boolean;
  esSistema: boolean;
}

export interface UpdatePermisoRequest {
  codigoPermiso: string;
  nombrePermiso: string;
  descripcion?: string;
  categoria?: string;
  recurso?: string;
  accion?: string;
  esActivo: boolean;
}
