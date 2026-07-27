import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { checkPermission } from '@/utils/permissions';


interface PermissionGuardProps {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
  fallback?: ReactNode;
  /**
   * Ruta de redirección cuando falla la verificación de permisos. Por defecto `/bloqueado`
   * (la página de bloqueo). Los subárboles montados sobrescriben con un
   * destino con alcance de subárbol, de modo que un fallo de permiso bajo `/cxp/`
   * resuelve a `/cxp/bloqueado` en lugar de escapar a `/bloqueado`
   * (spec de app-routing: "Permission checks preserved under subtree mounting").
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
