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

    const payload: { permission?: string | string[] } = JSON.parse(atob(payloadBase64));

    // Los permisos vienen como claim 'permission' (puede ser string o array)
    const raw = payload.permission;
    if (!raw) return new Set();

    const items: string[] = Array.isArray(raw) ? raw : [raw];
    return new Set(items.map((p) => p.toLowerCase()));
  } catch {
    return new Set();
  }
}

/**
 * Retorna la lista de códigos de permiso del usuario actual desde los claims del JWT.
 */
export function getUserPermissions(): string[] {
  return Array.from(extractPermissionsFromJwt());
}

/**
 * Verifica permisos contra los claims del JWT (siempre actualizados).
 * Funciona fuera de componentes React (rutas, interceptores, lógica del sidebar).
 *
 * Orden de evaluación:
 * 1. `exclude` — si el usuario tiene ALGÚN permiso excluido → denegar
 * 2. `require` — el usuario debe tener TODOS los permisos listados
 * 3. `requireAny` — el usuario debe tener al menos UNO de los permisos listados
 * 4. Si no se proporcionan opciones → permitir (sin restricciones)
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
