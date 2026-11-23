import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import type { UserInfo } from '@/types/auth.types';
import { checkPermission } from '@/utils/permissions';

export interface SigmaUser {
  username: string;
  nombreCompleto: string;
  correo: string;
  dominio: string;
  permisos: string[];
}

export interface SigmaVisitor {
  nombreCompleto: string;
  correo: string;
  visitorToken: string;
}

export type SigmaUserPatch = Partial<Pick<SigmaUser, 'nombreCompleto' | 'correo' | 'dominio'>>;

const VISITOR_STORAGE_KEY = 'sigma.visitor';

function mapUser(user: UserInfo | null): SigmaUser | null {
  if (!user) return null;
  return {
    username: user.username,
    nombreCompleto: user.nombre ?? user.username,
    correo: user.correo ?? '',
    dominio: user.dominio ?? '',
    permisos: user.permisos.map((p) => p.codigoPermiso),
  };
}

export function useSigmaAuth(): {
  user: SigmaUser | null;
  token: string | null;
  isAuthenticated: boolean;
  logout: () => void;
  updateUser: (patch: SigmaUserPatch) => void;
} {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  const sigmaUser = useMemo(() => mapUser(user), [user]);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  const updateUser = useCallback(
    (patch: SigmaUserPatch) => {
      const current = useAuthStore.getState().user;
      if (!current) return;
      const next: UserInfo = {
        ...current,
        nombre: patch.nombreCompleto ?? current.nombre,
        correo: patch.correo ?? current.correo,
        dominio: patch.dominio ?? current.dominio,
      };
      setUser(next);
    },
    [setUser]
  );

  return { user: sigmaUser, token, isAuthenticated, logout: handleLogout, updateUser };
}

export function useSigmaPermission(): (code: string) => boolean {
  const user = useAuthStore((s) => s.user);

  return useCallback(
    (code: string) => {
      if (!code || !user?.permisos?.length) return false;
      const objetivo = code.toLowerCase();
      return user.permisos.some((p) => p.codigoPermiso.toLowerCase() === objetivo);
    },
    [user]
  );
}

export const sigmaAuth = {
  getToken(): string | null {
    return useAuthStore.getState().token;
  },
  getUser(): SigmaUser | null {
    return mapUser(useAuthStore.getState().user);
  },
  hasPermission(code: string): boolean {
    if (!useAuthStore.getState().user) return false;
    return checkPermission({ require: code });
  },
};

function isSigmaVisitor(value: unknown): value is SigmaVisitor {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SigmaVisitor>;
  return (
    typeof candidate.nombreCompleto === 'string' &&
    typeof candidate.correo === 'string' &&
    typeof candidate.visitorToken === 'string' &&
    candidate.visitorToken.length > 0
  );
}

export function getVisitor(): SigmaVisitor | null {
  try {
    const raw = sessionStorage.getItem(VISITOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSigmaVisitor(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getVisitorToken(): string | null {
  return getVisitor()?.visitorToken ?? null;
}

export function setVisitor(visitor: SigmaVisitor): void {
  try {
    sessionStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(visitor));
  } catch {
  }
}

export function clearVisitor(): void {
  try {
    sessionStorage.removeItem(VISITOR_STORAGE_KEY);
  } catch {
  }
}
