import {
  LayoutDashboard,
  HelpCircle,
  Hospital,
  Package,
  Building2,
  Users,
  Settings,
  CalendarRange,
  FileText,
  CheckSquare,
  Calendar,
  ClipboardList,
  Presentation,
  PenLine,
  MapPin,
  LineChart,
  BarChart3,
  Sparkles,
  List,
  Globe,
} from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

/**
 * Config de navegación del sidebar de Educación Médica. Los paths son
 * absolutos con el prefijo `/educacion-medica/` (Educación Médica está montada
 * en `/educacion-medica/`).
 */
export const educacionMedicaMenuItems: SidebarMenuItemConfig[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/educacion-medica/dashboard',
  },
  {
    title: 'Catálogos',
    icon: List,
    isCollapsible: true,
    items: [
      {
        title: 'Hospitales',
        icon: Hospital,
        path: '/educacion-medica/catalogos/hospitales',
      },
      {
        title: 'Productos',
        icon: Package,
        path: '/educacion-medica/catalogos/productos',
      },
      {
        title: 'Tipo de Gerencia',
        icon: Building2,
        path: '/educacion-medica/catalogos/tipo-gerencia',
      },
      {
        title: 'Regiones',
        icon: Globe,
        path: '/educacion-medica/catalogos/regiones',
      },
      {
        title: 'Equipos y pareo',
        icon: Users,
        path: '/educacion-medica/catalogos/equipos-pareo',
      },
      {
        title: 'Parámetros',
        icon: Settings,
        path: '/educacion-medica/catalogos/parametros',
      },
      {
        title: 'Ranking',
        icon: Sparkles,
        path: '/educacion-medica/catalogos/config-ranking',
      },
    ],
  },
  {
    title: 'Planificación',
    icon: CalendarRange,
    isCollapsible: true,
    items: [
      {
        title: 'Programa Anual',
        icon: FileText,
        path: '/educacion-medica/programa-anual',
      },
      {
        title: 'Selección Mensual',
        icon: CheckSquare,
        path: '/educacion-medica/seleccion',
      },
      {
        title: 'Calendario',
        icon: Calendar,
        path: '/educacion-medica/calendario',
      },
    ],
  },
  {
    title: 'Operación',
    icon: ClipboardList,
    isCollapsible: true,
    items: [
      {
        title: 'Taller',
        icon: Presentation,
        path: '/educacion-medica/talleres',
      },
      {
        title: 'Bandeja de Autorizaciones',
        icon: PenLine,
        path: '/educacion-medica/aprobaciones',
      },
      {
        title: 'Mis hospitales del mes',
        icon: MapPin,
        path: '/educacion-medica/mis-asignaciones',
      },
    ],
  },
  {
    title: 'Seguimiento',
    icon: LineChart,
    isCollapsible: true,
    items: [
      {
        title: 'Indicadores',
        icon: BarChart3,
        path: '/educacion-medica/indicadores',
      },
      {
        title: 'Panel del mes',
        icon: LayoutDashboard,
        path: '/educacion-medica/panel-mes',
      },
    ],
  },
  {
    title: 'Ayuda',
    icon: HelpCircle,
    path: '/educacion-medica/help',
  },
];