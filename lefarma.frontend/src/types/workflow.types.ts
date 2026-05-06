// ─── Workflow ─────────────────────────────────────────────────────────────────


export interface Workflow {
  idWorkflow: number;
  nombre: string;
  descripcion?: string;
  codigoProceso: string; // 'ORDEN_COMPRA', 'SOLICITUD_VIATICOS', etc.
  version: number;
  activo: boolean;
  fechaCreacion: string;
  campos?: WorkflowCampo[];
}

// ─── WorkflowPaso ─────────────────────────────────────────────────────────────

export interface WorkflowPaso {
  idPaso: number;
  idWorkflow: number;
  orden: number;
  nombrePaso: string;
  idEstado?: number; // FK a WorkflowEstados
  descripcionAyuda?: string;
  esInicio: boolean;
  esFinal: boolean;
  activo: boolean;
  requiereFirma: boolean;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  acciones?: WorkflowAccion[]; // Acciones que salen de este paso
  condiciones?: WorkflowCondicion[]; // Condiciones de routing dinámico
  participantes?: WorkflowParticipante[]; // Quién puede actuar en este paso
}

// ─── WorkflowAccion ───────────────────────────────────────────────────────────

export interface WorkflowTipoAccion {
  idTipoAccion: number;
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  cambiaEstado: boolean;
  activo: boolean;
}

export interface WorkflowAccion {
  idAccion: number;
  idPasoOrigen: number;
  idPasoDestino?: number; // null si finaliza el flujo
  idTipoAccion: number;
  tipoAccionCodigo?: string;
  tipoAccionNombre?: string;
  tipoAccionCambiaEstado?: boolean;
  enviaConcentrado?: boolean;
  activo: boolean;
  handlers?: WorkflowAccionHandler[];
  notificaciones?: WorkflowNotificacion[]; // Notificaciones que dispara esta acción
}

export interface WorkflowAccionHandler {
  idHandler: number;
  handlerKey: string;
  configuracionJson?: string;
  ordenEjecucion: number;
  activo: boolean;
}

export interface WorkflowCampo {
  idWorkflowCampo: number;
  idWorkflow: number;
  nombreTecnico: string;
  etiquetaUsuario: string;
  tipoControl: string;
  sourceCatalog?: string;
  propiedadEntidad?: string;
  validarFiscal?: boolean;
  activo: boolean;
}

// ─── WorkflowCondicion ────────────────────────────────────────────────────────

export interface WorkflowCondicion {
  idCondicion: number;
  idPaso: number;
  campoEvaluacion: string; // 'Total', 'TipoGasto', etc.
  operador: '>' | '<' | '=' | '>=' | '<=' | '!=' | 'IN';
  valorComparacion: string;
  idPasoSiCumple: number;
  activo: boolean;
}

// ─── WorkflowParticipante ─────────────────────────────────────────────────────

export interface WorkflowParticipante {
  idParticipante: number;
  idPaso: number;
  idRol?: number;
  idUsuario?: number;
  activo: boolean;
}

// ─── WorkflowNotificacion ─────────────────────────────────────────────────────

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

// ─── WorkflowBitacora ─────────────────────────────────────────────────────────

export interface WorkflowEstado {
  idEstado: number;
  codigo?: string;
  nombre?: string;
  colorHex?: string;
  activo: boolean;
}

export interface WorkflowBitacora {
  idEvento: number;
  idOrden: number;
  idWorkflow: number;
  idPaso: number;
  idAccion: number;
  idUsuario: number;
  comentario?: string;
  datosSnapshot?: string; // JSON
  fechaEvento: string;
}

// ─── WorkflowStats (para la lista) ───────────────────────────────────────────

export interface WorkflowStats {
  totalPasos: number;
  totalAcciones: number;
  totalCondiciones: number;
  totalNotificaciones: number;
  totalMappings: number;
}

export interface WorkflowWithStats extends Workflow {
  stats?: WorkflowStats;
}

// Scope types and mappings (backend additions)
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
