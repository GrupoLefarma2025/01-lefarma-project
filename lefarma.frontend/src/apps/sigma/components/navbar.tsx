import React from "react";
import {
  Bell,
  LogOut,
  User,
  Home,
  FileText,
  Upload,
  PenTool,
  CheckCircle,
  UserCheck,
  Users,
  Settings,
  Lock,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, useNavigate } from "react-router-dom";
import { useSigmaAuth } from "@/apps/sigma/store/sigmaAuth";
import { ThemeToggle } from "@/apps/sigma/components/theme-toggle";

/** Prefijo con el que el shell de Lefarma monta las rutas de SIGMA. */
const BASE_PATH = "/SIGMA";

const routeConfig: Record<
  string,
  { name: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
> = {
  "/home": { name: "Inicio", icon: Home },
  "/documentos": { name: "Documentos", icon: FileText },
  "/documentos/subir-pdf": { name: "Cargar Documentos", icon: Upload },
  "/documentos/bandeja-firmas": { name: "Pendientes por firmar", icon: PenTool },
  "/documentos/flujo": { name: "Flujo de Documentos", icon: GitBranch },
  "/documentos/autorizados-rechazados": { name: "Autorizados / Rechazados", icon: CheckCircle },
  "/documentos/validar-firma": { name: "Validar Firma", icon: UserCheck },
  "/admin": { name: "Administración", icon: Settings },
  "/admin/roles": { name: "Roles", icon: Users },
  "/admin/permissions": { name: "Permisos", icon: Lock },
  "/admin/users": { name: "Usuarios", icon: Users },
};

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { user, logout } = useSigmaAuth();

  // Generar breadcrumbs basados en la ruta actual (sin el prefijo /SIGMA)
  const routePath = currentPath.replace(new RegExp(`^${BASE_PATH}`), "") || "/";
  const pathSegments = routePath.split("/").filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const config = routeConfig[path];
    return {
      path: `${BASE_PATH}${path}`,
      name: config?.name || segment,
      icon: config?.icon,
    };
  });

  const handleLogout = () => {
    logout();
    // Regresa a la entrada de SIGMA (login propio del módulo o acceso externo),
    // no al login global de Lefarma.
    navigate("/SIGMA");
  };

  const hasBreadcrumbs = breadcrumbs.length > 0;
  const lastBreadcrumb = hasBreadcrumbs
    ? breadcrumbs[breadcrumbs.length - 1]
    : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <SidebarTrigger className="shrink-0" />
        
        {/* Breadcrumb con overflow horizontal sin mostrar scrollbars */}
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden pr-1 sm:pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <Breadcrumb>
            <BreadcrumbList className="flex items-center gap-1">
              {!hasBreadcrumbs ? (
                <BreadcrumbItem className="flex items-center gap-1.5">
                  <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                  <BreadcrumbPage className="text-sm font-medium">Inicio</BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                <>
                  {/* Mostrar breadcrumbs anteriores solo si hay más de una sección */}
                  {breadcrumbs.length > 1 &&
                    breadcrumbs
                      .slice(0, -1)
                      .map((breadcrumb) => {
                        const Icon = breadcrumb.icon;
                        return (
                          <React.Fragment key={breadcrumb.path}>
                            <BreadcrumbItem className="hidden md:flex items-center gap-1.5 min-w-fit">
                              {Icon && (
                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <BreadcrumbLink
                                href={breadcrumb.path}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {breadcrumb.name}
                              </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block text-muted-foreground shrink-0" />
                          </React.Fragment>
                        );
                      })}
                  
                  {/* Último breadcrumb (página actual) */}
                  {lastBreadcrumb && (() => {
                    const LastIcon = lastBreadcrumb.icon;
                    return (
                      <BreadcrumbItem className="flex items-center gap-1.5 min-w-fit">
                        {LastIcon && (
                          <LastIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <BreadcrumbPage className="text-sm font-medium text-foreground">
                          {lastBreadcrumb.name}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    );
                  })()}
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-accent">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Notificaciones</span>
          </Button>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-accent">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">Menú de usuario</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.nombreCompleto || user?.username || "Usuario"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.correo || "Sin correo"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
