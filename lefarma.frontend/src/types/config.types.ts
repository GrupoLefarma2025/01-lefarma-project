// Tipos de notificación


export type TipoNotificacion = 'in-app' | 'email' | 'telegram' | 'whatsapp';

// Preset identifier type
export type UIPresetId = 'compacto' | 'estandar' | 'comodo' | 'accesibilidad';

// Visual preferences (apply via CSS variables)
export interface VisualPreferences {
  densidad: 'compacto' | 'comodo';
  fontSize: 'small' | 'medium' | 'large';
  animations: boolean;
}

// Component preferences (apply via props)
export interface ComponentPreferences {
  tables: {
    density: 'compact' | 'standard' | 'comfortable';
    defaultPageSize: number;
  };
  sidebar: {
    defaultCollapsed: boolean;
  };
}

// Preset configuration structure
export interface UIPreset {
  id: UIPresetId;
  nombre: string;
  descripcion: string;
  icono: any; // Lucide icon component
  config: {
    visual: VisualPreferences;
    componentes: ComponentPreferences;
  };
}

// Preferencias de notificación
export interface NotificacionPreference {
  tipo: TipoNotificacion;
  enabled: boolean;
  config?: Record<string, string>; // Para configuración específica (ej. telegram chat_id)
}

// Configuración de UI
export interface UIConfig {
  tema: 'light' | 'dark' | 'system';

  // NEW FIELDS
  presetId: UIPresetId;
  visual: VisualPreferences;
  componentes: ComponentPreferences;

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

// Variables de entorno/sistema (solo lectura, info técnica del build)
export interface SistemaInfo {
  version: string;
  apiUrl: string;
  appName: string;
  environment: 'development' | 'staging' | 'production';
  buildDate?: string;
  gitCommit?: string;
}

// Variables de configuración global (configurable en runtime, afecta a toda la app)
export interface ConfiguracionGlobal {
  // Configuración de sesión
  sessionTimeout: number; // minutos
  sessionWarning: number; // minutos antes del timeout para mostrar alerta

  // Configuración de archivos
  maxFileSize: number; // MB
  allowedFileTypes: string[]; // ej. ['.pdf', '.xlsx', '.jpg']

  // Configuración de UI global
  defaultCurrency: string; // ej. 'LPS', 'USD', 'EUR'
  defaultDateFormat: string; // ej. 'DD/MM/YYYY', 'MM/DD/YYYY'
  defaultTimeFormat: '12h' | '24h';
  defaultPageSize: number; // Items por página en tablas

  // Configuración de notificaciones globales
  notificacionesEnabled: boolean; // Si las notificaciones están habilitadas globalmente
  notificacionesJobSchedule: string; // Cron schedule para job de notificaciones

  // Configuración de negocio
  tipoCambioDefecto: number; // Tipo de cambio LPS a USD
  impuestoPorDefecto: number; // ISV o IVA en porcentaje

  // Configuración de seguridad
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number; // minutos

  metadata: {
    updatedAt: string; // Fecha de última actualización
    updatedBy: string; // Usuario que actualizó
  };
}

// Configuración completa
export interface ConfigState {
  ui: UIConfig;
  perfil: PerfilConfig;
  sistema: SistemaInfo;
  globalConfig: ConfiguracionGlobal;

  // Actions
  setTema: (tema: UIConfig['tema']) => void;
  setPreset: (presetId: UIPresetId) => void;
  updateVisualPreferences: (updates: Partial<VisualPreferences>) => void;
  updateComponentPreferences: (updates: Partial<ComponentPreferences>) => void;
  updateNotificacion: (tipo: TipoNotificacion, enabled: boolean) => void;
  setNotificacionPreferida: (tipo: TipoNotificacion) => void;
  updatePerfil: (perfil: Partial<PerfilConfig>) => void;
  updateGlobalConfig: (config: Partial<ConfiguracionGlobal>) => void;
  resetConfig: () => void;
}
