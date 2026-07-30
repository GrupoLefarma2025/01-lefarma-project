export interface DiaNoHabilResponse {
  idDiaNoHabil: number;
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
}

export interface DiaNoHabilFechaRequest {
  anio: number;
  mes: number;
  dia: number;
  descripcion?: string;
}

export interface CargaDiasNoHabilesRequest {
  idEmpresa: number;
  idSucursal?: number;
  fechas: DiaNoHabilFechaRequest[];
  descripcionGeneral?: string;
}

export interface BulkUploadRowError {
  rowNumber: number;
  rowData: string;
  error: string;
}

export interface CargaDiasNoHabilesResultResponse {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: BulkUploadRowError[];
  usuariosAfectados: number;
  vacacionesGeneradas: number;
}

export interface DiaUsuarioResponse {
  idDiaUsuario: number;
  idUsuario: number;
  usuarioNombre?: string;
  idEmpresa: number;
  idSucursal?: number;
  fecha: string;
  idTipoDia: number;
  tipoDiaNombre?: string;
  origen: string;
  estado?: string | null;
  consumeSaldo: boolean;
  idDiaNoHabil?: number;
  comentarios?: string;
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

export interface DiaUsuarioRequest {
  idUsuario: number;
  anio?: number;
}

export interface SaldoVacacionesRequest {
  idEmpresa?: number;
  idUsuario?: number;
  anio?: number;
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

export interface DiaNoHabilFilters {
  idEmpresa?: number;
  idSucursal?: number;
  anio?: number;
  mes?: number;
}
