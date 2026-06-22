import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/auth/authStore';

/**
 * Route guard for the root base-app shell and any mounted app subtree.
 *
 * When the session is NOT authenticated, the guard renders a `<Navigate>` to
 * the configured `loginPath`, preserving the intended destination via a
 * `?return=` query param (app-routing spec: Authentication Guard "preserving
 * the return URL"). The shell build is a single bundle, so an in-app navigation
 * is sufficient (no full-page reload).
 *
 * The `?return=` form integrates with `Login.tsx`'s existing `safeReturn`
 * handling (reads `window.location.search`, accepts same-origin absolute
 * paths as an open-redirect guard). No changes to `Login.tsx` are required
 * beyond the nav-reorg scope.
 *
 * The guard checks AUTHENTICATION ONLY. It deliberately does NOT block on
 * empresa/sucursal/area context selection — that is deferred to per-app logic
 * (see base-app spec: "No Global Context Assumption").
 */
export interface RequireAuthProps {
  /** Protected subtree rendered when authenticated. */
  children: ReactNode;
  /**
   * Login destination. Defaults to `/login` (shell global login). Mounted app
   * subtrees override with their own login (e.g. `/cxp/login`).
   */
  loginPath?: string;
}

export function RequireAuth({ children, loginPath = '/login' }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // In-app redirect within the single-bundle shell.
    //
    // Preserve the intended destination so the login page can redirect back
    // after a successful authentication (app-routing spec: Authentication Guard
    // "preserving the return URL"). `?return=` integrates with Login.tsx's
    // existing `safeReturn` handling without requiring Login changes.
    const from = location.pathname + location.search;
    return <Navigate to={`${loginPath}?return=${encodeURIComponent(from)}`} replace />;
  }

  return <>{children}</>;
}
