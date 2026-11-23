import type { SseUserInfo } from './sse.types';
import type { Area } from './catalogo.types';

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

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  empresas: Empresa[];
}

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

export interface AuthState {
  user: UserInfo | null;
  token: string | null;
  empresa: Empresa | null;
  sucursal: Sucursal | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

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
  hasFirmaLegacy: boolean | null;
  firmaEnComprobacion: boolean | null;
  puedeSeleccionarEmpresas: boolean;
  areaEmpleado: string | null;
  puestoEmpleado: string | null;
  usuarioDetalle: { idEmpresa: number; idSucursal: number; idArea: number | null } | null;
  profileError: string | null;

  logout: () => Promise<void>;
  setEmpresa: (empresa: Empresa) => void;
  setSucursal: (sucursal: Sucursal) => void;
  setToken: (token: string) => void;
  setUser: (user: UserInfo) => void;
  initialize: () => void;
  changeEmpresaSucursal: (empresa: Empresa, sucursal: Sucursal) => Promise<void>;

  loginStepOne: (username: string) => Promise<void>;
  loginStepTwo: (
    password: string,
    domain: string,
    options?: { requireContextSelection?: boolean }
  ) => Promise<void>;
  loginStepThree: (empresaId: string, sucursalId: string, areaId?: string) => Promise<void>;
  resetLoginFlow: () => void;

  resolveArea: (empresaId: string | number) => Area | null;
  loadProfile: () => Promise<void>;
  setCatalogs: (empresas: Empresa[], sucursales: Sucursal[], areas: Area[]) => void;

  setHasFirma: (has: boolean) => void;
  fetchProfileSignature: () => Promise<void>;

  updateUserFromSse: (sseUser: SseUserInfo) => void;
}
