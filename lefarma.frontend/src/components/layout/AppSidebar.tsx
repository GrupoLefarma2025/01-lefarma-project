import { NavLink } from 'react-router-dom';
import type { ElementType } from 'react';
import {
  LayoutDashboard,
  Shield,
  Key,
  User,
  ChevronRight,
  Database,
  Store,
  Wallet,
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
  LogOut,
  HelpCircle,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarGroupLabel,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/authStore';
import type { PermissionCheckOptions } from '@/utils/permissions';
import { checkPermission } from '@/utils/permissions';

interface MenuItemBase {
  title: string;
  icon: ElementType;
  permission?: PermissionCheckOptions;
}

interface MenuItem extends MenuItemBase {
  path: string;
}

interface CollapsibleMenuItem extends MenuItemBase {
  isCollapsible: true;
  items: MenuItem[];
}

type SidebarMenuItem = MenuItem | CollapsibleMenuItem;

function hasPermission(permission?: PermissionCheckOptions): boolean {
  console.log('Checking permission for:', permission);
  if (!permission) return true;
  return checkPermission(permission);
}

const menuItems: SidebarMenuItem[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    title: 'Admin',
    icon: Shield,
    isCollapsible: true,
    items: [
      { title: 'Usuarios', icon: User, path: '/seguridad/usuarios', permission: { requireAny: ['usuarios.ver_detalle', 'usuarios.manage'] } },
      { title: 'Roles', icon: Users, path: '/seguridad/roles', permission: { require: 'usuarios.ver_detalle' } },
      { title: 'Permisos', icon: Key, path: '/seguridad/permisos' },
    ],
  },
  {
    title: 'Catálogos',
    icon: Database,
    isCollapsible: true,
    items: [
      { title: 'Empresas', icon: Building, path: '/catalogos/empresas' },
      { title: 'Sucursales', icon: Store, path: '/catalogos/sucursales' },
      { title: 'Áreas', icon: Database, path: '/catalogos/areas' },
      { title: 'Gastos', icon: Wallet, path: '/catalogos/gastos' },
      { title: 'Medidas', icon: Ruler, path: '/catalogos/medidas' },
      { title: 'Formas de Pago', icon: CreditCard, path: '/catalogos/formas-pago' },
      { title: 'Centros de Costo', icon: MapPin, path: '/catalogos/centros-costo' },
      { title: 'Cuentas Contables', icon: FileText, path: '/catalogos/cuentas-contables' },
      { title: 'Estatus de Orden', icon: List, path: '/catalogos/estatus-orden' },
      { title: 'Proveedores', icon: Building, path: '/catalogos/proveedores' },
      { title: 'Regímenes Fiscales', icon: UserCircle, path: '/catalogos/regimenes-fiscales' },
    ],
  },
  {
    title: 'Notificaciones',
    icon: Bell,
    path: '/notificaciones',
  },
  {
    title: 'Autorizaciones OC',
    icon: FileCheck2,
    path: '/ordenes/autorizaciones',
  },
  {
    title: 'Ayuda',
    icon: HelpCircle,
    path: '/help',
  },
];

export function AppSidebar() {
  const { user, logout } = useAuthStore();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleLogout = async () => {
    await logout();
  };

  const getVisibleSubItems = (item: CollapsibleMenuItem) => {
    return item.items.filter((sub) => hasPermission(sub.permission));
  };

  const renderCollapsibleItem = (item: CollapsibleMenuItem) => {
    const visibleItems = getVisibleSubItems(item);
    if (visibleItems.length === 0) return null;

    if (isCollapsed) {
      return (
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton tooltip={item.title}>
                {item.icon && <item.icon className="h-4 w-4" />}
                <span>{item.title}</span>
                <ChevronRight className="ml-auto h-4 w-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              className="min-w-48"
            >
              {visibleItems.map((subItem) => (
                <DropdownMenuItem key={subItem.path} asChild>
                  <NavLink
                    to={subItem.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 w-full ${isActive ? 'bg-primary/10 font-medium text-primary-foreground' : ''}`
                    }
                  >
                    {subItem.icon && <subItem.icon className="h-4 w-4" />}
                    <span>{subItem.title}</span>
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    return (
      <Collapsible asChild className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title}>
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.title}</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {visibleItems.map((subItem) => (
                <SidebarMenuSubItem key={subItem.path}>
                  <SidebarMenuSubButton asChild>
                    <NavLink
                      to={subItem.path}
                      className={({ isActive }) =>
                        isActive ? 'font-medium text-primary-foreground' : ''
                      }
                    >
                      <span>{subItem.title}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/dashboard">
                <div className="rounded-lg bg-primary p-1">
                  <img src="/favicon.ico" alt="LeFarma" className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-bold text-white">Grupo Lefarma CxP</span>
                    <span className="text-xs text-white">v1.0.0</span>
                  </div>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => {
              if ('isCollapsible' in item) {
                return <div key={item.title}>{renderCollapsibleItem(item)}</div>;
              }

              if (!hasPermission(item.permission)) return null;

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        isActive ? 'bg-primary/10 font-medium text-primary-foreground' : ''
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild tooltip="Perfil">
              <NavLink to="/perfil">
                <User className="h-4 w-4" />
                <span>{user?.nombre || 'Usuario'}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" onClick={handleLogout} tooltip="Cerrar Sesión">
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
