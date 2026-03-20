import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Key,
  Settings,
  Building2,
  User,
  ChevronRight,
  Database,
  Store,
  Wallet,
  Ruler,
  Users,
  CreditCard,
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
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    title: 'Seguridad',
    icon: Shield,
    isCollapsible: true,
    items: [
      { title: 'Roles', icon: Users, path: '/seguridad/roles' },
      { title: 'Permisos', icon: Key, path: '/seguridad/permisos' },
    ],
  },
  {
    title: 'Catálogos',
    icon: Database,
    isCollapsible: true,
    items: [
      { title: 'Empresas', icon: Building2, path: '/catalogos/empresas' },
      { title: 'Sucursales', icon: Store, path: '/catalogos/sucursales' },
      { title: 'Áreas', icon: Database, path: '/catalogos/areas' },
      { title: 'Gastos', icon: Wallet, path: '/catalogos/gastos' },
      { title: 'Medidas', icon: Ruler, path: '/catalogos/medidas' },
      { title: 'Formas de Pago', icon: CreditCard, path: '/catalogos/formas-pago' },
    ],
  },
  {
    title: 'Configuración',
    icon: Settings,
    path: '/configuracion',
  },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/dashboard">
                <div className="rounded-lg bg-primary p-1">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-bold text-primary-foreground">LeFarma</span>
                  <span className="text-xs text-muted">v1.0.0</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <div key={item.title}>
                {item.isCollapsible ? (
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
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.path}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={subItem.path}
                                  className={({ isActive }) =>
                                    isActive ? 'font-medium text-primary' : ''
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
                ) : (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.path!}
                        className={({ isActive }) =>
                          isActive ? 'bg-primary/10 font-medium text-primary' : ''
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </div>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild tooltip="Perfil">
              <NavLink to="/perfil">
                <User className="h-4 w-4" />
                <span>Perfil Usuario</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
