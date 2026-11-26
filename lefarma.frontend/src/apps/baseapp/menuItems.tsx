import { Activity, LayoutDashboard, Settings } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

const inicioItem: SidebarMenuItemConfig = {
  title: 'Inicio',
  icon: LayoutDashboard,
  path: '/hub',
};

export const shellMenuItems: SidebarMenuItemConfig[] = [inicioItem];

export const configuracionMenuItems: SidebarMenuItemConfig[] = [
  inicioItem,
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
