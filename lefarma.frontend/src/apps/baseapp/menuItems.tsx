import { Activity, LayoutDashboard, Settings, User } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

export const shellMenuItems: SidebarMenuItemConfig[] = [
  {
    title: 'Inicio',
    icon: LayoutDashboard,
    path: '/hub',
  },
  {
    title: 'Perfil',
    icon: User,
    path: '/perfil',
  },
  {
    title: 'Configuración',
    icon: Settings,
    path: '/configuracion',
    permission: { require: 'configuracion.view' },
  },
  {
    title: 'Telemetría',
    icon: Activity,
    path: '/configuracion/telemetria',
    permission: { require: 'telemetria.ver' },
  },
];

export const configuracionMenuItems: SidebarMenuItemConfig[] = shellMenuItems.filter(
  (item) => !('path' in item) || item.path !== '/perfil',
);
