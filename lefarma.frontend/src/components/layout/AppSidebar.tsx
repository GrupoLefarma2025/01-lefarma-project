import { NavLink } from 'react-router-dom';
import {
  ChevronRight,
  User,
  LogOut,
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
import { useAuthStore } from '@/shared/auth/authStore';
import favicon from '@/assets/favicon.ico';
import { checkPermission } from '@/utils/permissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SidebarMenuItemConfig, CollapsibleMenuItem } from '@/components/layout/sidebar-types';

function hasPermission(permission?: Parameters<typeof checkPermission>[0]): boolean {
  if (!permission) return true;
  return checkPermission(permission);
}

export interface AppSidebarProps {
  /** Elementos del menú de navegación de esta aplicación. */
  items: SidebarMenuItemConfig[];
  /** Texto de marca mostrado en el encabezado del sidebar (p. ej. "Grupo Lefarma CxP"). */
  brandTitle: string;
  /** Destino del enlace del logo del encabezado (p. ej. "/cxp/dashboard"). */
  brandPath: string;
  /** Enlace opcional de configuración de usuario en el pie (p. ej. "/cxp/configuracion"). */
  configPath?: string;
}

export function AppSidebar({ items, brandTitle, brandPath, configPath }: AppSidebarProps) {
  const { user, logout, hasFirma } = useAuthStore();
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
            <DropdownMenuContent side="right" align="start" className="min-w-48">
              {visibleItems.map((subItem) => (
                <DropdownMenuItem key={subItem.path} asChild>
                  <NavLink
                    to={subItem.path}
                    className={({ isActive }) =>
                      `flex w-full items-center gap-2 ${isActive ? 'bg-primary/10 font-medium text-primary-foreground' : ''}`
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

  const footerUserContent = (
    <>
      <span className="relative">
        <User className="h-4 w-4" />
        {hasFirma === false && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                <p>Falta subir firma digital</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      <span>{user?.nombre || 'Usuario'}</span>
    </>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to={brandPath}>
                <div className="rounded-lg bg-primary p-1">
                  <img src={favicon} alt="LeFarma" className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-bold text-white">{brandTitle}</span>
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
            {items.map((item) => {
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
          {configPath && (
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" asChild tooltip="Configuración">
                <NavLink to={configPath}>{footerUserContent}</NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {!configPath && (
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" tooltip="Usuario">
                {footerUserContent}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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
