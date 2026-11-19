import { useCallback, useMemo } from 'react';
import { useSigmaAuth } from '@/apps/sigma/store/sigmaAuth';

/**
 * Adaptación de `usePermissions` de SIGMA sobre la sesión de Lefarma.
 *
 * `SigmaUser.permisos` ya son códigos (`codigoPermiso`), así que la
 * comparación es exacta e insensible a mayúsculas, igual que
 * `useSigmaPermission`.
 */
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

/** Hook para proteger componentes con un único permiso. */
export function useRequirePermission(permissionCode: string) {
  const { hasPermission } = usePermissions();
  return hasPermission(permissionCode);
}
