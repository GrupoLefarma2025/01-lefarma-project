import { useMemo } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import type { PermissionCheckOptions } from '@/utils/permissions';


function normalizeCodes(codes: string | string[]): string[] {
  const arr = Array.isArray(codes) ? codes : [codes];
  return arr.map((c) => c.toLowerCase());
}

/**
 * Hook reactivo de verificación de permisos.
 * Usa el store de auth de Zustand para actualizarse cuando cambian los permisos (ej: vía SSE).
 *
 * Orden de evaluación:
 * 1. `exclude` — si el usuario tiene ALGÚN permiso excluido → denegar
 * 2. `require` — el usuario debe tener TODOS los permisos listados
 * 3. `requireAny` — el usuario debe tener al menos UNO de los permisos listados
 * 4. Si no se proporcionan opciones → permitir (sin restricciones)
 *
 * NOTA: Las opciones en arreglo (require, requireAny, exclude) se serializan con JSON.stringify
 * para que los callers puedan pasar literales de arreglo inline sin causar invalidación del memo.
 */
export function usePermission(options: PermissionCheckOptions): boolean {
  const user = useAuthStore((s) => s.user);

  // Serializar dependencias de arreglo a strings estables — evita recálculo cuando
  // los callers pasan literales de arreglo inline (ej: requireAny={['a', 'b']})
  // que cambian de referencia en cada render.
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
