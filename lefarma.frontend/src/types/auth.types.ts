import type { SseUserInfo } from './sse.types';
import type { Area } from './catalogo.types';


// Información del usuario desde el backend (coincide con UserInfo en los DTOs del backend)
export interface UserInfo {
  id: number;
  username: string;
  nombre?: string;
  correo?: string;
  dominio?: string;
  puesto?: string;
  roles: RoleInfo[];
  permisos: PermissionInfo[];
}

export interface RoleInfo {
  idRol: number;
  nombreRol: string;
  descripcion?: string;
}

export interface PermissionInfo {
  idPermiso: number;
  codigoPermiso: string;
  nombrePermiso: string;
  categoria?: string;
  recurso?: string;
  accion?: string;
}

// Interfaz User legacy (para compatibilidad hacia atrás)
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export interface Empresa {
  idEmpresa: string | number;
  nombre: string;
  codigo: string;
  activo: boolean;
  puedeSeleccionarEmpresas: boolean;
}

export interface Sucursal {
  idSucursal: string | number;
  idEmpresa: string | number;
  nombre: string;
  codigo: string;
  direccion?: string;
  telefono?: string;
  activo: boolean;
}

// Tipos legacy (para compatibilidad hacia atrás)
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  empresas: Empresa[];
}

// Nuevos tipos para login de 2 pasos
export interface LoginStepOneRequest {
  username: string;
}

export interface LoginStepOneResponse {
  domains: string[];
  requiresDomainSelection: boolean;
  displayName?: string;
}

export interface LoginStepTwoRequest {
  username: string;
  password: string;
  domain: string;
}

export interface LoginStepTwoResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// AuthState actualizado con flujo de 2 pasos
export interface AuthState {
  // Estado existente
  user: UserInfo | null;
  token: string | null;
  empresa: Empresa | null;
  sucursal: Sucursal | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Nuevo state para flujo de 3 pasos
  loginStep: 1 | 2 | 3;
  availableDomains: string[];
  requiresDomainSelection: boolean;
  displayName: string | null;
  pendingUsername: string | null;
  empresas: Empresa[];
  sucursales: Sucursal[];
  areas: Area[];
  area: Area | null;

  hasFirma: boolean | null;
  puedeSeleccionarEmpresas: boolean;
  usuarioDetalle: { idEmpresa: number; idSucursal: number; idArea: number | null } | null;

  // Acciones existentes
  logout: () => Promise<void>;
  setEmpresa: (empresa: Empresa) => void;
  setSucursal: (sucursal: Sucursal) => void;
  setToken: (token: string) => void;
  setUser: (user: UserInfo) => void;
  initialize: () => void;
  changeEmpresaSucursal: (empresa: Empresa, sucursal: Sucursal, area?: Area | null) => void;

  // Nuevas acciones para flujo de 3 pasos
  loginStepOne: (username: string) => Promise<void>;
  /**
   * Valida credenciales y ya sea avanza al paso 3 (flujo CxP por defecto) o
   * finaliza la sesión (flujo global de 2 pasos).
   *
   * @param options.requireContextSelection Cuando es `false`, marca la sesión
   *   como autenticada justo después de las credenciales y OMITE la carga de
   *   empresa/sucursal/area. Usado por el flujo `/login` global y el login
   *   por-app de RH. El comportamiento por defecto (sin opción) preserva el
   *   flujo CxP de 3 pasos.
   */
  loginStepTwo: (
    password: string,
    domain: string,
    options?: { requireContextSelection?: boolean }
  ) => Promise<void>;
  loginStepThree: (empresaId: string, sucursalId: string, areaId?: string) => Promise<void>;
  resetLoginFlow: () => void;

  // Acciones de firma de firma
  setHasFirma: (has: boolean) => void;
  fetchProfileSignature: () => Promise<void>;

  // SSE
  updateUserFromSse: (sseUser: SseUserInfo) => void;
}
