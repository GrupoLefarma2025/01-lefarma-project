export interface WorkflowCampoMetadata {
  idWorkflowCampo: number;
  nombreTecnico: string;
  etiquetaUsuario: string;
  tipoControl: string;
  sourceCatalog?: string | null;
}

export interface AccionHandlerMetadata {
  idHandler: number;
  handlerKey: string;
  requerido: boolean;
  configuracionJson?: string | null;
  ordenEjecucion: number;
  campo?: WorkflowCampoMetadata | null;
  validacionExito?: boolean | null;
  validacionMensaje?: string | null;
}

export interface AccionWorkflow {
  idAccion: number;
  tipoAccionCodigo?: string | null;
  tipoAccionNombre?: string | null;
  tipoAccionDescripcion?: string | null;
  requiereComentario?: boolean;
  requiereAdjunto?: boolean;
  permiteAdjunto?: boolean;
  handlers?: AccionHandlerMetadata[];
  camposWorkflow?: WorkflowCampoMetadata[];
  camposRequeridos?: string[];
}

export const ACCION_BOTON_CLASES: Record<string, string> = {
  APROBAR: 'bg-blue-600 hover:bg-blue-700 text-white',
  AUTORIZAR: 'bg-blue-600 hover:bg-blue-700 text-white',
  ENVIAR: 'bg-blue-600 hover:bg-blue-700 text-white',
  RECHAZAR: 'bg-red-600 hover:bg-red-700 text-white',
  CANCELAR: 'bg-red-600 hover:bg-red-700 text-white',
  DEVOLVER: 'bg-amber-500 hover:bg-amber-600 text-white',
  CERRAR: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  NOTIFICACION: 'bg-amber-500 hover:bg-amber-600 text-white',
};

export function accionBotonClase(accion: AccionWorkflow): string {
  return (
    ACCION_BOTON_CLASES[accion.tipoAccionCodigo ?? ''] ?? 'bg-blue-600 text-white hover:bg-blue-700'
  );
}
