import type { SseUserInfo } from './sse.types';
import type { Area } from './catalogo.types';


// User info from backend (matches UserInfo in backend DTOs)
export interface UserInfo {
  id: number;
  username: string;
  nombre?: string;
  correo?: string;
  dominio?: string;
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

// Legacy User interface (for backward compatibility)
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

// Legacy types (for backward compatibility)
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  empresas: Empresa[];
}

// New 2-step login types
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

// Updated AuthState with 2-step flow
export interface AuthState {
  // Existing state
  user: UserInfo | null;
  token: string | null;
  empresa: Empresa | null;
  sucursal: Sucursal | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // New state for 3-step flow
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

  // Existing actions
  logout: () => Promise<void>;
  setEmpresa: (empresa: Empresa) => void;
  setSucursal: (sucursal: Sucursal) => void;
  setToken: (token: string) => void;
  setUser: (user: UserInfo) => void;
  initialize: () => void;
  changeEmpresaSucursal: (empresa: Empresa, sucursal: Sucursal) => void;

  // New actions for 3-step flow
  loginStepOne: (username: string) => Promise<void>;
  loginStepTwo: (password: string, domain: string) => Promise<void>;
  loginStepThree: (empresaId: string, sucursalId: string, areaId?: string) => Promise<void>;
  resetLoginFlow: () => void;

  // Firma signature actions
  setHasFirma: (has: boolean) => void;
  fetchProfileSignature: () => Promise<void>;

  // SSE
  updateUserFromSse: (sseUser: SseUserInfo) => void;
}
