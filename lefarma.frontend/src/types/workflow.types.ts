export interface Workflow {
  idWorkflow: number;
  nombre: string;
  descripcion?: string;
  codigoProceso: string; 
  version: number;
  activo: boolean;
  fechaCreacion: string;
  campos?: WorkflowCampo[];
}

export interface WorkflowPaso {
  idPaso: number;
  idWorkflow: number;
  orden: number;
  nombrePaso: string;
  idEstado?: number; 
  descripcionAyuda?: string;
  esInicio: boolean;
  esFinal: boolean;
  activo: boolean;
  requiereFirma: boolean;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  permiteEditar?: boolean;
  acciones?: WorkflowAccion[]; 
  condiciones?: WorkflowCondicion[]; 
  participantes?: WorkflowParticipante[]; 
}

export interface WorkflowTipoAccion {
  idTipoAccion: number;
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  cambiaEstado: boolean;
  activo: boolean;
  codigoProceso?: string;
}

export interface WorkflowAccion {
  idAccion: number;
  idPasoOrigen: number;
  idPasoDestino?: number; 
  idTipoAccion: number;
  tipoAccionCodigo?: string;
  tipoAccionNombre?: string;
  tipoAccionCambiaEstado?: boolean;
  enviaConcentrado?: boolean;
  activo: boolean;
  handlers?: WorkflowAccionHandler[];
  notificaciones?: WorkflowNotificacion[]; 
}

export interface WorkflowAccionHandler {
  idHandler: number;
  handlerKey: string;
  requerido: boolean;
  configuracionJson?: string | null;
  ordenEjecucion: number;
  activo: boolean;
  idWorkflowCampo?: number | null;
  campo?: WorkflowCampo | null;
}

export interface WorkflowCampo {
  idWorkflowCampo: number;
  nombreTecnico: string;
  etiquetaUsuario: string;
  tipoControl: string;
  sourceCatalog?: string;
  propiedadEntidad?: string;
  validarFiscal?: boolean;
  usarEnCondiciones: boolean;
  codigoProceso?: string | null;
  activo: boolean;
}

export interface WorkflowCondicion {
  idCondicion: number;
  idAccion: number;
  campoEvaluacion: string; 
  operador: '>' | '<' | '=' | '>=' | '<=' | '!=' | 'IN' | 'true' | 'false';
  valorComparacion: string;
  idPasoSiCumple: number;
  activo: boolean;
}

export interface WorkflowParticipante {
  idParticipante: number;
  idPaso: number;
  idRol?: number;
  idUsuario?: number;
  requiereJefeInmediato: boolean;
  nivelJefe?: number | null;
  activo: boolean;
}

export interface WorkflowNotificacionCanal {
  idNotificacionCanal?: number;
  codigoCanal: string;
  asuntoTemplate?: string;
  cuerpoTemplate: string;
  listadoRowHtml?: string;
  activo: boolean;
}

export interface WorkflowNotificacion {
  idNotificacion: number;
  idAccion: number;
  idPasoDestino?: number;
  idTipoNotificacion?: number;
  enviarEmail: boolean;
  enviarWhatsapp: boolean;
  enviarTelegram: boolean;
  avisarAlCreador: boolean;
  avisarAlSiguiente: boolean;
  avisarAlAnterior: boolean;
  avisarAAutorizadoresPrevios: boolean;
  incluirPartidas: boolean;
  activo: boolean;
  canales?: WorkflowNotificacionCanal[];
}

export interface WorkflowEstado {
  idEstado: number;
  codigo?: string;
  nombre?: string;
  colorHex?: string;
  activo: boolean;
}

export interface WorkflowTipoNotificacion {
  idTipo: number;
  idTipoNotificacion?: number;
  codigoTipo?: string;
  nombre?: string;
  icono?: string;
  activo?: boolean;
}

export interface CanalTemplate {
  idTemplate?: number;
  codigoCanal: string;
  nombre: string;
  layoutHtml: string;
  activo: boolean;
}

export interface WorkflowRecordatorio {
  idRecordatorio?: number;
  idTipoNotificacion: number;
  diasAntes?: number;
  horaEnvio?: string;
  activo: boolean;
  canales?: WorkflowNotificacionCanal[];
}

export interface WorkflowBitacora {
  idEvento: number;
  idOrden: number;
  idWorkflow: number;
  idPaso: number;
  idAccion: number;
  idUsuario: number;
  comentario?: string;
  datosSnapshot?: string; 
  fechaEvento: string;
}

export interface WorkflowStats {
  totalPasos: number;
  totalAcciones: number;
  totalCondiciones: number;
  totalNotificaciones: number;
  totalMappings: number;
}

export interface WorkflowWithStats extends Workflow {
  stats?: WorkflowStats;
  idUsuariosJefeExcluidos?: number[];
}

export interface WorkflowScopeType {
  idScopeType: number;
  codigo: string;
  nombre: string;
  nivelPrioridad: number;
  descripcion?: string;
  activo: boolean;
  fechaCreacion: string;
}

export interface WorkflowMapping {
  idMapping: number;
  codigoProceso: string;
  idScopeType: number;
  scopeTypeNombre?: string;
  scopeId?: number | null;
  scopeNombre?: string;
  idWorkflow: number;
  workflowNombre?: string;
  prioridadManual: number;
  activo: boolean;
  observaciones?: string | null;
  fechaCreacion: string;
  creadoPor?: number | null;
  fechaActualizacion?: string | null;
}
