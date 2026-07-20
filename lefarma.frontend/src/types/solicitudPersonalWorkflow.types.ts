export interface FirmarRequest {
  idAccion: number;
  comentario?: string | null;
  datosAdicionales?: Record<string, unknown> | null;
}

export interface FirmarResponse {
  exitoso: boolean;
  folio: string;
  estadoAnterior?: string | null;
  nuevoEstado?: string | null;
  mensaje?: string | null;
}

export interface WorkflowCampoMetadataResponse {
  idWorkflowCampo: number;
  nombreTecnico: string;
  etiquetaUsuario: string;
  tipoControl: string;
  sourceCatalog?: string | null;
}

export interface AccionHandlerMetadataResponse {
  idHandler: number;
  handlerKey: string;
  requerido: boolean;
  configuracionJson?: string | null;
  ordenEjecucion: number;
  campo?: WorkflowCampoMetadataResponse | null;
  validacionExito?: boolean | null;
  validacionMensaje?: string | null;
}

export interface AccionDisponibleResponse {
  idAccion: number;
  idTipoAccion: number;
  tipoAccionCodigo?: string | null;
  tipoAccionNombre?: string | null;
  tipoAccionCambiaEstado?: boolean | null;
  enviaConcentrado?: boolean;
  handlers: AccionHandlerMetadataResponse[];
  camposWorkflow: WorkflowCampoMetadataResponse[];
  camposRequeridos: string[];
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  permiteAdjunto: boolean;
}

export interface AccionMetadataResponse {
  idEntidad: number;
  idAccion: number;
  idTipoAccion: number;
  tipoAccionCodigo?: string | null;
  tipoAccionNombre?: string | null;
  tipoAccionCambiaEstado?: boolean | null;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  permiteAdjunto: boolean;
  handlers: AccionHandlerMetadataResponse[];
  camposWorkflow: WorkflowCampoMetadataResponse[];
  camposRequeridos: string[];
}

export interface HistorialWorkflowItemResponse {
  idEvento: number;
  idEntidad: number;
  idPaso: number;
  nombrePaso?: string | null;
  idAccion: number;
  nombreAccion?: string | null;
  idUsuario: number;
  nombreUsuario?: string | null;
  comentario?: string | null;
  datosSnapshot?: string | null;
  fechaEvento: string;
}

export interface WorkflowPasoFlowResponse {
  idPaso: number;
  orden: number;
  nombrePaso: string;
  idEstado?: number | null;
  descripcionAyuda?: string | null;
  esInicio: boolean;
  esFinal: boolean;
  activo: boolean;
  requiereFirma: boolean;
  requiereComentario: boolean;
  requiereAdjunto: boolean;
  permiteAdjunto: boolean;
}

export interface WorkflowFlowResponse {
  idWorkflow: number;
  nombre: string;
  codigoProceso: string;
  version: number;
  activo: boolean;
  pasos: WorkflowPasoFlowResponse[];
}