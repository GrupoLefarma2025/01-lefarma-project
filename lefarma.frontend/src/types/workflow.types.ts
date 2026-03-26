// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface Workflow {
  idWorkflow: number;
  nombre: string;
  descripcion?: string;
  codigoProceso: string; // 'ORDEN_COMPRA', 'SOLICITUD_VIATICOS', etc.
  version: number;
  activo: boolean;
  fechaCreacion: string;
}

// ─── WorkflowPaso ─────────────────────────────────────────────────────────────

export interface WorkflowPaso {
  idPaso: number;
  idWorkflow: number;
  orden: number;
  nombrePaso: string;
  codigoEstado?: string; // 'EN_REVISION_F2', 'AUTORIZADA', etc.
  descripcionAyuda?: string;
  handlerKey?: string; // 'Firma3Handler', 'Firma4Handler', etc.
  esInicio: boolean;
  esFinal: boolean;
  requiereFirma: boolean;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  acciones?: WorkflowAccion[]; // Acciones que salen de este paso
  condiciones?: WorkflowCondicion[]; // Condiciones de routing dinámico
  participantes?: WorkflowParticipante[]; // Quién puede actuar en este paso
}

// ─── WorkflowAccion ───────────────────────────────────────────────────────────

export interface WorkflowAccion {
  idAccion: number;
  idPasoOrigen: number;
  idPasoDestino?: number; // null si finaliza el flujo
  nombreAccion: string; // 'Autorizar', 'Rechazar', etc.
  tipoAccion: 'APROBACION' | 'RECHAZO' | 'RETORNO' | 'CANCELACION';
  claseEstetica?: string; // 'success', 'danger', 'warning', 'primary'
  notificaciones?: WorkflowNotificacion[]; // Notificaciones que dispara esta acción
}

// ─── WorkflowCondicion ────────────────────────────────────────────────────────

export interface WorkflowCondicion {
  idCondicion: number;
  idPaso: number;
  campoEvaluacion: string; // 'Total', 'TipoGasto', etc.
  operador: '>' | '<' | '=' | '>=' | '<=' | '!=' | 'IN';
  valorComparacion: string;
  idPasoSiCumple: number;
}

// ─── WorkflowParticipante ─────────────────────────────────────────────────────

export interface WorkflowParticipante {
  idParticipante: number;
  idPaso: number;
  idRol?: number;
  idUsuario?: number;
}

// ─── WorkflowNotificacion ─────────────────────────────────────────────────────

export interface WorkflowNotificacion {
  idNotificacion: number;
  idAccion: number;
  enviarEmail: boolean;
  enviarWhatsapp: boolean;
  enviarTelegram: boolean;
  avisarAlCreador: boolean;
  avisarAlSiguiente: boolean;
  avisarAlAnterior: boolean;
  asuntoTemplate?: string;
  cuerpoTemplate: string;
}

// ─── WorkflowBitacora ─────────────────────────────────────────────────────────

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
}

export interface WorkflowWithStats extends Workflow {
  stats?: WorkflowStats;
}
