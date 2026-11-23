import type { ComponentType } from 'react';

export type TipoNotificacion = 'in-app' | 'email' | 'telegram' | 'whatsapp';

export type UIPresetId = 'compacto' | 'estandar' | 'comodo' | 'accesibilidad';

export interface VisualPreferences {
  densidad: 'compacto' | 'comodo';
  fontSize: 'small' | 'medium' | 'large';
  animations: boolean;
}

export interface ComponentPreferences {
  tables: {
    density: 'compact' | 'standard' | 'comfortable';
    defaultPageSize: number;
  };
  sidebar: {
    defaultCollapsed: boolean;
  };
}

export interface UIPreset {
  id: UIPresetId;
  nombre: string;
  descripcion: string;
  icono: ComponentType<{ className?: string }>;
  config: {
    visual: VisualPreferences;
    componentes: ComponentPreferences;
  };
}

export interface NotificacionPreference {
  tipo: TipoNotificacion;
  enabled: boolean;
  config?: Record<string, string>; 
}

export interface UIConfig {
  tema: 'light' | 'dark' | 'system';

  presetId: UIPresetId;
  visual: VisualPreferences;
  componentes: ComponentPreferences;
  sidebarCollapsed: boolean;

  notificaciones: {
    tiposHabilitados: TipoNotificacion[];
    preferencias: NotificacionPreference[];
  };
}

export interface PerfilConfig {
  nombre: string;
  correo: string;
  telefono?: string;
  notificacionPreferida: TipoNotificacion;
}

export interface SistemaInfo {
  version: string;
  apiUrl: string;
  appName: string;
  environment: 'development' | 'staging' | 'production';
  buildDate?: string;
  gitCommit?: string;
}

export interface ConfiguracionGlobal {
  sessionTimeout: number; 
  sessionWarning: number; 

  maxFileSize: number; 
  allowedFileTypes: string[]; 

  defaultCurrency: string; 
  defaultDateFormat: string; 
  defaultTimeFormat: '12h' | '24h';
  defaultPageSize: number; 

  notificacionesEnabled: boolean; 
  notificacionesJobSchedule: string; 

  tipoCambioDefecto: number; 
  impuestoPorDefecto: number; 

  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number; 

  metadata: {
    updatedAt: string; 
    updatedBy: string; 
  };
}

export interface ConfigState {
  ui: UIConfig;
  perfil: PerfilConfig;
  sistema: SistemaInfo;
  globalConfig: ConfiguracionGlobal;

  setTema: (tema: UIConfig['tema']) => void;
  setPreset: (presetId: UIPresetId) => void;
  updateVisualPreferences: (updates: Partial<VisualPreferences>) => void;
  updateComponentPreferences: (updates: Partial<ComponentPreferences>) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  updateNotificacion: (tipo: TipoNotificacion, enabled: boolean) => void;
  setNotificacionPreferida: (tipo: TipoNotificacion) => void;
  updatePerfil: (perfil: Partial<PerfilConfig>) => void;
  updateGlobalConfig: (config: Partial<ConfiguracionGlobal>) => void;
  resetConfig: () => void;
}
