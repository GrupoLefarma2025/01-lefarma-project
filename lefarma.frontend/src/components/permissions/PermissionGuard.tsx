import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGuardProps {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  require,
  requireAny,
  exclude,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const allowed = usePermission({ require, requireAny, exclude });
  return allowed ? children : fallback;
}
