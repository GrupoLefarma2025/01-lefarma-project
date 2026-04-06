// Tipos para Permisos (Alineado con AdminDTOs.cs)

import { RolBasicoResponse, UsuarioBasico } from './rol.types';


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
  cantidadUsuarios: number;
}

export interface PermisoConRolesYUsuarios extends Permiso {
  roles: RolBasicoResponse[];
  usuarios: UsuarioBasico[];
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

export interface AsignarRolesAPermisoRequest {
  rolesIds: number[];
}

export interface AsignarUsuariosAPermisoRequest {
  usuariosIds: number[];
}
