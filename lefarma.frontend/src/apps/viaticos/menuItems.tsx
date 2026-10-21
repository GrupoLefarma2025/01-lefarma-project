import { ClipboardCheck, Luggage, Plane, Settings } from 'lucide-react';
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
    // Pantalla de autorización: solo entra quien puede autorizar. El backend
    // exige el mismo permiso en la bandeja, así que el recorte a las
    // solicitudes propias ya no aplica aquí.
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
