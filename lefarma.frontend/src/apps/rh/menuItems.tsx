import {
  LayoutDashboard,
  HelpCircle,
  FileCheck2,
  FileText,
  List,
  Settings,
  AlertTriangle,
  TimerIcon,
  CalendarDays,
  UserCog,
  ClipboardList,
  PenLine,
} from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

/**
 * RH (Recursos Humanos) sidebar navigation config. Paths are absolute with
 * the `/rh/` prefix (RH is mounted at `/rh/`).
 *
 * Estructura: autoservicio plano y arriba (Dashboard, Mis solicitudes,
 * Mis incidencias) para que el empleado común llegue en un clic; los grupos
 * de administración se auto-ocultan cuando ninguno de sus hijos tiene
 * permiso (AppSidebar filtra hijos y oculta el grupo vacío).
 */
export const rhMenuItems: SidebarMenuItemConfig[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/rh/dashboard',
  },
  {
    title: 'Mis solicitudes',
    icon: FileCheck2,
    path: '/rh/solicitudes',
    permission: { require: 'solicitud_personal.ver_listado' },
  },
  {
    title: 'Mis incidencias',
    icon: AlertTriangle,
    path: '/rh/mis-incidencias',
    permission: { require: 'incidencias_checado.ver_mias' },
  },
  {
    title: 'Incidencias y solicitudes',
    icon: ClipboardList,
    isCollapsible: true,
    items: [
      {
        title: 'Incidencias de checado',
        icon: AlertTriangle,
        path: '/rh/incidencias-checado',
        permission: { require: 'incidencias_checado.ver_todas' },
      },
      {
        title: 'Gestión de solicitudes',
        icon: Settings,
        path: '/rh/solicitudes/gestion',
        permission: { require: 'solicitud_personal.puede_ver_todas' },
      },
    ],
  },
  {
    title: 'Vacaciones',
    icon: CalendarDays,
    isCollapsible: true,
    items: [
      {
        title: 'Días hábiles y calendario laboral',
        icon: CalendarDays,
        path: '/rh/vacaciones/dias-habiles',
        permission: { require: 'vacaciones.dias_habiles.ver' },
      },
      {
        title: 'Saldos',
        icon: CalendarDays,
        path: '/rh/vacaciones/saldos',
        permission: { require: 'vacaciones.saldos.ver' },
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
      {
        title: 'Configuración de descuentos',
        icon: TimerIcon,
        path: '/rh/catalogos/incidencias-checado-config',
        permission: { require: 'incidencias_checado.crear' },
      },
    ],
  },
  {
    title: 'Configuración',
    icon: Settings,
    isCollapsible: true,
    items: [
      {
        title: 'Jefes y niveles de empleados',
        icon: UserCog,
        path: '/rh/jefes-niveles',
        permission: { require: 'solicitud_personal.jefes_niveles.ver' },
      },
      {
        title: 'Firmas digitales',
        icon: PenLine,
        path: '/rh/firmas',
        permission: { require: 'usuarios.firma.habilitar_cambio' },
      },
    ],
  },
  {
    title: 'Ayuda',
    icon: HelpCircle,
    path: '/rh/help',
  },
];
