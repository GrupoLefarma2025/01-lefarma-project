import type { ReactNode } from 'react';
import { checkPermission, usePermissionVersion } from '@/utils/permissions';

interface PermissionElementProps {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
  children: ReactNode;
  fallback?: ReactNode | null;
}

export function PermissionElement({
  require,
  requireAny,
  exclude,
  children,
  fallback = null,
}: PermissionElementProps) {
  usePermissionVersion(); // subscribe — re-render when permissions change
  const hasPermission = checkPermission({ require, requireAny, exclude });
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
