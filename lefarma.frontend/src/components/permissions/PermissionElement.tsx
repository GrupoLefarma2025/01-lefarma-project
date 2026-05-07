import type { ReactNode } from 'react';
import { checkPermission } from '@/utils/permissions';

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
  const hasPermission = checkPermission({ require, requireAny, exclude });
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
