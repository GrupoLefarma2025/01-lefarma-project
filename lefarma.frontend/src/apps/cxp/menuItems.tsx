import {
  LayoutDashboard,
  Shield,
  Key,
  Database,
  Store,
  Ruler,
  Users,
  CreditCard,
  FileCheck2,
  Bell,
  MapPin,
  FileText,
  List,
  Building,
  UserCircle,
  HelpCircle,
  GitBranch,
  ShoppingCart,
  Receipt,
  Send,
  Wallet,
} from 'lucide-react';
import type { SidebarMenuItemConfig } from '@/components/layout/sidebar-types';

/**
 * Config de navegación del sidebar CxP. Extraído de AppSidebar para hacer el
 * sidebar configurable por app. Los paths son absolutos con el prefijo `/cxp/`
 * (nav-reorg: CxP está montado en `/cxp/`, no en la raíz).
 */
export const cxpMenuItems: SidebarMenuItemConfig[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/cxp/dashboard',
  },
  {
    title: 'Admin',
    icon: Shield,
    isCollapsible: true,
    items: [
      {
        title: 'Usuarios',
        icon: Users,
        path: '/cxp/seguridad/usuarios',
        permission: { require: 'usuarios.ver_listado' },
      },
      {
        title: 'Roles',
        icon: Users,
        path: '/cxp/seguridad/roles',
        permission: { require: 'roles.ver_listado' },
      },
      {
        title: 'Permisos',
        icon: Key,
        path: '/cxp/seguridad/permisos',
        permission: { require: 'permisos.ver_listado' },
      },
    ],
  },
  {
    title: 'Catálogos',
    icon: Database,
    isCollapsible: true,
    items: [
      { title: 'Empresas', icon: Building, path: '/cxp/catalogos/empresas', permission: { require: 'empresas.ver_listado' } },
      { title: 'Sucursales', icon: Store, path: '/cxp/catalogos/sucursales', permission: { require: 'sucursales.ver_listado' } },
      { title: 'Áreas', icon: Database, path: '/cxp/catalogos/areas', permission: { require: 'areas.ver_listado' } },
      { title: 'Tipos de Gasto', icon: Wallet, path: '/cxp/catalogos/tipos-gasto', permission: { require: 'tipos-gasto.ver_listado' } },
      { title: 'Medidas', icon: Ruler, path: '/cxp/catalogos/medidas', permission: { require: 'medidas.ver_listado' } },
      { title: 'Formas de Pago', icon: CreditCard, path: '/cxp/catalogos/formas-pago', permission: { require: 'formas-pago.ver_listado' } },
      { title: 'Tipos de Impuesto', icon: Receipt, path: '/cxp/catalogos/tipos-impuesto', permission: { require: 'tipos-impuesto.ver_listado' } },
      { title: 'Centros de Costo', icon: MapPin, path: '/cxp/catalogos/centros-costo', permission: { require: 'centros-costo.ver_listado' } },
      { title: 'Cuentas Contables', icon: FileText, path: '/cxp/catalogos/cuentas-contables', permission: { require: 'cuentas-contables.ver_listado' } },
      { title: 'Estatus de Orden', icon: List, path: '/cxp/catalogos/estatus-orden', permission: { require: 'estatus-orden.ver_listado' } },
      { title: 'Proveedores', icon: Building, path: '/cxp/catalogos/proveedores', permission: { require: 'proveedores.ver_listado' } },
      { title: 'Regímenes Fiscales', icon: UserCircle, path: '/cxp/catalogos/regimenes-fiscales', permission: { require: 'regimenes-fiscales.ver_listado' } },
    ],
  },
  {
    title: 'Órdenes de compra',
    icon: ShoppingCart,
    isCollapsible: true,
    items: [
      { title: 'Crear orden', icon: FileText, path: '/cxp/ordenes/crear', permission: { require: 'ordenes.crear' } },
      { title: 'Bandeja de autorizaciones', icon: FileCheck2, path: '/cxp/ordenes/autorizaciones', permission: { require: 'ordenes.ver_listado' } },
      { title: 'Concentrado de órdenes', icon: Send, path: '/cxp/ordenes/envio-concentrado', permission: { require: 'ordenes.envio_concentrado' } },
    ],
  },
  {
    title: 'Notificaciones',
    icon: Bell,
    path: '/cxp/notificaciones',
    permission: { require: 'notificaciones.ver_listado' },
  },
  {
    title: 'Workflows',
    icon: GitBranch,
    path: '/cxp/workflows',
    permission: { require: 'workflows.ver_listado' },
  },
  {
    title: 'Ayuda',
    icon: HelpCircle,
    path: '/cxp/help',
  },
];
