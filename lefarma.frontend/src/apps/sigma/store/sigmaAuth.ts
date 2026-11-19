import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import type { UserInfo } from '@/types/auth.types';
import { checkPermission } from '@/utils/permissions';

/**
 * Adaptador de sesión/permisos de SIGMA sobre los stores de Lefarma.
 *
 * SIGMA no tiene store de autenticación propio: reutiliza `useAuthStore` y el
 * cache de permisos de `@/utils/permissions` para que la sesión sea la misma
 * del shell. Este módulo es el único punto que conocen las páginas de SIGMA.
 */

/** Usuario de SIGMA en el shape que consumen sus pantallas. */
export interface SigmaUser {
  /** Nombre de usuario (SAM) con el que se autenticó. */
  username: string;
  nombreCompleto: string;
  correo: string;
  dominio: string;
  /** Códigos de permiso (`codigoPermiso`), tal cual los entrega el backend. */
  permisos: string[];
}

/** Visitante del acceso externo (sin sesión). */
export interface SigmaVisitor {
  nombreCompleto: string;
  correo: string;
  /**
   * Token de visitante que emite el backend en
   * `POST /v2/documentos/acceso-externo`; viaja en la cabecera
   * `X-Sigma-Visitor` para las llamadas sin sesión.
   */
  visitorToken: string;
}

/** Campos del usuario que SIGMA puede actualizar en local. */
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

/**
 * Sesión reactiva de SIGMA.
 *
 * `logout` es la acción del store de Lefarma (limpia token, permisos y
 * redirige al login global).
 */
export function useSigmaAuth(): {
  user: SigmaUser | null;
  token: string | null;
  isAuthenticated: boolean;
  logout: () => void;
  /** Actualiza en local los datos de perfil mostrados por SIGMA. */
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

/**
 * Verificador de permisos reactivo para SIGMA.
 *
 * Devuelve una función `(code) => boolean` memoizada que se recalcula cuando
 * cambia el usuario. `usePermission` es un hook y no puede invocarse dentro
 * del callback que devolvemos (Reglas de los Hooks), así que replicamos su
 * misma semántica: códigos insensibles a mayúsculas, y `false` cuando no hay
 * sesión o el usuario no tiene permisos.
 */
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

/**
 * Versión NO-hook de la sesión, para usar en `lib/` y fuera de componentes
 * React (interceptores, helpers, servicios).
 */
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

/** Lee el visitante del acceso externo desde `sessionStorage`. */
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

/** Token del visitante del acceso externo, o `null` si no hay visitante. */
export function getVisitorToken(): string | null {
  return getVisitor()?.visitorToken ?? null;
}

/** Guarda el visitante del acceso externo en `sessionStorage`. */
export function setVisitor(visitor: SigmaVisitor): void {
  try {
    sessionStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(visitor));
  } catch {
    // sessionStorage no disponible (modo privado/cuota): el flujo continúa sin persistir.
  }
}

/** Elimina el visitante guardado. */
export function clearVisitor(): void {
  try {
    sessionStorage.removeItem(VISITOR_STORAGE_KEY);
  } catch {
    // sin sesión de almacenamiento no hay nada que limpiar.
  }
}
