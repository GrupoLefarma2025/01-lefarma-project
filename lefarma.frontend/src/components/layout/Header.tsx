import { useAuthStore } from '@/shared/auth/authStore';
import { usePageStore } from '@/store/pageStore';
import { useConfigStore } from '@/store/configStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Building2, MapPin, Layers, User, LogOut, Sun, Moon, Monitor, PenLine, AlertTriangle } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useState } from 'react';
import CambiarUbicacionModal from './CambiarUbicacionModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export interface HeaderProps {
  /**
   * Show empresa/sucursal/area context info and the "Cambiar Ubicación"
   * modal. CxP sets true (3-step login collects context); RH and other
   * apps default false (no context).
   */
  showContext?: boolean;
  /** Configuración page path (e.g. "/cxp/configuracion"). Omit to hide. */
  configPath?: string;
}

export const Header = ({ showContext = false, configPath }: HeaderProps = {}) => {
  const { user, empresa, sucursal, area, hasFirma, logout } = useAuthStore();
  const { title, subtitle } = usePageStore();
  const { ui, setTema } = useConfigStore();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const handleThemeChange = (tema: string) => {
    if (tema === 'light' || tema === 'dark' || tema === 'system') {
      setTema(tema);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const getThemeIcon = () => {
    switch (ui.tema) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <header className={`h-16 bg-card relative flex items-center justify-between px-4 sm:px-6 ${hasFirma === false ? 'border-b-2 border-amber-400 dark:border-amber-500' : 'border-b border-border'}`}>
      {/* Lado izquierdo: Toggle + Información de ubicación */}
      <div className="flex items-center gap-4">
        <SidebarTrigger />

        {/* Empresa + Sucursal + Área: solo cuando la app usa contexto (CxP) */}
        {showContext && (
          <div className="hidden md:flex items-center gap-4">
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground font-medium">{empresa?.nombre || 'Sin empresa'}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{sucursal?.nombre || 'Sin sucursal'}</span>
            </div>
            {area && (
              <>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{area.nombre}</span>
                </div>
              </>
            )}
          </div>
        )}

        {hasFirma === false && (
          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-amber-400 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
            <PenLine className="h-3 w-3" />
            <span>Sin firma digital</span>
          </div>
        )}
      </div>

      {/* Centro: Título de la página (solo md+) */}
      {title && (
        <div className="absolute left-1/2 -translate-x-1/2 text-center hidden md:block">
          <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
          )}
        </div>
      )}

      {/* Lado derecho: Tema + Notificaciones + Menú de usuario */}
      <div className="flex items-center gap-2">
        {/* Theme Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              {getThemeIcon()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Tema</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={ui.tema} onValueChange={handleThemeChange}>
              <DropdownMenuRadioItem value="light">
                <Sun className="mr-2 h-4 w-4" />
                <span>Claro</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="mr-2 h-4 w-4" />
                <span>Oscuro</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="mr-2 h-4 w-4" />
                <span>Sistema</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notification Bell */}
        <NotificationBell onError={(error) => console.error('Notification error:', error)} />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <div className="bg-primary/20 p-0 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="font-medium">{user?.nombre || user?.username}</span>
              <span className="text-xs font-normal text-muted-foreground">{user?.correo}</span>
              {user?.puesto && (
                <span className="text-xs font-normal text-muted-foreground">{user.puesto}</span>
              )}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* Información de ubicación actual (móvil) — solo para apps con contexto */}
            {showContext && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{empresa?.nombre || 'Sin empresa'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{sucursal?.nombre || 'Sin sucursal'}</span>
                </div>
                {area && (
                  <div className="flex items-center gap-2">
                    <Layers className="h-3 w-3" />
                    <span className="truncate">{area.nombre}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <PenLine className="h-3 w-3" />
                  {hasFirma === true ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Firma digital cargada</span>
                  ) : hasFirma === false ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Sin firma digital
                    </span>
                  ) : (
                    <span>Verificando firma...</span>
                  )}
                </div>
              </div>
            )}

            {showContext && <DropdownMenuSeparator />}

            {/* Actions */}
            {configPath && (
              <DropdownMenuItem onClick={() => navigate(configPath)}>
                <User className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </DropdownMenuItem>
            )}
            {showContext && (
              <DropdownMenuItem onClick={() => setModalOpen(true)}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>Cambiar Ubicación</span>
              </DropdownMenuItem>
            )}

            {(configPath || showContext) && <DropdownMenuSeparator />}

            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showContext && <CambiarUbicacionModal open={modalOpen} onOpenChange={setModalOpen} />}
    </header>
  );
};
