import type { SaldoVacacionesResponse } from './vacaciones.types';

export const CATEGORIAS_SOLICITUD: Record<string, string> = {
  '1': 'Incidencia',
  '2': 'Permiso',
  '3': 'Vacaciones',
  '4': 'Goce de Sueldo',
  '5': 'Incapacidad',
  Incidencia: 'Incidencia',
  Permiso: 'Permiso',
  Vacaciones: 'Vacaciones',
  GoceDeSueldo: 'Goce de Sueldo',
  Incapacidad: 'Incapacidad',
};

export function getCategoriaNombre(categoria?: string | number | null): string {
  if (categoria == null || categoria === '') return '-';
  const key = String(categoria);
  return CATEGORIAS_SOLICITUD[key] ?? String(categoria);
}

export interface CreateSolicitudPersonalRequest {
  idSolicitud: number;
  idEmpresa: number;
  idSucursal: number;
  idArea?: number | null;
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
  solicitanteNombre?: string;
  solicitantePuesto?: string;
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
  esIncapacidad: boolean;
  requiereReposicionTiempo: boolean;
  requiereFechaFin: boolean;
  requiereFechaRegreso: boolean;
  requiereLugarComision: boolean;
  descuentaNomina: boolean;
  descuentaVacaciones: boolean;
  requiereDocumentacion: boolean;
  permiteFechasPasadas: boolean;
  permiteFechasFuturas: boolean;
  tomaEnCuentaChecado: boolean;
  requiereIncidenciasExistentes: boolean;
  pideDiasSolicitados: boolean;
  limitePorPeriodo?: number | null;
  periodoLimite?: string | null;
  totalParaDescuento?: number | null;
  requiereValidacionRH: boolean;
  requiereValidacionJefeDirecto: boolean;
  requiereValidacionGerencia: boolean;
  requiereValidacionDirector: boolean;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}

export interface CreateTipoSolicitudRequest {
  nombre: string;
  clave: string;
  categoria: string;
  descripcion?: string;
  requiereReposicionTiempo: boolean;
  requiereFechaFin: boolean;
  requiereFechaRegreso: boolean;
  requiereLugarComision: boolean;
  descuentaNomina: boolean;
  descuentaVacaciones: boolean;
  requiereDocumentacion: boolean;
  permiteFechasPasadas: boolean;
  permiteFechasFuturas: boolean;
  tomaEnCuentaChecado: boolean;
  requiereIncidenciasExistentes: boolean;
  pideDiasSolicitados: boolean;
  limitePorPeriodo?: number | null;
  periodoLimite?: string | null;
  totalParaDescuento?: number | null;
  activo: boolean;
}

export interface UpdateTipoSolicitudRequest extends CreateTipoSolicitudRequest {
  idTipoSolicitud: number;
}

export interface TipoSolicitudRequest {
  nombre?: string;
  clave?: string;
  categoria?: string;
  activo?: boolean;
  orderBy?: string;
  orderDirection?: string;
}

export interface LimitePorTipoResponse {
  idTipoSolicitud: number;
  tipo: string;
  limite: number;
  usado: number;
  disponible: number;
  periodo: string;
  periodoInicio: string;
  periodoFin: string;
}

export interface MisLimitesResponse {
  periodoActual: string;
  periodoInicio: string;
  periodoFin: string;
  limitesPorTipo: LimitePorTipoResponse[];
  saldosVacaciones: SaldoVacacionesResponse[];
}

export interface CalendarioGlobalRequest {
  anio: number;
  mes: number;
  idEmpresa?: number;
  idSucursal?: number;
  idArea?: number;
  idTipoSolicitud?: number;
  agruparPor?: 'empresa' | 'sucursal' | 'area' | 'tipo' | 'usuario';
  estados?: string[];
}

export interface CalendarioGlobalEvento {
  idSolicitud: number;
  folio: string;
  fecha: string;
  idTipoSolicitud: number;
  tipo: string;
  categoria: string;
  estado: string;
  estadoColor?: string | null;
  idEmpresa: number;
  empresaNombre?: string | null;
  idSucursal: number;
  sucursalNombre?: string | null;
  idArea: number;
  areaNombre?: string | null;
  idUsuarioCreador: number;
  solicitanteNombre?: string | null;
  grupoClave?: string | null;
  grupoNombre?: string | null;
}

