import { LayoutDashboard, User } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

/**
 * Shell sidebar navigation config. The root base-app shell (hub, perfil) uses
 * the same MainLayout + AppSidebar + Header as the apps, but with shell-only
 * items and no context (showContext=false).
 */
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
];
