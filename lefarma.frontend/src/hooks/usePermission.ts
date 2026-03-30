import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { PermissionCheckOptions } from '@/utils/permissions';

function normalizeCodes(codes: string | string[]): string[] {
  const arr = Array.isArray(codes) ? codes : [codes];
  return arr.map((c) => c.toLowerCase());
}

/**
 * Reactive permission check hook.
 * Uses the Zustand auth store so it updates when permissions change (e.g. via SSE).
 *
 * Evaluation order:
 * 1. `exclude` — if the user has ANY excluded permission → deny
 * 2. `require` — user must have ALL listed permissions
 * 3. `requireAny` — user must have at least ONE listed permission
 * 4. If no options provided → allow (no restrictions)
 */
export function usePermission(options: PermissionCheckOptions): boolean {
  const user = useAuthStore((s) => s.user);

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
  }, [user, options.require, options.requireAny, options.exclude]);
}
