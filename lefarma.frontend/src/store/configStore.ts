import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConfigState, UIConfig, PerfilConfig, SistemaInfo, ConfiguracionGlobal } from '@/types/config.types';
import type { UIPresetId, VisualPreferences, ComponentPreferences } from '@/types/config.types';
import { UI_PRESETS } from '@/constants/uiPresets';
import { useAuthStore } from './authStore';


const DEFAULT_UI_CONFIG: UIConfig = {
  tema: 'light',
  presetId: 'estandar', // NEW
  visual: { // NEW
    densidad: 'comodo',
    fontSize: 'medium',
    animations: true,
  },
  componentes: { // NEW
    tables: {
      density: 'standard',
      defaultPageSize: 20,
    },
    sidebar: {
      defaultCollapsed: false,
    },
  },
  notificaciones: {
    tiposHabilitados: ['in-app'],
    preferencias: [
      { tipo: 'in-app', enabled: true },
      { tipo: 'email', enabled: false },
      { tipo: 'telegram', enabled: false },
      { tipo: 'whatsapp', enabled: false },
    ],
  },
};

const DEFAULT_SISTEMA_INFO: SistemaInfo = {
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  appName: import.meta.env.VITE_APP_NAME || 'Lefarma',
  environment: (import.meta.env.MODE as SistemaInfo['environment']) || 'development',
  buildDate: import.meta.env.VITE_BUILD_DATE,
  gitCommit: import.meta.env.VITE_GIT_COMMIT,
};

// Configuración global por defecto (valores iniciales, después vendrían del backend)
const DEFAULT_GLOBAL_CONFIG: ConfiguracionGlobal = {
  sessionTimeout: 480, // 8 horas
  sessionWarning: 10, // 10 minutos antes

  maxFileSize: 10, // 10 MB
  allowedFileTypes: ['.pdf', '.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.doc', '.docx'],

  defaultCurrency: 'MXN',
  defaultDateFormat: 'DD/MM/YYYY',
  defaultTimeFormat: '24h',
  defaultPageSize: 20,

  notificacionesEnabled: true,
  notificacionesJobSchedule: '0 8 * * *', // 8:00 AM diario

  tipoCambioDefecto: 24.50,
  impuestoPorDefecto: 15.0,

  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: true,
  maxLoginAttempts: 5,
  lockoutDuration: 15, // 15 minutos

  metadata: {
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  },
};

