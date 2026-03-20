// Tipos de notificación
export type TipoNotificacion = 'in-app' | 'email' | 'telegram' | 'whatsapp';

// Preferencias de notificación
export interface NotificacionPreference {
  tipo: TipoNotificacion;
  enabled: boolean;
  config?: Record<string, string>; // Para configuración específica (ej. telegram chat_id)
}

// Configuración de UI
export interface UIConfig {
  tema: 'light' | 'dark' | 'system';
  notificaciones: {
    tiposHabilitados: TipoNotificacion[];
    preferencias: NotificacionPreference[];
  };
}

// Configuración de perfil
export interface PerfilConfig {
  nombre: string;
  correo: string;
  telefono?: string;
  notificacionPreferida: TipoNotificacion;
}

// Variables de entorno/sistema (solo lectura para usuario normal)
export interface SistemaConfig {
  version: string;
  apiUrl: string;
  appName: string;
  environment: 'development' | 'staging' | 'production';
  buildDate?: string;
  gitCommit?: string;
}

// Configuración completa
export interface ConfigState {
  ui: UIConfig;
  perfil: PerfilConfig;
  sistema: SistemaConfig;

  // Actions
  setTema: (tema: UIConfig['tema']) => void;
  updateNotificacion: (tipo: TipoNotificacion, enabled: boolean) => void;
  setNotificacionPreferida: (tipo: TipoNotificacion) => void;
  updatePerfil: (perfil: Partial<PerfilConfig>) => void;
  resetConfig: () => void;
}
