import { Permiso } from './permiso.types';

export interface Rol {
  idRol: number;
  nombreRol: string;
  descripcion?: string;
  esActivo: boolean;
  esSistema: boolean;
  fechaCreacion: string;
  cantidadUsuarios: number;
  permisos: Permiso[];
}

export interface RolBasicoResponse {
  idRol: number;
  nombreRol: string;
  descripcion?: string;
  esActivo: boolean;
}

export interface CreateRolRequest {
  nombreRol: string;
  descripcion?: string;
  esActivo: boolean;
  esSistema: boolean;
  permisosIds: number[];
}

export interface UpdateRolRequest {
  nombreRol: string;
  descripcion?: string;
  esActivo: boolean;
  permisosIds: number[];
}
