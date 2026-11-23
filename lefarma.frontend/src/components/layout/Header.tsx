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
import { Building2, MapPin, Layers, Briefcase, User, LogOut, Sun, Moon, Monitor, PenLine, AlertTriangle, HelpCircle } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useState } from 'react';
import CambiarUbicacionModal from './CambiarUbicacionModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export interface HeaderProps {
  showContext?: boolean;
  configPath?: string;
  showHelp?: boolean;
  onOpenHelp?: () => void;
}

export const Header = ({ showContext = false, configPath, showHelp = false, onOpenHelp }: HeaderProps = {}) => {
  const {
    user,
    empresa,
    sucursal,
    area,
    areaEmpleado,
    puestoEmpleado,
    hasFirma,
    hasFirmaLegacy,
    puedeSeleccionarEmpresas,
    logout,
  } = useAuthStore();
  const { title, subtitle } = usePageStore();
  const { ui, setTema } = useConfigStore();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const areaMostrada = areaEmpleado || area?.nombre || null;
  const puestoMostrado = puestoEmpleado?.trim() || null;

  const puedeCambiarUbicacion = showContext && puedeSeleccionarEmpresas;

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

  const sinFirma = showContext
    ? hasFirma === false && hasFirmaLegacy === false
    : hasFirma === false;

  return (
    <header className={`h-16 bg-card grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 sm:px-6 ${sinFirma ? 'border-b-2 border-amber-400 dark:border-amber-500' : 'border-b border-border'}`}>
      {}

      {}
      <div className="flex min-w-0 items-center gap-4 overflow-hidden">
        <SidebarTrigger className="shrink-0" />

        {showContext && (
        <div className="hidden min-w-0 items-center gap-4 lg:flex">
          <div className="h-4 w-px shrink-0 bg-border" />
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 max-w-[180px] truncate text-foreground font-medium" title={empresa?.nombre}>{empresa?.nombre || 'Sin empresa'}</span>
          </div>
          <div className="h-4 w-px shrink-0 bg-border" />
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 max-w-[180px] truncate text-muted-foreground" title={sucursal?.nombre}>{sucursal?.nombre || 'Sin sucursal'}</span>
          </div>
          {areaMostrada && (
            <>
              <div className="hidden h-4 w-px shrink-0 bg-border xl:block" />
              <div className="hidden min-w-0 items-center gap-2 text-sm xl:flex">
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 max-w-[220px] truncate text-muted-foreground" title={areaMostrada}>{areaMostrada}</span>
              </div>
            </>
          )}
          {puestoMostrado && (
            <>
              <div className="hidden h-4 w-px shrink-0 bg-border min-[1800px]:block" />
              <div className="hidden min-w-0 items-center gap-2 text-sm min-[1800px]:flex">
                <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 max-w-[220px] truncate text-muted-foreground" title={puestoMostrado}>{puestoMostrado}</span>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {}
      {title ? (
        <div className="hidden min-w-0 max-w-[40vw] text-center md:block">
          <p className="truncate text-sm font-semibold text-foreground leading-tight" title={title}>{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground leading-tight" title={subtitle}>{subtitle}</p>
          )}
        </div>
      ) : (
        <div className="hidden md:block" />
      )}

   {}
      <div className="flex min-w-0 items-center justify-end gap-2">
        {sinFirma && (
          <div className="hidden md:flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
            <PenLine className="h-3 w-3" />
            <span>Sin firma digital</span>
          </div>
        )}
        {showHelp && onOpenHelp && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onOpenHelp}
            title="Manual de ayuda"
            aria-label="Abrir manual de ayuda"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}

        {}
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

        {}
        <NotificationBell onError={(error) => console.error('Notification error:', error)} />

        {}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <div className="bg-primary/20 p-0 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {}
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="font-medium">{user?.nombre || user?.username}</span>
              <span className="text-xs font-normal text-muted-foreground">{user?.correo}</span>
              {puestoMostrado && (
                <span className="text-xs font-normal text-muted-foreground">{puestoMostrado}</span>
              )}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {}
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
              {areaMostrada && (
                <div className="flex items-center gap-2">
                  <Layers className="h-3 w-3" />
                  <span className="truncate">{areaMostrada}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <PenLine className="h-3 w-3" />
                {sinFirma ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Sin firma digital
                  </span>
                ) : hasFirma === true || hasFirmaLegacy === true ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Firma digital cargada</span>
                ) : (
                  <span>Verificando firma...</span>
                )}
              </div>
            </div>
             )}

            {showContext && <DropdownMenuSeparator />}

            {}
            {configPath && (
              <DropdownMenuItem onClick={() => navigate(configPath)}>
                <User className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </DropdownMenuItem>
            )}
            {puedeCambiarUbicacion && (
              <DropdownMenuItem onClick={() => setModalOpen(true)}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>Cambiar Ubicación</span>
              </DropdownMenuItem>
            )}

            {(configPath || puedeCambiarUbicacion) && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

       {puedeCambiarUbicacion && (
         <CambiarUbicacionModal open={modalOpen} onOpenChange={setModalOpen} />
       )}
    </header>
  );
};