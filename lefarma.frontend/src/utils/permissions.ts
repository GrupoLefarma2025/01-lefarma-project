const TOKEN_KEY = 'accessToken';

export interface PermissionCheckOptions {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
}

function normalizeCodes(codes: string | string[]): string[] {
  const arr = Array.isArray(codes) ? codes : [codes];
  return arr.map((c) => c.toLowerCase());
}

/**
 * Extrae los permisos desde los claims del JWT almacenado en localStorage.
 * NO usa el objeto user (que se desincroniza con los permisos reales al refrescar token).
 */
function extractPermissionsFromJwt(): Set<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return new Set();

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return new Set();

    const payload = JSON.parse(atob(payloadBase64));

    // Los permisos vienen como claim 'permission' (puede ser string o array)
    const raw = payload.permission;
    if (!raw) return new Set();

    const items: string[] = Array.isArray(raw) ? raw : [raw];
    return new Set(items.map((p: string) => p.toLowerCase()));
  } catch {
    return new Set();
  }
}

/**
 * Returns the list of permission codes for the current user from JWT claims.
 */
export function getUserPermissions(): string[] {
  return Array.from(extractPermissionsFromJwt());
}

/**
 * Checks permissions against the JWT claims (siempre actualizados).
 * Works outside React components (routes, interceptors, sidebar logic).
 *
 * Evaluation order:
 * 1. `exclude` — if the user has ANY excluded permission → deny
 * 2. `require` — user must have ALL listed permissions
 * 3. `requireAny` — user must have at least ONE listed permission
 * 4. If no options provided → allow (no restrictions)
 */
export function checkPermission(options: PermissionCheckOptions): boolean {
  const codes = extractPermissionsFromJwt();

  if (codes.size === 0) return false;

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
