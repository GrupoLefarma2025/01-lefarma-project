import {
  Home,
  Inbox,
  Upload,
  Settings,
  ChevronDown,
  User2,
  History,
  Plus,
  ShieldCheck,
  GitBranch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useSigmaAuth } from "@/apps/sigma/store/sigmaAuth";
import { ProtectedElement } from "@/apps/sigma/components/ProtectedRoute";
import {
  useSidebarBadgeStore,
  SIDEBAR_BADGE_KEYS,
} from "@/apps/sigma/lib/sidebarBadgeStore";
import type { SidebarBadgeKey } from "@/apps/sigma/lib/sidebarBadgeStore";
import logoImg from "@/apps/sigma/assets/logo.png";

type SidebarNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: string;
  badgeKey?: SidebarBadgeKey;
};

type SidebarNavGroup = SidebarNavItem[];

// Navigation items
const navigationItems: SidebarNavGroup = [
  {
    title: "Inicio",
    url: "/SIGMA/home",
    icon: Home,
    permission: undefined as string | undefined,
  },
];

// Documents items
const documentsItems: SidebarNavGroup = [
  {
    title: "Cargar Documentos",
    url: "/SIGMA/documentos/subir-pdf",
    icon: Upload,
    permission: "menu.subida",
  },
  {
    title: "Pendientes por firmar",
    url: "/SIGMA/documentos/bandeja-firmas",
    icon: Inbox,
    permission: "menu.bandeja",
    badgeKey: SIDEBAR_BADGE_KEYS.bandeja,
  },
  {
    title: "Flujo de Documentos",
    url: "/SIGMA/documentos/flujo",
    icon: GitBranch,
    permission: "menu.flujos",
  },
  {
    title: "Autorizados / Rechazados",
    url: "/SIGMA/documentos/autorizados-rechazados",
    icon: History,
    permission: "menu.bandeja",
  },
  {
    title: "Validar Documento Firmado",
    url: "/SIGMA/documentos/validar-firma",
    icon: ShieldCheck,
    permission: "menu.subida",
  },
];

// Teams data
// const teams = [
//   {
//     name: "Grupo Lefarma",
//     logo: "GL",
//     plan: "Enterprise",
//   },
//   {
//     name: "Acme Corp.",
//     logo: "AC",
//     plan: "Startup",
//   },
//   {
//     name: "Evil Corp.",
//     logo: "E",
//     plan: "Free",
//   },
// ];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useSigmaAuth();
  const badges = useSidebarBadgeStore((state) => state.badges);

  const handleLogout = () => {
    logout();
    // Vuelve a la entrada del módulo (tarjeta de acceso de SIGMA), no al
    // login global de Lefarma: así el usuario puede entrar con otra cuenta o
    // como visitante sin salir de SIGMA.
    navigate("/SIGMA");
  };

  const isActiveRoute = (url: string) => {
    return location.pathname === url;
  };

  const nombreCompleto = user?.nombreCompleto || user?.username || "Usuario";
  const rol = user?.dominio || "";

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="size-8 rounded-lg bg-white dark:bg-white p-1 shadow-sm dark:shadow-md flex items-center justify-center">
                    <img
                      src={logoImg}
                      alt="Grupo Lefarma Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                    <span className="truncate font-semibold">
                      Grupo Lefarma
                    </span>
                    {/* <span className="truncate text-xs">Enterprise</span> */}
                  </div>
                  <ChevronDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-popper-anchor-width] min-w-56 rounded-lg"
                side="bottom"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="size-6 rounded-sm bg-white dark:bg-white p-0.5 shadow-sm flex items-center justify-center">
                    <img
                      src={logoImg}
                      alt="Grupo Lefarma Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  Grupo Lefarma
                  {/* <Badge variant="outline" className="ml-auto">
                    Enterprise
                  </Badge> */}
                </DropdownMenuItem>
                {/* {teams.map((team, index) => (
                  <DropdownMenuItem key={team.name} className="gap-2 p-2">
                    <div className="flex size-6 items-center justify-center rounded-sm border">
                      <span className="text-xs font-medium">{team.logo}</span>
                    </div>
                    <span className="truncate">{team.name}</span>
                    <Badge
                      variant="secondary"
                      className="ml-auto text-xs shrink-0"
                    >
                      {team.plan}
                    </Badge>
                  </DropdownMenuItem>
                ))} */}
                {/* <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-md border border-dashed">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground truncate">
                    Agregar equipo
                  </div>
                </DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const menuItem = (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActiveRoute(item.url)}
                      tooltip={item.title}
                    >
                      <button
                        onClick={() => navigate(item.url)}
                        className="w-full overflow-hidden"
                      >
                        <item.icon className="shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );

                return item.permission ? (
                  <ProtectedElement key={item.title} requiredPermission={item.permission}>
                    {menuItem}
                  </ProtectedElement>
                ) : menuItem;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Documentos</SidebarGroupLabel>
          <ProtectedElement requiredPermission="menu.subida">
            <SidebarGroupAction
              title="Subir documento"
              onClick={() => navigate("/SIGMA/documentos/subir-pdf")}
            >
              <Plus />
              <span className="sr-only">Subir Documento</span>
            </SidebarGroupAction>
          </ProtectedElement>
          <SidebarGroupContent>
            <SidebarMenu>
              {documentsItems.map((item) => {
                const badgeValue =
                  item.badgeKey !== undefined ? badges[item.badgeKey] : undefined;

                return (
                  <ProtectedElement key={item.title} requiredPermission={item.permission}>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActiveRoute(item.url)}
                        tooltip={item.title}
                      >
                        <button
                          onClick={() => navigate(item.url)}
                          className="w-full overflow-hidden"
                        >
                          <item.icon className="shrink-0" />
                          <span className="truncate">{item.title}</span>
                          {badgeValue !== undefined ? (
                            <Badge
                              variant="secondary"
                              className="ml-auto h-5 px-2 text-xs flex items-center justify-center rounded-full shrink-0"
                            >
                              {badgeValue}
                            </Badge>
                          ) : null}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </ProtectedElement>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {/* Plataforma section - commented out temporarily
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupAction title="Agregar proyecto">
            <Plus />
            <span className="sr-only">Agregar Proyecto</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActiveRoute(item.url)}
                    tooltip={item.title}
                  >
                    <button
                      onClick={() => navigate(item.url)}
                      className="w-full overflow-hidden"
                    >
                      <item.icon className="shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        */}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src="/avatar.jpg" alt={nombreCompleto} />
                    <AvatarFallback className="rounded-lg">
                      {nombreCompleto.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                    <span className="truncate font-semibold">
                      {nombreCompleto}
                    </span>
                    <span className="truncate text-xs">
                      {rol}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-popper-anchor-width] min-w-56 rounded-lg"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem className="gap-2">
                  <User2 className="h-4 w-4" />
                  Mi cuenta
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Settings className="h-4 w-4" />
                  Configuración
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="gap-2">
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
