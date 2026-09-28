export interface DiaHabilResponse {
  idDiaHabil: number;
  idEmpresa: number;
  empresaNombre?: string;
  idSucursal?: number;
  sucursalNombre?: string;
  anio: number;
  mes: number;
  dia: number;
  fecha: string;
  descripcion?: string;
  activo: boolean;
  consumeSaldo: boolean;
}

export interface DiaHabilFechaRequest {
  anio: number;
  mes: number;
  dia: number;
  descripcion?: string;
  consumeSaldo: boolean;
}

export interface CargaDiasHabilesRequest {
  idEmpresa: number;
  idSucursal?: number;
  fechas: DiaHabilFechaRequest[];
  descripcionGeneral?: string;
}

export interface BulkUploadRowError {
  rowNumber: number;
  rowData: string;
  error: string;
}

export interface CargaDiasHabilesResultResponse {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: BulkUploadRowError[];
  usuariosAfectados: number;
  vacacionesGeneradas: number;
}

export interface SaldoVacacionesResponse {
  idSaldo: number;
  idUsuario: number;
  usuarioNombre?: string;
  nomina?: number;
  idEmpresa: number;
  empresaNombre?: string;
  anio: number;
  diasGenerados: number;
  diasVencidos: number;
  diasCompensados: number;
  diasAjustados: number;
  diasTomados: number;
  diasPendientes: number;
  activo: boolean;
}

export interface UsuarioAfectadoResponse {
  idUsuario: number;
  nombreCompleto?: string;
  numeroEmpleado?: string;
  puesto?: string;
  idEmpresa: number;
  empresaNombre?: string;
  idSucursal?: number;
  sucursalNombre?: string;
  activo: boolean;
}

export interface SaldoVacacionesRequest {
  idEmpresa?: number;
  idUsuario?: number;
  anio?: number;
}

export interface SolicitudVacacionesDetalle {
  idSolicitud: number;
  folio: string;
  estadoCodigo?: string;
  estadoNombre?: string;
  enTramite: boolean;
  fechaInicio: string;
  fechaFin: string;
  dias: number;
  fechas: string[];
}

export interface SaldoVacacionesHistorial {
  idSaldo: number;
  anio: number;
  diasGenerados: number;
  diasVencidos: number;
  diasCompensados: number;
  diasAjustados: number;
  diasTomados: number;
  diasPendientes: number;
}

export interface SaldoVacacionesDetalle {
  idSaldo: number;
  idUsuario: number;
  usuarioNombre?: string;
  correo?: string;
  nomina?: number;
  idEmpresa: number;
  empresaNombre?: string;
  anio: number;
  puesto?: string;
  departamento?: string;
  empleadoEmpresa?: string;
  fechaIngreso?: string;
  antiguedad?: number;
  vacacionesPorAntiguedad?: number;
  diasGenerados: number;
  diasVencidos: number;
  diasCompensados: number;
  diasAjustados: number;
  diasTomados: number;
  diasPendientes: number;
  fechaModificacion?: string;
  ajustadoPor?: string;
  motivoAjuste?: string;
  diasEnTramite: number;
  diasPendientesProyectado: number;
  solicitudes: SolicitudVacacionesDetalle[];
  historial: SaldoVacacionesHistorial[];
}

export interface SaldoVacacionesAjusteRequest {
  diasAjustados?: number | null;
  diasVencidos?: number | null;
  diasCompensados?: number | null;
  motivo: string;
}

export interface SaldoVacacionesCreateRequest {
  idUsuario: number;
  idEmpresa: number;
  anio: number;
  diasGenerados?: number;
  diasVencidos: number;
  diasCompensados: number;
  diasAjustados: number;
  diasTomados: number;
}

export interface SincronizarSaldosRequest {
  anio?: number;
}

export interface SincronizarSaldosResponse {
  anio: number;
  total: number;
  creados: number;
  actualizados: number;
  omitidos: number;
}

export interface DiaHabilFilters {
  idEmpresa?: number;
  idSucursal?: number;
  anio?: number;
  mes?: number;
}
