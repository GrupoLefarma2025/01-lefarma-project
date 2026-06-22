import { appRegistry, type AppRegistryEntry } from '@/apps/_registry';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {appRegistry.map((app) => (
        <LauncherTile key={app.id} app={app} />
      ))}
    </div>
  );
}

function LauncherTile({ app }: { app: AppRegistryEntry }) {
  const tile = (
    <Card className={app.disabled ? 'h-full opacity-60' : 'h-full transition-shadow hover:shadow-md'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{app.label}</CardTitle>
        {app.description && <CardDescription>{app.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {app.disabled && (
          <span className="text-xs text-muted-foreground">Próximamente</span>
        )}
      </CardContent>
    </Card>
  );

  // Disabled entries are shown but must not expose a navigation target.
  if (app.disabled) {
    return tile;
  }

  return (
    <a href={app.path} aria-label={app.label} className="block h-full no-underline">
      {tile}
    </a>
  );
}
