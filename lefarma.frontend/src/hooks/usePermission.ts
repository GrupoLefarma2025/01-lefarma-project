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
 *
 * NOTE: Array options (require, requireAny, exclude) are serialized with JSON.stringify
 * so callers can safely pass inline array literals without causing memo invalidation.
 */
export function usePermission(options: PermissionCheckOptions): boolean {
  const user = useAuthStore((s) => s.user);

  // Serialize array deps to stable strings — prevents re-computation when callers
  // pass inline array literals (e.g. requireAny={['a', 'b']}) that change reference each render.
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
