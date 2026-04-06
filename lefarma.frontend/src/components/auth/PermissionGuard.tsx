import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { checkPermission } from '@/utils/permissions';


interface PermissionGuardProps {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({ require, requireAny, exclude, fallback, children }: PermissionGuardProps) {
  const hasPermission = checkPermission({ require, requireAny, exclude });

  if (!hasPermission) {
    return fallback ? <>{fallback}</> : <Navigate to="/bloqueado" replace />;
  }

  return <>{children}</>;
}
