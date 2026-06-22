import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { checkPermission } from '@/utils/permissions';


interface PermissionGuardProps {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
  fallback?: ReactNode;
  /**
   * Where to redirect when the permission check fails. Defaults to `/bloqueado`
   * (the blocked page). Mounted subtrees override with a
   * subtree-scoped destination so a permission failure under `/cxp/`
   * resolves to `/cxp/bloqueado` instead of leaking to `/bloqueado`
   * (app-routing spec: "Permission checks preserved under subtree mounting").
   */
  blockedPath?: string;
  children: ReactNode;
}

export function PermissionGuard({
  require,
  requireAny,
  exclude,
  fallback,
  blockedPath = '/bloqueado',
  children,
}: PermissionGuardProps) {
  const hasPermission = checkPermission({ require, requireAny, exclude });

  if (!hasPermission) {
    return fallback ? <>{fallback}</> : <Navigate to={blockedPath} replace />;
  }

  return <>{children}</>;
}
