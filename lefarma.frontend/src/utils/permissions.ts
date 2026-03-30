import type { UserInfo, PermissionInfo } from '@/types/auth.types';

const USER_KEY = 'user';

export interface PermissionCheckOptions {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
}

function normalizeCodes(codes: string | string[]): string[] {
  const arr = Array.isArray(codes) ? codes : [codes];
  return arr.map((c) => c.toLowerCase());
}

function extractPermissionSet(permisos: PermissionInfo[]): Set<string> {
  return new Set(permisos.map((p) => p.codigoPermiso.toLowerCase()));
}

function getUserFromStorage(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

/**
 * Returns the list of permission codes for the current user from localStorage.
 * Returns an empty array if no user is found or has no permissions.
 */
export function getUserPermissions(): string[] {
  const user = getUserFromStorage();
  if (!user?.permisos?.length) return [];
  return user.permisos.map((p) => p.codigoPermiso);
}

/**
 * Checks permissions against the current user stored in localStorage.
 * Works outside React components (routes, interceptors, sidebar logic).
 *
 * Evaluation order:
 * 1. `exclude` — if the user has ANY excluded permission → deny
 * 2. `require` — user must have ALL listed permissions
 * 3. `requireAny` — user must have at least ONE listed permission
 * 4. If no options provided → allow (no restrictions)
 */
export function checkPermission(options: PermissionCheckOptions): boolean {
  const user = getUserFromStorage();

  if (!user?.permisos?.length) return false;

  const codes = extractPermissionSet(user.permisos);

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
    const hasAny = anyOf.some((code) => codes.has(code));
    if (!hasAny) return false;
  }

  return true;
}
