import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';

/**
 * Route guard for the `/CxP/` base-app shell.
 *
 * When the session is NOT authenticated, the guard performs a full-page redirect
 * to the EXISTING root login (`/login` lives in the root build, which is a
 * separate bundle from the `/CxP/` shell build — so we cannot use React Router's
 * `navigate` across builds). The protected route's full path (including the
 * `/CxP/` basename) is carried as the `return` query param so the root login can
 * send the user back after a successful login.
 *
 * The guard checks AUTHENTICATION ONLY. It deliberately does NOT block on
 * empresa/sucursal/area context selection — that is deferred to per-app logic
 * (see base-app spec: "No Global Context Assumption").
 */
export interface RequireAuthProps {
  /** Protected subtree rendered when authenticated. */
  children: ReactNode;
  /**
   * Login destination. Defaults to the existing root `/login`. Override only for
   * testing or alternate login hosts.
   */
  loginPath?: string;
}

export function RequireAuth({ children, loginPath = '/login' }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) return;
    // Full path incl. basename so the root build login can redirect back here.
    const returnUrl = window.location.pathname + window.location.search;
    window.location.href = `${loginPath}?return=${encodeURIComponent(returnUrl)}`;
  }, [isAuthenticated, loginPath]);

  if (!isAuthenticated) {
    // Never render the protected subtree while redirecting away.
    return null;
  }

  return <>{children}</>;
}
