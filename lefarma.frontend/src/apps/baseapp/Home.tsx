import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { appRegistry, type AppRegistryEntry } from '@/apps/_registry';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Shell home launcher (base-app spec: "Home Launcher"). Renders one tile per
 * entry in the static app registry. The launcher is the default landing surface
 * of the shell.
 *
 * The launcher does NOT assume any empresa/sucursal/area context is selected
 * (base-app spec: "No Global Context Assumption") — context is deferred to the
 * individual apps.
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

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
        'group relative overflow-hidden p-6 transition-all duration-200 ease-out',
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
      {/* Subtle gradient accent that appears on hover */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent',
          'opacity-0 transition-opacity duration-200',
          !app.disabled && 'group-hover:opacity-100'
        )}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {Icon && (
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                'bg-primary/10 text-primary transition-colors duration-200',
                !app.disabled && 'group-hover:bg-primary/15'
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-lg font-semibold leading-none tracking-tight">
              {app.label}
            </p>
            {app.description && (
              <p className="text-sm text-muted-foreground">{app.description}</p>
            )}
            {app.disabled && (
              <span className="text-xs text-muted-foreground">Próximamente</span>
            )}
          </div>
        </div>

        {!app.disabled && (
          <ArrowRight
            className={cn(
              'h-5 w-5 shrink-0 text-muted-foreground/40',
              'transition-all duration-200',
              'group-hover:translate-x-1 group-hover:text-primary'
            )}
          />
        )}
      </div>
    </Card>
  );

  // Disabled entries are shown but must not expose a navigation target.
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
