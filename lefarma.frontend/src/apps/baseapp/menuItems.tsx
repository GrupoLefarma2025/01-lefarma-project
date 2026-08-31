import { LayoutDashboard, User } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

/**
 * Config de navegación del sidebar del shell. El shell del base-app raíz
 * (hub, perfil) usa el mismo MainLayout + AppSidebar + Header que las apps,
 * pero con items solo del shell y sin contexto (showContext=false).
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
