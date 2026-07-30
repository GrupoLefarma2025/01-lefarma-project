import { create } from 'zustand';
import { API } from '@/shared/api/apiClient';
import { authService } from '@/shared/auth/authService';
import type { ApiResponse } from '@/types/api.types';

export interface PermissionCheckOptions {
  require?: string | string[];
  requireAny?: string | string[];
  exclude?: string | string[];
}

const POLL_INTERVAL_MS = 5 * 60 * 1000;

// ===== Reactive store =====
// Cache en memoria reactivo: fuente unica de verdad para checkPermission (sincrono).
// Se actualiza en background via refreshPermissions() (login + polling 5 min).
// Antes del primer fetch exitoso queda vacio => deniega todo (igual que antes
// cuando no habia JWT).
interface PermissionStore {
  codes: Set<string>;
  loaded: boolean;
  _setCodes: (codes: Set<string>) => void;
  _setLoaded: (loaded: boolean) => void;
  _clear: () => void;
}

const usePermissionStore = create<PermissionStore>((set) => ({
  codes: new Set<string>(),
  loaded: false,
  _setCodes: (codes) => set({ codes }),
  _setLoaded: (loaded) => set({ loaded }),
  _clear: () => set({ codes: new Set<string>(), loaded: false }),
}));

/**
 * Hook de suscripcion: componentes que renderizan UI gated por permisos DEBEN
 * llamarlo para re-renderizar cuando los permisos cambian.
 * Uso: `const permVersion = usePermissionVersion();` luego llamar checkPermission normalmente.
 * El numero devuelto cambia cuando cambian los codes, forzando re-render.
 */
// ponytail: combine size+loaded into one number so Zustand detects change on either;
// switch to a version counter if codes.size approaches 1e6
export function usePermissionVersion(): number {
  return usePermissionStore((s) => s.codes.size + (s.loaded ? 1000000 : 0));
}

function normalizeCodes(codes: string | string[]): string[] {
  const arr = Array.isArray(codes) ? codes : [codes];
  return arr.map((c) => c.toLowerCase());
}

let pollHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Trae los permisos vigentes desde el backend (`GET /profile`,
 * cache server-side de 5 min) y actualiza el cache local en memoria.
 * Fire-and-forget seguro: ante fallo conserva el ultimo set conocido y
 * reintenta en el proximo tick del polling.
 */
export async function refreshPermissions(): Promise<void> {
  try {
    const response = await API.get<
      ApiResponse<{ permissions: string[] }> | { permissions: string[] }
    >('/profile');

    // ponytail: trust boundary de red: tolera envelope ApiResponse Y payload plano
    const payload = response.data;
    const perms =
      ('data' in payload ? payload.data?.permissions : payload.permissions) ?? [];

    usePermissionStore.getState()._setCodes(new Set(perms.map((p) => p.toLowerCase())));
    usePermissionStore.getState()._setLoaded(true);
  } catch (err) {
    console.error('[permissions] Error al refrescar permisos desde /profile:', err);
    // conserva el cache anterior; reintenta en el proximo tick
  }
}

/**
 * Retorna la lista de codigos de permiso del usuario actual desde el cache.
 */
export function getUserPermissions(): string[] {
  return Array.from(usePermissionStore.getState().codes);
}

/**
 * `true` una vez que el primer fetch exitoso poblo el cache. util para rutas
 * que quieren esperar antes de resolver el arbol de permisos.
 */
export function hasPermissionsLoaded(): boolean {
  return usePermissionStore.getState().loaded;
}

/**
 * Inicia el polling en background cada 5 min. Idempotente: reinicia el
 * intervalo si ya habia uno activo.
 */
export function startPermissionsPolling(): void {
  if (pollHandle !== null) clearInterval(pollHandle);
  pollHandle = setInterval(() => {
    void refreshPermissions();
  }, POLL_INTERVAL_MS);
}

/**
 * Detiene el polling y limpia el cache. Usar en logout para que una sesion
 * sin token no retenga permisos stale.
 */
export function stopPermissionsPolling(): void {
  if (pollHandle !== null) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  usePermissionStore.getState()._clear();
}

/**
 * Verifica si el usuario actual tiene el rol SuperAdministrador decodificando
 * el JWT del localStorage. Sincrono — funciona desde el primer render sin
 * esperar al fetch de permisos. El backend (PermissionHandler con BD) valida
 * permisos reales en cada request, asi que esto es solo una optimizacion de
 * UX, no de seguridad.
 */
const SUPER_ADMIN_ROLE = 'SuperAdministrador';
const ROLE_CLAIM_KEYS = [
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  'role',
  'roles',
];

function isSuperAdmin(): boolean {
  try {
    const token = authService.getAccessToken();
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const payload = JSON.parse(atob(parts[1]));
    for (const key of ROLE_CLAIM_KEYS) {
      const val = payload[key];
      if (!val) continue;
      const roles = Array.isArray(val) ? val : [val];
      if (roles.includes(SUPER_ADMIN_ROLE)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Verifica permisos contra el cache en memoria (sincrono).
 * Funciona fuera de componentes React (rutas, interceptores, lógica del sidebar).
 *
 * Orden de evaluación:
 * 0. SuperAdministrador → bypass total (true inmediato, sin consultar cache)
 * 1. `exclude` — si el usuario tiene ALGÚN permiso excluido → denegar
 * 2. `require` — el usuario debe tener TODOS los permisos listados
 * 3. `requireAny` — el usuario debe tener al menos UNO de los permisos listados
 * 4. Si no se proporcionan opciones → permitir (sin restricciones)
 */
export function checkPermission(options: PermissionCheckOptions): boolean {
  // Bypass para SuperAdministrador: acceso total sin consultar cache de permisos.
  if (isSuperAdmin()) return true;

  const { codes } = usePermissionStore.getState();
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
