import { useAuthStore } from '@/store/authStore';
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
import { Building2, MapPin, User, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useState } from 'react';
import CambiarUbicacionModal from './CambiarUbicacionModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export const Header = () => {
  const { user, empresa, sucursal, logout } = useAuthStore();
  const { title, subtitle } = usePageStore();
  const { ui, setTema } = useConfigStore();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const handleThemeChange = (tema: string) => {
    setTema(tema as 'light' | 'dark' | 'system');
  };

  const handleLogout = async () => {
    await logout();
    // logout() ya hace redirect a /login, no necesitamos navegar aquí
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
    <header className="h-16 bg-card border-b border-border relative flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Toggle + Location Info (hidden on mobile) */}
      <div className="flex items-center gap-4">
        <SidebarTrigger />

        {/* Empresa + Sucursal: md+ only */}
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
        </div>
      </div>

      {/* Center: Page Title (md+ only) */}
      {title && (
        <div className="absolute left-1/2 -translate-x-1/2 text-center hidden md:block">
          <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
          )}
        </div>
      )}

      {/* Right side: Theme + Notifications + User Menu */}
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

        {/* Notification Bell - always visible */}
        <NotificationBell onError={(error) => console.error('Notification error:', error)} />

        {/* User Menu - avatar only (compact) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <div className="bg-primary/20 p-0 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* User Info */}
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="font-medium">{user?.nombre || user?.username}</span>
              <span className="text-xs font-normal text-muted-foreground">{user?.correo}</span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* Current Location Info (mobile-friendly) */}
            <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{empresa?.nombre || 'Sin empresa'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{sucursal?.nombre || 'Sin sucursal'}</span>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Actions */}
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setModalOpen(true)}>
              <Building2 className="mr-2 h-4 w-4" />
              <span>Cambiar Ubicación</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CambiarUbicacionModal open={modalOpen} onOpenChange={setModalOpen} />
    </header>
  );
};
