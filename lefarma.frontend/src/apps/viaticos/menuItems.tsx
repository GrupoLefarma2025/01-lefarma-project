import { ClipboardCheck, Luggage, Plane } from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

export const viaticosMenuItems: SidebarMenuItemConfig[] = [
  {
    title: 'Solicitud de viáticos',
    icon: Plane,
    path: '/viaticos/solicitud',
  },
  {
    title: 'Mis viajes',
    icon: Luggage,
    path: '/viaticos/mis-viajes',
  },
  {
    // `viaticos.ver_todos` es el permiso de revisión global; sin él, el
    // backend recorta la bandeja a las solicitudes propias del usuario y la
    // vista lo declara en vez de mostrar un concentrado ajeno.
    title: 'Concentrado de viáticos',
    icon: ClipboardCheck,
    path: '/viaticos/concentrado',
    permission: { require: 'viaticos.ver_todos' },
  },
];
