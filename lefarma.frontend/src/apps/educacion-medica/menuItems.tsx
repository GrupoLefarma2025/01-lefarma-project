import { LayoutDashboard, HelpCircle } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

/**
 * Config de navegación del sidebar de Educación Médica. Los paths son
 * absolutos con el prefijo `/educacion-medica/` (Educación Médica está montada
 * en `/educacion-medica/`).
 *
 * TODO: agregar futuras entradas de menú de Educación Médica (cursos,
 * capacitaciones, certificaciones, etc.) conforme crezca la app. Cada entrada
 * puede llevar un guard de `permission` idéntico al patrón de CxP.
 */
export const educacionMedicaMenuItems: SidebarMenuItemConfig[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/educacion-medica/dashboard',
  },
  {
    title: 'Ayuda',
    icon: HelpCircle,
    path: '/educacion-medica/help',
  },
];
