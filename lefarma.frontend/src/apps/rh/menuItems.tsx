import { LayoutDashboard, HelpCircle } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

/**
 * RH (Recursos Humanos) sidebar navigation config. Paths are absolute with
 * the `/rh/` prefix (RH is mounted at `/rh/`).
 *
 * TODO: add future RH menu entries (empleados, nóminas, vacaciones, etc.)
 * as the app grows. Each entry can carry a `permission` guard identical to
 * the CxP pattern.
 */
export const rhMenuItems: SidebarMenuItemConfig[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/rh/dashboard',
  },
  {
    title: 'Ayuda',
    icon: HelpCircle,
    path: '/rh/help',
  },
];