export interface CalendarioLaboralResponse {
  fecha: string;
  nombreDiaSemana?: string | null;
  nombreMes?: string | null;
  laborable: boolean;
}

export interface IncidenciaChecadoResponse {
  fecha: string;
  nomina?: number | null;
  nombre?: string | null;
  empresa?: string | null;
  departamento?: string | null;
  puesto?: string | null;
  checa?: string | null;
  nombreDiaSemana?: string | null;
  diaSemana?: number | null;
  turno?: string | null;
  horario?: string | null;
  entrada?: string | null;
  salida?: string | null;
  entro?: string | null;
  salio?: string | null;
  msgError?: string | null;
  incidenciaEntrada?: string | null;
  incidenciaSalida?: string | null;
  justificada?: boolean;
  idSolicitud?: number | null;
  tipoSolicitudNombre?: string | null;
}

export interface CalendarioLaboralRequest {
  anio?: number;
  mes?: number;
  dia?: number;
  laborable?: boolean;
  excluirSabados?: boolean;
}

export interface IncidenciasChecadoConsultaRequest {
  anio?: number;
  mes?: number;
  dia?: number;
  fechaInicio?: string;
  fechaFin?: string;
  nomina?: number;
  nombre?: string;
  empresa?: string;
  departamento?: string;
  puesto?: string;
  tieneIncidenciaEntrada?: boolean;
  tieneIncidenciaSalida?: boolean;
  tieneIncidenciaOmision?: boolean;
  orderBy?: string;
  orderDirection?: string;
  page?: number;
  pageSize?: number;
}

export interface IncidenciasChecadoResumenEmpleadoRequest {
  periodo?: string;
  fechaInicio?: string;
  fechaFin?: string;
  nomina?: number;
  nombre?: string;
  empresa?: string;
  departamento?: string;
  puesto?: string;
  tieneIncidenciaEntrada?: boolean;
  tieneIncidenciaSalida?: boolean;
  tieneIncidenciaOmision?: boolean;
  orderBy?: string;
  orderDirection?: string;
  page?: number;
  pageSize?: number;
}

export interface IncidenciasChecadoResumenEmpleadoResponse {
  nomina: number;
  nombre: string;
  empresa?: string | null;
  departamento?: string | null;
  puesto?: string | null;
  totalIncidencias: number;
  tardanzas: number;
  salidasAnticipadas: number;
  omisiones: number;
  justificadas: number;
  pendientes: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CanalNotificacionResult {
  tipoCanal: string;
  notificationId: number;
  exitoso: boolean;
}

export interface PlantillaIncidenciaChecado {
  idPlantilla: number;
  codigo: string;
  nombre: string;
  codigoCanal: string;
  asunto: string | null;
  cuerpo: string;
  esDefecto: boolean;
  activo: boolean;
}

export interface NotificarIncidenciaItemRequest {
  nomina: number;
  fecha: string;
  nombre?: string | null;
  empresa?: string | null;
  departamento?: string | null;
  puesto?: string | null;
  entrada?: string | null;
  salida?: string | null;
  entro?: string | null;
  salio?: string | null;
  incidenciaEntrada?: string | null;
  incidenciaSalida?: string | null;
  msgError?: string | null;
  justificada?: boolean;
  idSolicitud?: number | null;
  tipoSolicitudNombre?: string | null;
}

export interface NotificacionPersonaResult {
  nomina: number;
  nombre?: string | null;
  exitoso: boolean;
  error?: string | null;
  canales: CanalNotificacionResult[];
}

export interface NotificarIncidenciasResumenRequest {
  nominas: number[];
  periodo?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  asunto: string;
  mensaje: string;
  listadoRowHtml?: string | null;
}

export interface NotificarIncidenciasResumenResponse {
  resultados: NotificacionPersonaResult[];
}

export interface SolicitudPersonalFilterParams {
  verTodas?: boolean;
  idEmpresa?: number;
  idSucursal?: number;
  idArea?: number;
  idTipoSolicitud?: number;
  categoria?: string;
  idUsuarioCreador?: number;
  estados?: string;
  idsEstados?: string;
  busqueda?: string;
  fechaCreacionDesde?: string;
  fechaCreacionHasta?: string;
  fechaDiasDesde?: string;
  fechaDiasHasta?: string;
  page?: number;
  pageSize?: number;
  max?: number;
  orderBy?: string;
  orderDirection?: string;
}
