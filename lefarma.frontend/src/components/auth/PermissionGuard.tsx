import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  checkPermission,
  usePermissionVersion,
  hasPermissionsLoaded,
} from '@/utils/permissions';
import { InlineLoader } from '@/components/ui/inline-loader';


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
  usePermissionVersion(); // subscribe — re-render when permissions change

  // Espera al primer fetch de permisos (GET /profile) antes de decidir.
  // Con el cache aun vacio, "no tiene permiso" significa "aun no se sabe",
  // no "denegado": sin esta espera, un F5 a una ruta protegida redirige a
  // /bloqueado aunque el usuario si tenga el permiso (race entre boot y fetch
  // fire-and-forget en authStore.initialize()).
  if (!hasPermissionsLoaded()) {
    return <InlineLoader message="Verificando permisos…" />;
  }

  const hasPermission = checkPermission({ require, requireAny, exclude });

  if (!hasPermission) {
    return fallback ? <>{fallback}</> : <Navigate to={blockedPath} replace />;
  }

  return <>{children}</>;
}
