import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConfigState, UIConfig, PerfilConfig, SistemaInfo, ConfiguracionGlobal } from '@/types/config.types';
import { useAuthStore } from './authStore';

const DEFAULT_UI_CONFIG: UIConfig = {
  tema: 'system',
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

  defaultCurrency: 'LPS',
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
        set({
          ui: DEFAULT_UI_CONFIG,
          perfil: {
            nombre: user?.nombre || '',
            correo: user?.correo || '',
            notificacionPreferida: 'in-app',
          },
        });
      },
    }),
    {
      name: 'config-storage',
      partialize: (state) => ({
        ui: state.ui,
        perfil: state.perfil,
      }), // No persistir sistema (se lee de env vars) ni globalConfig (vendría del backend)
    }
  )
);
