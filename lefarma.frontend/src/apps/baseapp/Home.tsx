import { Link } from 'react-router-dom';
import { appRegistry, type AppRegistryEntry } from '@/apps/_registry';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Launcher home del shell (spec base-app: "Home Launcher"). Renderiza un tile
 * por cada entrada en el registro estático de apps. El launcher es la
 * superficie de aterrizaje por defecto del shell.
 *
 * El launcher NO asume que haya ningún contexto empresa/sucursal/area
 * seleccionado (spec base-app: "No Global Context Assumption") — el contexto
 * se difiere a las apps individuales.
 */
export function Home() {
  if (appRegistry.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No hay aplicaciones disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aplicaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecciona una aplicación para continuar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {appRegistry.map((app, index) => (
          <LauncherTile key={app.id} app={app} index={index} />
        ))}
      </div>
    </div>
  );
}

function LauncherTile({
  app,
  index,
}: {
  app: AppRegistryEntry;
  index: number;
}) {
  const Icon = app.icon;

  const tile = (
    <Card
      className={cn(
        'group relative flex aspect-square flex-col items-center justify-center gap-3 p-5 text-center',
        'transition-all duration-200 ease-out',
        'animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both',
        !app.disabled && [
          'cursor-pointer hover:-translate-y-1 hover:shadow-lg',
          'hover:border-primary/30 focus-within:border-primary/30',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        ],
        app.disabled && 'cursor-not-allowed opacity-60'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {Icon && (
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl',
            'bg-primary/10 text-primary transition-colors duration-200',
            !app.disabled && 'group-hover:bg-primary group-hover:text-primary-foreground'
          )}
        >
          <Icon className="h-8 w-8" />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-base font-semibold leading-tight tracking-tight">
          {app.label}
        </p>
        {app.description && (
          <p className="text-xs text-muted-foreground">{app.description}</p>
        )}
        {app.disabled && (
          <span className="text-xs text-muted-foreground">Próximamente</span>
        )}
      </div>
    </Card>
  );

  // Las entradas deshabilitadas se muestran pero no deben exponer un destino de navegación.
  if (app.disabled) {
    return tile;
  }

  return (
    <Link
      to={app.path}
      aria-label={app.label}
      className="block h-full no-underline focus:outline-none"
    >
      {tile}
    </Link>
  );
}