// Helper function to apply visual preferences via CSS variables
const applyVisualPreferences = (visual: VisualPreferences) => {
  const root = document.documentElement;

  // Font scale
  const fontScales: Record<VisualPreferences['fontSize'], number> = {
    small: 0.875,
    medium: 1,
    large: 1.125,
  };
  root.style.setProperty('--font-scale', fontScales[visual.fontSize].toString());

  // Spacing factor
  const spacingFactors: Record<VisualPreferences['densidad'], number> = {
    compacto: 0.75,
    comodo: 1,
  };
  root.style.setProperty('--spacing-factor', spacingFactors[visual.densidad].toString());

  // Animations
  if (!visual.animations) {
    root.setAttribute('data-no-animations', 'true');
    root.style.setProperty('--transition-duration', '0ms');
  } else {
    root.removeAttribute('data-no-animations');
    root.style.removeProperty('--transition-duration');
  }
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      ui: DEFAULT_UI_CONFIG,

      perfil: {
        nombre: '',
        correo: '',
        notificacionPreferida: 'in-app',
      },

      sistema: DEFAULT_SISTEMA_INFO,

      globalConfig: DEFAULT_GLOBAL_CONFIG,

      setTema: (tema: UIConfig['tema']) => {
        set((state) => ({
          ui: { ...state.ui, tema },
        }));

        // Aplicar tema inmediatamente
        const htmlElement = document.documentElement;
        const root = window;

        if (tema === 'dark') {
          htmlElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else if (tema === 'light') {
          htmlElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        } else {
          // system
          localStorage.removeItem('theme');
          const prefersDark = root.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            htmlElement.classList.add('dark');
          } else {
            htmlElement.classList.remove('dark');
          }
        }
      },

      setPreset: (presetId: UIPresetId) => {
        const preset = UI_PRESETS[presetId];
        set((state) => ({
          ui: {
            ...state.ui,
            presetId,
            visual: preset.config.visual,
            componentes: preset.config.componentes,
          },
        }));
        applyVisualPreferences(preset.config.visual);
      },

      updateVisualPreferences: (updates: Partial<VisualPreferences>) => {
        set((state) => ({
          ui: {
            ...state.ui,
            visual: { ...state.ui.visual, ...updates },
          },
        }));
        const newVisual = { ...get().ui.visual, ...updates };
        applyVisualPreferences(newVisual);
      },

      updateComponentPreferences: (updates: Partial<ComponentPreferences>) => {
        set((state) => ({
          ui: {
            ...state.ui,
            componentes: {
              ...state.ui.componentes,
              ...updates,
              tables: {
                ...state.ui.componentes.tables,
                ...(updates.tables || {}),
              },
              sidebar: {
                ...state.ui.componentes.sidebar,
                ...(updates.sidebar || {}),
              },
            },
          },
        }));
      },

      updateNotificacion: (tipo, enabled) => {
        set((state) => ({
          ui: {
            ...state.ui,
            notificaciones: {
              ...state.ui.notificaciones,
              preferencias: state.ui.notificaciones.preferencias.map((p) =>
                p.tipo === tipo ? { ...p, enabled } : p
              ),
              tiposHabilitados: enabled
                ? [...new Set([...state.ui.notificaciones.tiposHabilitados, tipo])]
                : state.ui.notificaciones.tiposHabilitados.filter((t) => t !== tipo),
            },
          },
        }));
      },

      setNotificacionPreferida: (tipo) => {
        set((state) => ({
          perfil: {
            ...state.perfil,
            notificacionPreferida: tipo,
          },
        }));
      },

      updatePerfil: (perfilUpdates) => {
        set((state) => ({
          perfil: {
            ...state.perfil,
            ...perfilUpdates,
          },
        }));
      },

      updateGlobalConfig: (configUpdates) => {
        set((state) => ({
          globalConfig: {
            ...state.globalConfig,
            ...configUpdates,
            metadata: {
              updatedAt: new Date().toISOString(),
              updatedBy: useAuthStore.getState().user?.username || 'unknown',
            },
          },
        }));
      },

      resetConfig: () => {
        const user = useAuthStore.getState().user;
        const defaultPreset = UI_PRESETS.estandar;
        set({
          ui: {
            tema: 'light',
            presetId: 'estandar',
            visual: defaultPreset.config.visual,
            componentes: defaultPreset.config.componentes,
            notificaciones: {
              tiposHabilitados: ['in-app'],
              preferencias: [
                { tipo: 'in-app', enabled: true },
                { tipo: 'email', enabled: false },
                { tipo: 'telegram', enabled: false },
                { tipo: 'whatsapp', enabled: false },
              ],
            },
          },
          perfil: {
            nombre: user?.nombre || '',
            correo: user?.correo || '',
            notificacionPreferida: 'in-app',
          },
        });
        applyVisualPreferences(defaultPreset.config.visual);
      },
    }),
    {
      name: 'config-storage',
      partialize: (state) => ({
        ui: state.ui,
        perfil: state.perfil,
      }), // No persistir sistema (se lee de env vars) ni globalConfig (vendría del backend)
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Record<string, unknown>),
        ui: {
          ...currentState.ui,
          ...(persistedState as any)?.ui,
          componentes: {
            ...currentState.ui.componentes,
            ...(persistedState as any)?.ui?.componentes,
          },
          visual: {
            ...currentState.ui.visual,
            ...(persistedState as any)?.ui?.visual,
          },
        },
        perfil: {
          ...currentState.perfil,
          ...(persistedState as any)?.perfil,
        },
      }),
    }
  )
);
