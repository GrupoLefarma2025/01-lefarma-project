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

export function usePermissionVersion(): number {
  return usePermissionStore((s) => s.codes.size + (s.loaded ? 1000000 : 0));
}

function normalizeCodes(codes: string | string[]): string[] {
  const arr = Array.isArray(codes) ? codes : [codes];
  return arr.map((c) => c.toLowerCase());
}

let pollHandle: ReturnType<typeof setInterval> | null = null;

export async function refreshPermissions(): Promise<void> {
  try {
    const response = await API.get<
      ApiResponse<{ permissions: string[] }> | { permissions: string[] }
    >('/profile');

    const payload = response.data;
    const perms =
      ('data' in payload ? payload.data?.permissions : payload.permissions) ?? [];

    usePermissionStore.getState()._setCodes(new Set(perms.map((p) => p.toLowerCase())));
    usePermissionStore.getState()._setLoaded(true);
  } catch (err) {
    console.error('[permissions] Error al refrescar permisos desde /profile:', err);
  }
}

export function getUserPermissions(): string[] {
  return Array.from(usePermissionStore.getState().codes);
}

export function hasPermissionsLoaded(): boolean {
  return usePermissionStore.getState().loaded;
}

export function startPermissionsPolling(): void {
  if (pollHandle !== null) clearInterval(pollHandle);
  pollHandle = setInterval(() => {
    void refreshPermissions();
  }, POLL_INTERVAL_MS);
}

export function stopPermissionsPolling(): void {
  if (pollHandle !== null) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  usePermissionStore.getState()._clear();
}

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

export function checkPermission(options: PermissionCheckOptions): boolean {
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
