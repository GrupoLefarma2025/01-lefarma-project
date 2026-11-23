import { ClipboardCheck, ClipboardList, Luggage, Plane, Settings } from 'lucide-react';
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
    title: 'Autorizaciones',
    icon: ClipboardList,
    path: '/viaticos/autorizaciones',
    permission: { require: 'viaticos.autorizar' },
  },
  {
    title: 'Concentrado de viáticos',
    icon: ClipboardCheck,
    path: '/viaticos/concentrado',
    permission: { require: 'viaticos.autorizar' },
  },
  {
    title: 'Configuración de viáticos',
    icon: Settings,
    path: '/viaticos/configuracion',
  },
];
