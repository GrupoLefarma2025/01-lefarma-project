import { useMemo } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import type { PermissionCheckOptions } from '@/utils/permissions';

function normalizeCodes(codes: string | string[]): string[] {
  const arr = Array.isArray(codes) ? codes : [codes];
  return arr.map((c) => c.toLowerCase());
}

export function usePermission(options: PermissionCheckOptions): boolean {
  const user = useAuthStore((s) => s.user);
  const requireKey = JSON.stringify(options.require);
  const requireAnyKey = JSON.stringify(options.requireAny);
  const excludeKey = JSON.stringify(options.exclude);

  return useMemo(() => {
    if (!user?.permisos?.length) return false;

    const codes = new Set(user.permisos.map((p) => p.codigoPermiso.toLowerCase()));

    if (options.exclude) {
      const excluded = normalizeCodes(options.exclude);
      for (const code of excluded) {
        if (codes.has(code)) return false;
      }
    }

    if (options.require) {
      const required = normalizeCodes(options.require);
      for (const code of required) {
        if (!codes.has(code)) return false;
      }
    }

    if (options.requireAny) {
      const anyOf = normalizeCodes(options.requireAny);
      if (!anyOf.some((code) => codes.has(code))) return false;
    }

    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, requireKey, requireAnyKey, excludeKey]);
}
