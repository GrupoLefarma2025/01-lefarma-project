export interface CreateSolicitudPersonalRequest {
  idSolicitud: number;
  idEmpresa: number;
  idSucursal: number;
  idArea: number;
  idTipoSolicitud: number;
  motivo?: string | null;
  lugarComision?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  diasSolicitados?: number | null;
  fechaRegreso?: string | null;
  fechaReposicion?: string | null;
  detalle?: SolicitudPersonalDetalleDto[];
}

export interface SolicitudPersonalDetalleDto {
  fecha: string;
  comentario?: string | null;
}

export interface SolicitudPersonalResponse {
  idSolicitud: number;
  folio: string;
  idEmpresa: number;
  empresaNombre?: string;
  idSucursal: number;
  sucursalNombre?: string;
  idArea: number;
  areaNombre?: string;
  idEstado?: number;
  estadoNombre?: string;
  estadoColor?: string;
  idWorkflow?: number;
  idPasoActual?: number;
  pasoActual?: string;
  idUsuarioCreador: number;
  usuarioCreador?: string;
  idTipoSolicitud: number;
  tipoSolicitudNombre?: string;
  categoria: string;
  lugarComision?: string;
  motivo?: string;
  fechaEnvio?: string;
  fechaInicio?: string;
  fechaFin?: string;
  fechaReposicion?: string;
  diasSolicitados?: number;
  fechaRegreso?: string;
  fechaCreacion: string;
  fechaModificacion?: string;
  detalle?: SolicitudPersonalDetalleDto[];
}

export interface TipoSolicitudResponse {
  idTipoSolicitud: number;
  nombre: string;
  clave: string;
  categoria: string;
  descripcion: string;
  esIncidencia: boolean;
  esPermiso: boolean;
  requiereReposicionTiempo: boolean;
  requiereFechaFin: boolean;
  requiereFechaRegreso: boolean;
  requiereLugarComision: boolean;
  descuentaNomina: boolean;
  descuentaVacaciones: boolean;
  requiereDocumentacion: boolean;
  requiereValidacionRH: boolean;
  requiereValidacionJefeDirecto: boolean;
  requiereValidacionGerencia: boolean;
  requiereValidacionDirector: boolean;
}