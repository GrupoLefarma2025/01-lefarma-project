import {
  LayoutDashboard,
  HelpCircle,
  Users,
  FileCheck2,
  FileText,
  List,
  Settings,
  AlertTriangle,
  TimerIcon,
} from 'lucide-react';
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
    title: 'Solicitudes de personal',
    icon: Users,
    isCollapsible: true,
    items: [
      {
        title: 'Solicitudes',
        icon: FileCheck2,
        path: '/rh/solicitudes',
        permission: { require: 'solicitud_personal.ver_listado' },
      },
      {
        title: 'Gestión',
        icon: Settings,
        path: '/rh/solicitudes/gestion',
        permission: { require: 'solicitud_personal.puede_ver_todas_solcitudes' },
      },
    ],
  },
  {
    title: 'Catálogos',
    icon: List,
    isCollapsible: true,
    items: [
      {
        title: 'Tipos de Solicitud',
        icon: FileText,
        path: '/rh/catalogos/tipos-solicitud',
        permission: { require: 'tipos-solicitud.ver_listado' },
      },
    ],
  },
  {
    title: 'Biometrico',
    icon: TimerIcon,
    isCollapsible: true,
    items: [
      {
        title: 'Incidencias de checado',
        icon: AlertTriangle,
        path: '/rh/incidencias-checado',
        permission: { require: 'incidencias_checado.ver_todas' },
      },
    ],
  },
  {
    title: 'Ayuda',
    icon: HelpCircle,
    path: '/rh/help',
  },
];
