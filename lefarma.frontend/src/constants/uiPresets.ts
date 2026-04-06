import { Target, BarChart3, Armchair, Accessibility } from 'lucide-react';
import type { UIPreset, UIPresetId } from '@/types/config.types';

export const UI_PRESETS: Record<UIPresetId, UIPreset> = {
  compacto: {
    id: 'compacto',
    nombre: 'Compacto',
    descripcion: 'Más datos por pantalla, spacing reducido',
    icono: Target,
    config: {
      visual: {
        densidad: 'compacto',
        fontSize: 'small',
        animations: true,
      },
      componentes: {
        tables: {
          density: 'compact',
          defaultPageSize: 50,
        },
        sidebar: {
          defaultCollapsed: true,
        },
      },
    },
  },

  estandar: {
    id: 'estandar',
    nombre: 'Estándar',
    descripcion: 'Balance perfecto para uso diario',
    icono: BarChart3,
    config: {
      visual: {
        densidad: 'comodo',
        fontSize: 'medium',
        animations: true,
      },
      componentes: {
        tables: {
          density: 'standard',
          defaultPageSize: 20,
        },
        sidebar: {
          defaultCollapsed: false,
        },
      },
    },
  },

  comodo: {
    id: 'comodo',
    nombre: 'Cómodo',
    descripcion: 'Espacio amplio, fácil de leer',
    icono: Armchair,
    config: {
      visual: {
        densidad: 'comodo',
        fontSize: 'large',
        animations: true,
      },
      componentes: {
        tables: {
          density: 'comfortable',
          defaultPageSize: 10,
        },
        sidebar: {
          defaultCollapsed: false,
        },
      },
    },
  },

  accesibilidad: {
    id: 'accesibilidad',
    nombre: 'Accesibilidad',
    descripcion: 'Fuentes grandes, sin animaciones',
    icono: Accessibility,
    config: {
      visual: {
        densidad: 'comodo',
        fontSize: 'large',
        animations: false,
      },
      componentes: {
        tables: {
          density: 'comfortable',
          defaultPageSize: 10,
        },
        sidebar: {
          defaultCollapsed: false,
        },
      },
    },
  },
};
