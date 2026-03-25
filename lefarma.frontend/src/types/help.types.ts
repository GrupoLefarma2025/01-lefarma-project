// ─── Help Article ──────────────────────────────────────────────────────────────

export interface HelpArticle {
  id: number;
  titulo: string;
  contenido: string; // Lexical JSON
  resumen?: string;
  modulo: 'Catalogos' | 'Auth' | 'Notificaciones' | 'Profile' | 'Admin' | 'SystemConfig' | 'General';
  tipo: 'usuario' | 'desarrollador' | 'ambos';
  categoria?: string;
  orden: number;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  creadoPor?: string;
  actualizadoPor?: string;
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
