import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

interface PermissionGuardProps {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Componente declarativo de guardia de permisos.
 * Renderiza `children` cuando la verificación de permisos pasa; de lo contrario, renderiza `fallback` (por defecto null).
 */
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
