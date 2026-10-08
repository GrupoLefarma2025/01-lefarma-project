import { ClipboardCheck, Plane } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

export const viaticosMenuItems: SidebarMenuItemConfig[] = [
  {
    title: 'Viáticos',
    icon: Plane,
    path: '/viaticos/dashboard',
  },
  {
    // `viaticos.ver_todos` es el permiso de la bandeja global; sin él, el
    // backend ya recorta la lista a las solicitudes propias del usuario.
    title: 'Bandeja de autorizaciones',
    icon: ClipboardCheck,
    path: '/viaticos/aprobaciones',
    permission: { require: 'viaticos.ver_todos' },
  },
];