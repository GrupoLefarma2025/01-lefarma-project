// ─── Help Article ──────────────────────────────────────────────────────────────


export interface HelpArticle {
  id: number;
  titulo: string;
  contenido: string;
  resumen?: string;
  modulo: string;
  tipo: string;
  categoria?: string;
  orden: number;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  creadoPor?: string;
  actualizadoPor?: string;
}

// ─── Help Module ──────────────────────────────────────────────────────────────

export interface HelpModule {
  id: number;
  nombre: string;
  label: string;
  orden: number;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface CreateHelpModuleRequest {
  nombre: string;
  label: string;
  orden?: number;
}

export interface UpdateHelpModuleRequest extends CreateHelpModuleRequest {
  id: number;
  activo?: boolean;
}

// ─── Create Request ─────────────────────────────────────────────────────────────

export interface CreateHelpArticleRequest {
  titulo: string;
  contenido: string;
  resumen?: string;
  modulo: string;
  tipo: string;
  categoria?: string;
  orden: number;
}

// ─── Update Request ─────────────────────────────────────────────────────────────

export interface UpdateHelpArticleRequest extends CreateHelpArticleRequest {
  id: number;
  activo: boolean;
}

// ─── Help Image ─────────────────────────────────────────────────────────────────

export interface HelpImage {
  id: number;
  nombreOriginal: string;
  nombreArchivo: string;
  rutaRelativa: string;
  tamanhoBytes: number;
  mimeType: string;
  fechaSubida: string;
  subidoPor?: string;
}

// ─── Help Image Upload Response ─────────────────────────────────────────────────

export interface HelpImageUploadResponse {
  id: number;
  nombreOriginal: string;
  nombreArchivo: string;
  rutaRelativa: string;
  tamanhoBytes: number;
  mimeType: string;
  ancho?: number;
  alto?: number;
  fechaSubida: string;
}
