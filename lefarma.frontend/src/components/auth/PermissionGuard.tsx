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
  usePermissionVersion(); 

  if (!hasPermissionsLoaded()) {
    return <InlineLoader message="Verificando permisos…" />;
  }

  const hasPermission = checkPermission({ require, requireAny, exclude });

  if (!hasPermission) {
    return fallback ? <>{fallback}</> : <Navigate to={blockedPath} replace />;
  }

  return <>{children}</>;
}
