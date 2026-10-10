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
 * Códigos de permiso del módulo (espejo de `Permissions.EducacionMedica` en el backend
 * y de `Asokam.app.Permisos`; ver ADR-00009). El sidebar oculta los items sin permiso.
 */
const PERMISOS = {
  hub: 'baseapp.hub.puede_ver_educacion_medica',
  hospitalesVer: 'educacion_medica.hospitales.puede_ver',
  productosVer: 'educacion_medica.productos.puede_ver',
  configuracion: 'educacion_medica.configuracion.puede_gestionar',
  programasVer: 'educacion_medica.programas.puede_ver',
  seleccionesVer: 'educacion_medica.selecciones.puede_ver',
  talleresVer: 'educacion_medica.talleres.puede_ver',
  talleresCapturar: 'educacion_medica.talleres.puede_capturar',
} as const;

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
    permission: { require: PERMISOS.hub },
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
        permission: { require: PERMISOS.hospitalesVer },
      },
      {
        title: 'Productos',
        icon: Package,
        path: '/educacion-medica/catalogos/productos',
        permission: { require: PERMISOS.productosVer },
      },
      {
        title: 'Tipo de Gerencia',
        icon: Building2,
        path: '/educacion-medica/catalogos/tipo-gerencia',
        permission: { require: PERMISOS.configuracion },
      },
      {
        title: 'Regiones',
        icon: Globe,
        path: '/educacion-medica/catalogos/regiones',
        permission: { require: PERMISOS.configuracion },
      },
      {
        title: 'Equipos y pareo',
        icon: Users,
        path: '/educacion-medica/catalogos/equipos-pareo',
        permission: { require: PERMISOS.configuracion },
      },
      {
        title: 'Parámetros',
        icon: Settings,
        path: '/educacion-medica/catalogos/parametros',
        permission: { require: PERMISOS.configuracion },
      },
      {
        title: 'Ranking',
        icon: Sparkles,
        path: '/educacion-medica/catalogos/config-ranking',
        permission: { require: PERMISOS.configuracion },
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
        permission: { require: PERMISOS.programasVer },
      },
      {
        title: 'Selección Mensual',
        icon: CheckSquare,
        path: '/educacion-medica/seleccion',
        permission: { require: PERMISOS.seleccionesVer },
      },
      {
        title: 'Calendario',
        icon: Calendar,
        path: '/educacion-medica/calendario',
        permission: { require: PERMISOS.talleresVer },
      },
    ],
  },
  {
    title: 'Operación',
    icon: ClipboardList,
    isCollapsible: true,
    items: [
      {
        title: 'Matriz de talleres',
        icon: Presentation,
        path: '/educacion-medica/talleres',
        permission: { require: PERMISOS.talleresVer },
      },
      {
        title: 'Mis talleres',
        icon: ClipboardList,
        path: '/educacion-medica/talleres/mis-talleres',
        permission: { require: PERMISOS.talleresCapturar },
      },
      {
        title: 'Bandeja de Autorizaciones',
        icon: PenLine,
        path: '/educacion-medica/aprobaciones',
        permission: { require: PERMISOS.hub },
      },
      {
        title: 'Mis hospitales del mes',
        icon: MapPin,
        path: '/educacion-medica/mis-asignaciones',
        permission: { require: PERMISOS.talleresCapturar },
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
        permission: { require: PERMISOS.talleresVer },
      },
      {
        title: 'Panel del mes',
        icon: LayoutDashboard,
        path: '/educacion-medica/panel-mes',
        permission: { require: PERMISOS.talleresVer },
      },
    ],
  },
  {
    title: 'Ayuda',
    icon: HelpCircle,
    path: '/educacion-medica/help',
  },
];
