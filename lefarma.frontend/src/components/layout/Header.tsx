import { useAuthStore } from '@/store/authStore';
import { usePageStore } from '@/store/pageStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Building2, MapPin, User, LogOut, ChevronDown, Sun, Moon } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useState, useEffect } from 'react';

export const Header = () => {
  const { user, empresa, sucursal, logout } = useAuthStore();
  const { title, subtitle } = usePageStore();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);

   // Detectar el tema actual al cargar
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, []);

  const handleToggleTheme = () => {
    const htmlElement = document.documentElement;
    
    if (isDark) {
      htmlElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      htmlElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-card border-b border-border relative flex items-center justify-between px-6">
      {/* Left side: Toggle + Location Info */}
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div className="h-4 w-px bg-border hidden sm:block" />
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

      {/* Center: Page Title */}
      {title && (
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
          )}
        </div>
      )}

      {/* Right side: Theme Toggle + User Menu */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleTheme}
          className="h-9 w-9"
        >
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <div className="bg-primary/20 p-2 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">
                  {user?.nombre || user?.username}
                </p>
                <p className="text-xs text-muted-foreground">{user?.correo}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/select-empresa')}>
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
    </header>
  );
};
