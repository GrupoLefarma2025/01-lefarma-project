/**
 * Shared router types for multi-app subtree mounting.
 *
 * The shell mounts each app subtree (CxP, RH, future apps) via a reusable
 * route-module function call. Every app route module accepts the SAME shape so
 * the shell can mount them uniformly without app-specific props leaking into
 * the router layer (DRY: replaces the former per-app `GastosRoutesProps` and
 * `RhRoutesProps` duplicates).
 */
export interface SubtreeRoutesProps {
  /**
   * Root keeps an app-specific index landing; subtree redirects the index to
   * the per-app login.
   *
   * NOTE: after the nav-reorg the shell is mounted at root (`/`), so only the
   * `subtree` variant is mounted in production. The `root` variant is retained
   * for API stability and standalone-module testing.
   */
  variant: 'root' | 'subtree';
  /**
   * Subtree login destination. Defaults to `/login` (root) or the app's own
   * `/{app}/login` (subtree). The shell threads the explicit per-app login so
   * unauthenticated subtree hits redirect to the correct app login instead of
   * the global one.
   */
  loginPath?: string;
}
