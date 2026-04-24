import { Rol } from './rol.types';
import { Permiso } from './permiso.types';

export interface UsuarioDetalle {
  idUsuario: number;
  idEmpresa: number;
  idSucursal: number;
  idArea?: number;
  idCentroCosto?: number;
  puesto?: string;
  numeroEmpleado?: string;
  firmaPath?: string;
  telefonoOficina?: string;
  extension?: string;
  celular?: string;
  telegramChat?: string;
  notificarEmail: boolean;
  notificarApp: boolean;
  notificarWhatsapp: boolean;
  notificarSms: boolean;
  notificarTelegram: boolean;
  notificarSoloUrgentes: boolean;
  notificarResumenDiario: boolean;
  notificarRechazos: boolean;
  notificarVencimientos: boolean;
  idUsuarioDelegado?: number;
  delegacionHasta?: string;
  avatarUrl?: string;
  temaInterfaz: string;
  dashboardInicio?: string;
  activo: boolean;
}

export interface Usuario {
  idUsuario: number;
  samAccountName?: string;
  dominio?: string;
  nombreCompleto?: string;
  correo?: string;
  esAnonimo: boolean;
  esActivo: boolean;
  esRobot: boolean;
  fechaCreacion: string;
  ultimoLogin?: string;
  roles: Rol[];
  permisosDirectos: Permiso[];
  detalle?: UsuarioDetalle;
}

export interface UpdateUsuarioRequest {
  samAccountName: string;
  nombreCompleto: string;
  correo?: string;
  rolesIds: number[];
  permisosIds: number[];
  detalle?: Partial<UsuarioDetalle>;
}
