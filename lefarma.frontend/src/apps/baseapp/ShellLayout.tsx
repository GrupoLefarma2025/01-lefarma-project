import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, User } from 'lucide-react';

/**
 * Authenticated shell layout for the root base app (base-app spec:
 * "Authenticated Shell Layout"). Renders primary navigation + a content region.
 *
 * Reachable only to authenticated users — `BaseAppRoutes` wraps this component
 * in `RequireAuth`, so by the time ShellLayout renders the session is known to be
 * authenticated.
 *
 * Deliberately minimal (MVP shell): a top bar with brand + primary nav, and a
 * `<main>` content region. It intentionally does NOT include user/role/permission
 * administration (base-app spec: "Excludes Administration UI") and does NOT read
 * empresa/sucursal/area context (base-app spec: "No Global Context Assumption").
 *
 * The shell is served from the root basename (`/`); React Router composes the
 * basename, so `/perfil` resolves to `/perfil` and `/hub` resolves to `/hub`
 * (the shell home, formerly the `/` index — see BaseAppRoutes for the
 * corrected navigation model).
 *
 * No nav affordance targets the bare `/` index: that route is now a redirect
 * (app-routing spec: "Root Index Redirect"). Both the brand and the Inicio
 * item link to `/hub`, the launcher home (design Decision 3).
 */
export function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link
            to="/hub"
            className="text-base font-semibold tracking-tight transition-colors hover:text-primary"
          >
            Lefarma
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Navegación principal">
            <NavLink to="/hub" label="Inicio" icon={<LayoutDashboard className="h-4 w-4" />} />
            <NavLink to="/perfil" label="Perfil" icon={<User className="h-4 w-4" />} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

function NavLink({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
