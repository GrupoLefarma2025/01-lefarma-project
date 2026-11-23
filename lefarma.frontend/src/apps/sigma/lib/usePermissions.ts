import { useCallback, useMemo } from 'react';
import { useSigmaAuth } from '@/apps/sigma/store/sigmaAuth';

export function usePermissions() {
  const { user } = useSigmaAuth();
  const permisos = user?.permisos;

  const hasPermission = useCallback(
    (permissionCode: string): boolean => {
      if (!permissionCode || !permisos?.length) return false;
      const objetivo = permissionCode.toLowerCase();
      return permisos.some((code) => code.toLowerCase() === objetivo);
    },
    [permisos]
  );

  const hasAnyPermission = useCallback(
    (permissionCodes: string[]): boolean => {
      if (!permisos?.length) return false;
      return permissionCodes.some((code) => hasPermission(code));
    },
    [permisos, hasPermission]
  );

  const hasAllPermissions = useCallback(
    (permissionCodes: string[]): boolean => {
      if (!permisos?.length) return false;
      return permissionCodes.every((code) => hasPermission(code));
    },
    [permisos, hasPermission]
  );

  return useMemo(
    () => ({
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      permissions: permisos ?? [],
    }),
    [hasPermission, hasAnyPermission, hasAllPermissions, permisos]
  );
}

export function useRequirePermission(permissionCode: string) {
  const { hasPermission } = usePermissions();
  return hasPermission(permissionCode);
}
